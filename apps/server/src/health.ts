import type http from 'node:http';

/** Minimal liveness handler for servers with no other request handling. */
export function healthHandler(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } else {
    res.writeHead(404);
    res.end();
  }
}

/**
 * Add GET /health to a server that already has request listeners (e.g. the
 * @jambonz/sdk endpoint, which answers OPTIONS/405 unconditionally). Wraps the
 * existing listeners so exactly one handler responds per request — two parallel
 * listeners would both write the response.
 */
export function addHealthRoute(server: http.Server): void {
  const existing = server.listeners('request') as Array<(req: http.IncomingMessage, res: http.ServerResponse) => void>;
  server.removeAllListeners('request');
  server.on('request', (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    for (const listener of existing) listener(req, res);
  });
}
