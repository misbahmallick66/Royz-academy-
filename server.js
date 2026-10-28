/* Royz Academy backend: serves the site + secure proxy to the Claude API.
   Zero dependencies. Needs Node 18+.  Run: ANTHROPIC_API_KEY=sk-... npm start */
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3000;
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const PAGE = path.join(__dirname, '..', 'index.html');

const SYSTEM = `You are Royz Assistant, the built-in AI of the Royz Academy admin & teacher portal (Kolkata, India).
Talk like a warm, natural person: greet back, say goodbye, match the user's language (English, Hindi, Bengali or Hinglish) and tone. Be concise.
You are a full general-purpose AI: answer ANY question (study help, writing, maths, coding, advice), not only portal topics.
You also have a live JSON snapshot of the academy's data (students, fees, attendance, courses, staff, enquiries, announcements) and the portal's pages. Use it for questions like "who has unpaid fees?" or "how many students are in Class 10?". Quote real names and numbers from it; never invent records. If data is missing, say so.
Portal how-to: add/edit students in Students; mark attendance in Attendance; record payments in Fees & Payments; manage courses, staff, announcements, enquiries, reports and backups from the sidebar. Data is stored in this browser only.
You cannot change data yourself; tell the user which button to press. Format with short paragraphs, **bold**, and simple lists. Amounts are in ₹.`;

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', ...CORS }); res.end(JSON.stringify(obj)); };

const hits = new Map(); // simple per-IP rate limit: 30 msgs / minute
const limited = ip => { const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 6e4); a.push(now); hits.set(ip, a); return a.length > 30; };

async function chat(req, res) {
  if (!KEY) return send(res, 500, { error: 'ANTHROPIC_API_KEY is not set on the server' });
  if (limited(req.socket.remoteAddress)) return send(res, 429, { error: 'Too many messages, wait a minute' });
  let raw = ''; for await (const c of req) { raw += c; if (raw.length > 2e6) return send(res, 413, { error: 'Request too large' }); }
  let body; try { body = JSON.parse(raw); } catch { return send(res, 400, { error: 'Bad JSON' }); }
  const messages = (body.messages || []).slice(-20).filter(m => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string');
  if (!messages.length || messages[0].role !== 'user') return send(res, 400, { error: 'Invalid messages' });
  const system = SYSTEM + '\n\nLIVE PORTAL DATA:\n' + JSON.stringify(body.context || {}).slice(0, 150000);
  const up = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1200, system, messages, stream: true })
  }).catch(() => null);
  if (!up || !up.ok) return send(res, 502, { error: 'AI service error' + (up ? ' ' + up.status : '') });
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', ...CORS });
  for await (const chunk of up.body) res.write(chunk);
  res.end();
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (req.method === 'POST' && req.url === '/api/chat') return chat(req, res).catch(() => res.headersSent ? res.end() : send(res, 500, { error: 'Server error' }));
  if (req.url === '/' || req.url === '/index.html') return fs.readFile(PAGE, (err, d) => { res.writeHead(err ? 404 : 200, { 'Content-Type': 'text/html' }); res.end(err ? 'index.html not found' : d); });
  send(res, 404, { error: 'Not found' });
}).listen(PORT, () => console.log(`Royz Academy running at http://localhost:${PORT}` + (KEY ? '' : '  (WARNING: ANTHROPIC_API_KEY not set)')));
