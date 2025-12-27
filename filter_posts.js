import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_GROUP_ID = '571527207077914';
const INPUT_FILE = path.join(__dirname, 'phase1.json');
const REMOVED_FILE = path.join(__dirname, 'removed_posts.json');

console.log('🔄 Starting Group Post Filter...');

if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ File not found: ${INPUT_FILE}`);
    process.exit(1);
}

try {
    const rawData = fs.readFileSync(INPUT_FILE, 'utf8');

    // Handle empty file case
    if (!rawData.trim()) {
        console.log('⚠️ phase1.json is empty.');
        process.exit(0);
    }

    const posts = JSON.parse(rawData);
    console.log(`📊 Total posts loaded: ${posts.length}`);

    const validPosts = [];
    const removedPosts = [];

    posts.forEach(post => {
        const link = post.post_link || '';
        // Check if the link contains the TARGET_GROUP_ID
        if (link.includes(TARGET_GROUP_ID)) {
            validPosts.push(post);
        } else {
            removedPosts.push(post);
        }
    });

    // 1. Save Valid Posts back to phase1.json
    fs.writeFileSync(INPUT_FILE, JSON.stringify(validPosts, null, 2));

    // 2. Save Removed Posts to removed_posts.json
    // If removed_posts.json already exists, we could append, but for now we write new/overwrite as "moved" implies taking them out.
    // If you want to merge with existing removed file:
    let finalRemoved = removedPosts;
    if (fs.existsSync(REMOVED_FILE)) {
        try {
            const existingRemoved = JSON.parse(fs.readFileSync(REMOVED_FILE, 'utf8'));
            if (Array.isArray(existingRemoved)) {
                finalRemoved = existingRemoved.concat(removedPosts);
            }
        } catch (e) {
            // Ignore if exist file is corrupt
            console.log('⚠️ Could not read existing removed_posts.json, overwriting.');
        }
    }

    if (finalRemoved.length > 0) {
        fs.writeFileSync(REMOVED_FILE, JSON.stringify(finalRemoved, null, 2));
    }

    console.log('------------------------------------------------');
    console.log(`✅ KEPT (Matched Group ID): ${validPosts.length}`);
    console.log(`🚫 MOVED (Non-Matching):   ${removedPosts.length}`);
    console.log(`📂 Removed posts saved to: ${REMOVED_FILE}`);
    console.log('------------------------------------------------');

} catch (error) {
    console.error('❌ Error processing JSON:', error);
}
