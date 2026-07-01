import type http from 'node:http';

/** Minimal liveness handler shared by both HTTP servers. */
export function healthHandler(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } else {
    res.writeHead(404);
    res.end();
  }
}
