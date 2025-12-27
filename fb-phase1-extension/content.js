/* =========================
   INJECTION
========================= */
const s = document.createElement('script');
s.src = chrome.runtime.getURL('inject.js');
s.onload = function () {
    this.remove();
};
(document.head || document.documentElement).appendChild(s);

/* =========================
   STATE
========================= */
const STATE = {
    running: false,
    paused: false,
    posts: new Map(),
    savedCount: 0
};

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
   SAVE LOGIC
========================= */
function saveToServer(post) {
    chrome.runtime.sendMessage({
        type: 'SAVE_POST',
        data: post
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Extension Error:", chrome.runtime.lastError);
            return;
        }

        if (response && response.success) {
            const data = response.data;

            // data.total = total saved in file
            // data.saved = boolean (true if new, false if duplicate)

            if (data.saved) {
                /* console.log(
                `%c💾 SAVED TO JSON | TOTAL = ${data.total}`,
                    "color:#00ff66;font-weight:bold"
                ); */
            } else {
                STATE.dupCount = (STATE.dupCount || 0) + 1;
                //console.log("⚠️ Duplicate skipped:", post.id || post.post_link);
            }

            updateUIStatus(`Saved: ${data.total} | Dups: ${STATE.dupCount || 0}`);

        } else {
            console.error("❌ Server Error:", response?.error);
        }
    });
}

function savePost(post) {
    const key = post.id || post.post_link;
    if (!key || STATE.posts.has(key)) return;

    STATE.posts.set(key, post);
    const index = STATE.posts.size;

    /* console.log(
    `%c[PHASE-1] POST #${index}`,
        'color:#00ffcc;font-weight:bold'
    ); */
    console.table({
        author: post.author,
        date: post.date,
        link: post.post_link
    });

    saveToServer(post);
}

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
   LISTENER (FROM INJECTED SCRIPT)
========================= */
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data.type && event.data.type === 'FB_GRAPHQL_INTERCEPT') {
        let text = event.data.payload;
        if (text.startsWith('for (;;);')) text = text.slice(9);

        text.split('\n').forEach(line => {
            if (!line.trim()) return;
            try {
                const json = JSON.parse(line);
                processGraphQL(json);
            } catch (e) {
                // ignore parsing errors
            }
        });
    }
});

/* =========================
   UI
========================= */
let statusDiv = null;
let scrollInterval = null;

function updateUIStatus(text) {
    if (statusDiv) statusDiv.innerText = text;
}


let countdownInterval = null;

function toggleAutoScroll(btn) {
    if (scrollInterval) {
        // TURN OFF
        clearTimeout(scrollInterval);
        clearInterval(countdownInterval);
        scrollInterval = null;
        countdownInterval = null;

        btn.innerText = "⇩ Scroll OFF";
        btn.style.background = "#333";
        btn.style.color = "#fff";
        // //console.log('[PHASE-1] Auto-Scroll OFF');
    } else {
        // TURN ON
        btn.style.background = "#00ffcc";
        btn.style.color = "#000";
        //console.log('[PHASE-1] Auto-Scroll ON');

        const loop = () => {
            if (STATE.running && !STATE.paused) {
                window.scrollTo(0, document.body.scrollHeight);
                btn.innerText = "⇩ Scrolling...";
            }

            // Random delay between 5000ms and 10000ms
            const delay = Math.floor(Math.random() * 5000) + 5000;
            let secondsLeft = Math.floor(delay / 1000);

            // Countdown visual update
            btn.innerText = `Next in ${secondsLeft}s`;

            clearInterval(countdownInterval);
            countdownInterval = setInterval(() => {
                secondsLeft--;
                if (secondsLeft > 0) {
                    btn.innerText = `Next in ${secondsLeft}s`;
                } else {
                    clearInterval(countdownInterval);
                    btn.innerText = "⇩ Scrolling...";
                }
            }, 1000);

            scrollInterval = setTimeout(loop, delay);
        };

        loop();
    }
}


function createUI() {
    const p = document.createElement('div');
    p.style = `
      position:fixed;
      bottom:20px;
      right:20px;
      z-index:999999;
      background:#111;
      color:#fff;
      padding:12px;
      border-radius:8px;
      font-family:monospace;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      border: 1px solid #333;
      min-width: 180px;
    `;

    p.innerHTML = `
      <div style="margin-bottom:8px;font-weight:bold;color:#00ffcc;border-bottom:1px solid #333;padding-bottom:5px;">Phase-1 Extension</div>
      
      <div style="display:flex;gap:5px;margin-bottom:8px;">
          <button id="p1-start" style="cursor:pointer;flex:1;background:#222;color:#fff;border:1px solid #444;padding:4px;border-radius:4px;">▶ Start</button>
          <button id="p1-pause" style="cursor:pointer;flex:1;background:#222;color:#fff;border:1px solid #444;padding:4px;border-radius:4px;">⏸ Pause</button>
          <button id="p1-stop" style="cursor:pointer;flex:1;background:#222;color:#fff;border:1px solid #444;padding:4px;border-radius:4px;">⏹ Stop</button>
      </div>

      <button id="p1-scroll" style="cursor:pointer;width:100%;margin-bottom:8px;background:#333;color:#fff;border:1px solid #444;padding:6px;border-radius:4px;font-weight:bold;">⇩ Scroll OFF</button>

      <div id="p1-status" style="font-size:12px;color:#aaa;text-align:center;">Idle</div>
    `;

    document.body.appendChild(p);

    statusDiv = p.querySelector('#p1-status');

    p.querySelector('#p1-start').onclick = () => {
        STATE.running = true;
        STATE.paused = false;
        updateUIStatus('Running...');
        //console.log('[PHASE-1] ▶ START');
    };

    p.querySelector('#p1-pause').onclick = () => {
        STATE.paused = !STATE.paused;
        updateUIStatus(STATE.paused ? 'Paused' : 'Running');
    };

    p.querySelector('#p1-stop').onclick = () => {
        STATE.running = false;
        updateUIStatus('Stopped');
        if (scrollInterval) {
            const btn = p.querySelector('#p1-scroll');
            toggleAutoScroll(btn); // Force stop scroll if running
        }
        //console.log('[PHASE-1] ⏹ STOP');
    };

    p.querySelector('#p1-scroll').onclick = function () {
        toggleAutoScroll(this);
    };
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    createUI();

    // Fetch initial status from server
    fetch('http://localhost:3000/status')
        .then(res => res.json())
        .then(data => {
            if (data && data.posts !== undefined) {
                updateUIStatus(`Saved: ${data.posts} | Dups: 0`);
            }
        })
        .catch(err => console.error("Failed to fetch initial status", err));
}

//console.log('[Phase-1 Extension] Content Script Loaded');
