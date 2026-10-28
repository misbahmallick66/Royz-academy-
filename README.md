# Royz Academy AI server

The website is the single file `../index.html` (open it on any phone or PC; the panel works without the server).
Only the AI chat needs this server.

1. Install Node 18+  2. Get a key at https://console.anthropic.com
3. `ANTHROPIC_API_KEY=your_key node server.js`  (Windows PowerShell: `$env:ANTHROPIC_API_KEY="your_key"; node server.js`)
4. Open http://localhost:3000  (the server serves index.html itself)

To use the chat when index.html is opened as a file or hosted elsewhere, deploy this folder
(Render, Railway, VPS...) and set `API_URL` near the top of the chat code in index.html to your server URL.
Never put the API key inside index.html.
