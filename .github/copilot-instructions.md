# AI Coding Guidelines for fb-phase1-server

## Architecture Overview
This is a simple Node.js Express server for collecting Facebook post data in a Facebook group scraping pipeline. It provides REST endpoints to store posts and retrieve status, using file-based JSON storage for simplicity.

**Key Components:**
- `server.js`: Main Express server with POST /phase1 and GET /status endpoints
- `phase1.json`: JSON file storing array of post objects (initialized empty if missing)
- No database; data persists in JSON file with in-memory operations

**Data Flow:**
- POST requests to /phase1 save new posts if not duplicates (checked by `id` or `post_link`)
- Data written immediately to `phase1.json` with pretty-printing
- GET /status returns current post count

## Developer Workflows
- **Start Server:** `node server.js` (listens on port 3000)
- **Data Persistence:** Posts saved to `phase1.json`; survives restarts
- **No Build/Test Process:** Direct Node execution; no npm scripts defined
- **Debugging:** Console logs saves; check `phase1.json` for data

## Code Conventions
- **Modules:** ES modules (`import`/`export`); `"type": "module"` in package.json
- **JSON Handling:** Use `JSON.stringify(data, null, 2)` for readable file output
- **Duplicate Prevention:** Check existing posts by `post.id || post.post_link`
- **Error Handling:** Basic validation; return `{ok: false}` for invalid requests
- **CORS:** Enabled globally; JSON body limit 10mb for large payloads

## Patterns & Examples
- **Post Saving Logic** (from server.js):
  ```javascript
  const key = post.id || post.post_link;
  const exists = DATA.find(p => (p.id || p.post_link) === key);
  if (!exists) {
      DATA.push(post);
      fs.writeFileSync(FILE, JSON.stringify(DATA, null, 2));
  }
  ```
- **File Initialization:** Create empty array if `phase1.json` missing
- **Response Format:** `{ok: true, total: DATA.length}` for success

## Dependencies
- `express`: Server framework
- `cors`: Cross-origin support
- `fs`: File system operations (built-in)

Focus on simplicity; avoid over-engineering for this data collection phase.