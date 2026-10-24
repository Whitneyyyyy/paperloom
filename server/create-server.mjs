import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createLibraryHandler } from '../lib/library-service.mjs';
import { openStorage, containedPath } from './storage.mjs';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
};
const security = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'Permissions-Policy': 'translator=(self)',
};

/** Local single-user server. Binding is intentionally fixed to the loopback interface. */
export async function createPaperloomServer({
  dataDir = resolve('data'),
  port = 3000,
  crossref = true,
} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw Error('PAPERLOOM_PORT must be a valid port');
  const storage = await openStorage(dataDir);
  const options = crossref
    ? {}
    : {
        publicationFetch: async () => {
          throw Error('Crossref disabled by configuration');
        },
      };
  const handler = createLibraryHandler(storage, async () => storage.user, options);
  let activePort = port;
  const server = createServer(async (incoming, outgoing) => {
    for (const [key, value] of Object.entries(security)) outgoing.setHeader(key, value);
    const send = (status, text) => {
      outgoing.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      outgoing.end(text);
    };
    try {
      // Do not trust forwarded identity or host headers. This is a local application.
      const authority = incoming.headers.host || '';
      if (
        ![`127.0.0.1:${activePort}`, `localhost:${activePort}`].includes(authority.toLowerCase())
      ) {
        send(403, 'Unexpected host');
        return;
      }
      const url = new URL(incoming.url || '/', `http://${authority}`);
      if (url.origin !== `http://${authority}`) {
        send(403, 'Unexpected request origin');
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        const method = incoming.method || 'GET',
          body = ['GET', 'HEAD'].includes(method) ? undefined : Readable.toWeb(incoming);
        const request = new Request(url, {
          method,
          headers: incoming.headers,
          ...(body ? { body, duplex: 'half' } : {}),
        });
        const response = await handler(request);
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
        if (method === 'HEAD' || !response.body) outgoing.end();
        else await pipeline(Readable.fromWeb(response.body), outgoing);
        return;
      }
      if (url.pathname === '/health' && incoming.method === 'GET') {
        outgoing.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        outgoing.end('{"status":"ok"}');
        return;
      }
      if (!['GET', 'HEAD'].includes(incoming.method)) {
        send(405, 'Method not allowed');
        return;
      }
      let relative;
      try {
        relative = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
      } catch {
        send(400, 'Invalid path');
        return;
      }
      if (relative.includes('\\') || relative.split('/').some((part) => part.startsWith('.'))) {
        send(404, 'Not found');
        return;
      }
      const target = containedPath(publicDir, relative);
      let actual;
      try {
        actual = await realpath(target);
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
          send(404, 'Not found');
          return;
        }
        throw error;
      }
      if (!actual.startsWith(resolve(publicDir) + sep)) {
        send(404, 'Not found');
        return;
      }
      let bytes;
      try {
        bytes = await readFile(actual);
      } catch (error) {
        if (error.code === 'EISDIR') {
          send(404, 'Not found');
          return;
        }
        throw error;
      }
      outgoing.writeHead(200, {
        'Content-Type': types[extname(actual)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Content-Length': bytes.length,
      });
      outgoing.end(incoming.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      if (!outgoing.headersSent) send(500, 'Request could not be completed');
      else outgoing.destroy();
      console.error('Local request failed:', error.code || error.name);
    }
  });
  server.requestTimeout = 60000;
  server.headersTimeout = 15000;
  return {
    server,
    storage,
    async start() {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', resolve);
      });
      activePort = server.address().port;
      return `http://127.0.0.1:${activePort}`;
    },
    async close() {
      if (server.listening) {
        server.closeIdleConnections();
        await new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
      storage.close();
    },
  };
}
