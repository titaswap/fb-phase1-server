import express from 'express';
import fs from 'fs';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const FILE = './phase1.json';

/* =========================
   SAFE LOAD
========================= */
function loadJSONSafe() {
    try {
        if (!fs.existsSync(FILE)) {
            fs.writeFileSync(FILE, '[]');
            return [];
        }

        const raw = fs.readFileSync(FILE, 'utf8').trim();
        if (!raw) {
            fs.writeFileSync(FILE, '[]');
            return [];
        }

        return JSON.parse(raw);
    } catch (e) {
        console.error('⚠️ JSON corrupted. Resetting file.');
        fs.writeFileSync(FILE, '[]');
        return [];
    }
}

let DATA = loadJSONSafe();

/* =========================
   SAVE PHASE-1 POST
========================= */
app.post('/phase1', (req, res) => {
    const post = req.body;

    if (!post || (!post.id && !post.post_link)) {
        return res.status(400).json({ ok: false });
    }

    const key = post.id || post.post_link;

    const exists = DATA.find(
        p => (p.id || p.post_link) === key
    );

    if (!exists) {
        DATA.push(post);
        fs.writeFileSync(FILE, JSON.stringify(DATA, null, 2));

        console.log(
            `✅ SAVED (${DATA.length}) | ${post.author} | ${key}`
        );
    }

    res.json({
        ok: true,
        total: DATA.length,
        saved: !exists
    });
});

/* =========================
   STATUS
========================= */
app.get('/status', (_, res) => {
    res.json({
        posts: DATA.length
    });
});

app.listen(3000, () => {
    console.log('🚀 Phase-1 Server running at http://localhost:3000');
});
