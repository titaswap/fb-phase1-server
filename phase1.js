// ==UserScript==
// @name         FB Phase-1 Post Discovery (Comment Count via IDs)
// @namespace    https://tampermonkey.net/
// @version      1.8
// @description  Phase-1: Capture FB Group Posts + save to local server
// @author       Titas
// @match        https://www.facebook.com/*
// @match        https://www.facebook.com/groups/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==

(function () {
    'use strict';

    /* =========================
       STATE
    ========================= */
    const STATE = {
        running: false,
        paused: false,
        posts: new Map(),
        savedCount: 0
    };

    const SERVER = 'http://localhost:3000/phase1';

    /* =========================
       HELPERS
    ========================= */
    const cleanText = t => t ? t.replace(/\s+/g, ' ').trim() : '';

    function extractHashtags(text) {
        if (!text) return [];
        const tags = text.match(/#[\w]+/g);
        return tags ? [...new Set(tags)] : [];
    }

    function formatDate(ts) {
        if (!ts) return '';
        return new Date(ts * 1000).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    /* =========================
       DEEP SCAN
    ========================= */
    function deepScan(obj, cb, seen = new Set()) {
        if (!obj || typeof obj !== 'object' || seen.has(obj)) return;
        seen.add(obj);
        cb(obj);
        for (const k in obj) deepScan(obj[k], cb, seen);
    }

    function findTimestamp(obj) {
        let ts = 0;
        deepScan(obj, n => {
            for (const k in n) {
                const v = n[k];
                if (typeof v === 'number' && v > 1000000000 && v < 9999999999) {
                    ts ||= v;
                }
            }
        });
        return ts;
    }

    function findText(obj) {
        let text =
            obj?.message?.text ||
            obj?.comet_sections?.content?.story?.message?.text ||
            '';

        if (text) return cleanText(text);

        deepScan(obj, n => {
            if (typeof n === 'string' && n.length > 20 && !n.startsWith('http')) {
                text ||= n;
            }
        });

        return cleanText(text);
    }

    function findPostLink(obj) {
        let link = '';
        deepScan(obj, n => {
            for (const k in n) {
                const v = n[k];
                if (
                    typeof v === 'string' &&
                    v.includes('/groups/') &&
                    (v.includes('/posts/') || v.includes('/permalink/'))
                ) {
                    link ||= v;
                }
            }
        });
        return link;
    }

    function deriveCommentCount(obj) {
        const ids = new Set();
        deepScan(obj, n => {
            if (n?.__typename === 'Comment' && n?.id) ids.add(n.id);
            if (Array.isArray(n?.edges)) {
                n.edges.forEach(e => {
                    const c = e?.node;
                    if (c?.id) ids.add(c.id);
                });
            }
        });
        return ids.size;
    }

    /* =========================
       SAVE TO SERVER
    ========================= */
    function saveToServer(post) {
        GM_xmlhttpRequest({
            method: "POST",
            url: "http://localhost:3000/phase1",
            headers: {
                "Content-Type": "application/json"
            },
            data: JSON.stringify(post),

            onload: function (res) {
                try {
                    const data = JSON.parse(res.responseText);

                    if (data.saved) {
                        console.log(
                            `%c💾 SAVED TO JSON | TOTAL = ${data.total}`,
                            "color:#00ff66;font-weight:bold"
                        );

                        const status = document.querySelector("#p1-status");
                        if (status) {
                            status.innerText = `Saved: ${data.total}`;
                        }
                    } else {
                        console.log("⚠️ Duplicate skipped:", post.id || post.post_link);
                    }
                } catch (e) {
                    console.error("❌ Server response parse failed", e);
                }
            },

            onerror: function (err) {
                console.error("❌ GM_xmlhttpRequest failed", err);
            }
        });
    }


    /* =========================
       SAVE POST (LOCAL + SERVER)
    ========================= */
    function savePost(post) {
        const key = post.id || post.post_link;
        if (!key || STATE.posts.has(key)) return;

        STATE.posts.set(key, post);
        const index = STATE.posts.size;

        console.log(
            `%c[PHASE-1] POST #${index}`,
            'color:#00ffcc;font-weight:bold'
        );

        console.table({
            author: post.author,
            author_id: post.author_id,
            date: post.date,
            post_link: post.post_link,
            comment_count: post.comment_count
        });

        saveToServer(post);
    }

    /* =========================
       GRAPHQL PARSER
    ========================= */
    function processGraphQL(json) {
        if (!STATE.running || STATE.paused) return;

        deepScan(json, obj => {
            if (obj?.__typename !== 'Story' && obj?.__typename !== 'Post') return;

            const actor = obj?.actors?.[0];
            const ts = findTimestamp(obj);
            const text = findText(obj);
            const link = findPostLink(obj);

            if (!text && !link) return;

            savePost({
                id: obj.post_id || obj.id || '',
                author: actor?.name || '',
                author_id: actor?.id || '',
                text,
                timestamp: ts,
                date: formatDate(ts),
                post_type: obj.__typename,
                hashtags: extractHashtags(text),
                post_link: link,
                comment_count: deriveCommentCount(obj)
            });
        });
    }

    /* =========================
       NETWORK INTERCEPT
    ========================= */
    function intercept() {
        const open = XMLHttpRequest.prototype.open;
        const send = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (m, u) {
            this._url = u;
            return open.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function () {
            this.addEventListener('load', () => {
                if (this._url?.includes('/api/graphql')) handle(this.responseText);
            });
            return send.apply(this, arguments);
        };

        const origFetch = window.fetch;
        window.fetch = async (...args) => {
            const res = await origFetch(...args);
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
            if (url?.includes('/api/graphql')) {
                res.clone().text().then(handle);
            }
            return res;
        };
    }

    function handle(text) {
        if (text.startsWith('for (;;);')) text = text.slice(9);
        text.split('\n').forEach(l => {
            if (!l.trim()) return;
            try { processGraphQL(JSON.parse(l)); } catch { }
        });
    }

    /* =========================
       UI
    ========================= */
    function createUI() {
        const p = document.createElement('div');
        p.style = `
          position:fixed;
          bottom:20px;
          right:20px;
          z-index:999999;
          background:#111;
          color:#fff;
          padding:10px;
          border-radius:8px;
          font-family:monospace;
        `;

        p.innerHTML = `
          <button id="p1-start">▶ Start</button>
          <button id="p1-pause">⏸ Pause</button>
          <button id="p1-stop">⏹ Stop</button>
          <div id="p1-status">Idle</div>
        `;

        document.body.appendChild(p);

        p.querySelector('#p1-start').onclick = () => {
            STATE.running = true;
            STATE.paused = false;
            p.querySelector('#p1-status').innerText = 'Running';
            console.log('[PHASE-1] ▶ START');
        };

        p.querySelector('#p1-pause').onclick = () => {
            STATE.paused = !STATE.paused;
            p.querySelector('#p1-status').innerText =
                STATE.paused ? 'Paused' : 'Running';
        };

        p.querySelector('#p1-stop').onclick = () => {
            STATE.running = false;
            p.querySelector('#p1-status').innerText = 'Stopped';
            console.log('[PHASE-1] ⏹ STOP');
            console.log('📦 FINAL POSTS:', STATE.posts.size);
        };
    }

    intercept();
    document.addEventListener('DOMContentLoaded', () => {
        createUI();
        console.log('[PHASE-1] Ready');
    });

})();
