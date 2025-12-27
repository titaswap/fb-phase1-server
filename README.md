# FB Phase-1 Server & Extension

This project contains a localized Facebook Group Post Scraper. It consists of a **Node.js Server** to save data locally and a **Chrome Extension** to capture posts from the browser.

## 📂 Project Structure

- `server.js`: Node.js server to receive data and save it to `phase1.json`.
- `fb-phase1-extension/`: The Chrome Extension folder (Manifest V3).
- `phase1.js`: (Legacy) Tampermonkey script version.
- `phase1.json`: The database file where posts are saved.

## 🚀 How to Install & Run

### Step 1: Start the Local Server
1. Open this folder in VS Code or Terminal.
2. Install dependencies (if not done yet):
   ```bash
   npm install
   ```
3. Run the server:
   ```bash
   node server.js
   ```
   > The server will run at `http://localhost:3000`. Keep this terminal open.

### Step 2: Install the Chrome Extension
1. Open Google Chrome.
2. Go to `chrome://extensions/`.
3. Enable **Developer mode** (top right switch).
4. Click **Load unpacked**.
5. Select the `fb-phase1-extension` folder inside this project.

### Step 3: Start Scraping
1. Go to any **Facebook Group** page.
2. You will see a control panel on the bottom-right.
3. Click **▶ Start**.
4. (Optional) Click **⇩ Scroll OFF** to enable **Auto-Scroll**.
   - It will scroll randomly every 5-10 seconds to simulate human behavior.
   - It shows a live countdown for the next scroll.
5. The extension will automatically capture posts and save them to `phase1.json`.

## 📊 Features
- **Auto-Scroll**: Random intervals (5-10s) to avoid bans.
- **Live Counter**: Shows total saved posts and skipped duplicates in real-time.
- **Data Persistence**: Saves text, author, date, link, and comment counts.

## ⚠️ Notes
- Make sure `node server.js` is running, otherwise data cannot be saved.
- If you stop the server, just run `node server.js` again.
