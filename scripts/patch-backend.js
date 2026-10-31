import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/config.js';

export function patchBackend(directory = path.join(ROOT, 'vendor', 'LawinServer')) {
  const index = path.join(directory, 'index.js');
  let source = fs.readFileSync(index, 'utf8');
  if (!source.includes('/local/health')) {
    source = source.replace('express.use(Express.json());', `// Local launcher adaptation: expose readiness and sanitized request diagnostics.\nexpress.get('/local/health', (req, res) => res.status(global.localXmppReady ? 200 : 503).json({ service: 'fortnite-backend-local', ready: !!global.localXmppReady }));\nexpress.use((req, res, next) => { console.log('[HTTP]', req.method, req.path); next(); });\nexpress.use(Express.json());`);
  }
  source = source.replace('express.listen(port, () => {', "express.listen(port, '127.0.0.1', () => {");
  source = source.replace('process.exit(0);', 'process.exit(1);');
  fs.writeFileSync(index, source);
  const xmpp = path.join(directory, 'structure', 'xmpp.js');
  source = fs.readFileSync(xmpp, 'utf8');
  source = source.replace('const port = 80;', 'const port = Number(process.env.XMPP_PORT || 80);');
  source = source.replace('new WebSocket({ port: port }, () => console.log("XMPP and Matchmaker started listening on port", port))', "new WebSocket({ port: port, host: '127.0.0.1' }, () => { global.localXmppReady = true; console.log('XMPP and Matchmaker started listening on port', port); })");
  source = source.replace('console.log("XMPP and Matchmaker \\x1b[31mFAILED\\x1b[0m to start hosting.");', "console.error('XMPP konnte nicht starten:', err.message); process.exit(1);");
  fs.writeFileSync(xmpp, source);
}
