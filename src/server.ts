import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseRequest } from './domain.ts';
import type { ActivityCard, ActivityRequest } from './domain.ts';
import { createGenerator, GenerationError } from './ollama.ts';

class BodyError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

function json(res: ServerResponse, status: number, body: unknown) {
  if (res.destroyed) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const cleanup = () => {
      clearTimeout(timer);
      req.removeListener('data', data);
      req.removeListener('end', end);
      req.removeListener('error', fail);
      req.removeListener('aborted', aborted);
    };
    const fail = (error: Error) => { cleanup(); req.resume(); reject(error); };
    const aborted = () => fail(new BodyError(400, 'The request was interrupted.'));
    const data = (chunk: Buffer) => {
      size += chunk.length;
      if (size > 2048) fail(new BodyError(413, 'The request is too large.'));
      else chunks.push(chunk);
    };
    const end = () => { cleanup(); resolveBody(Buffer.concat(chunks).toString('utf8')); };
    const timer = setTimeout(() => fail(new BodyError(408, 'The request took too long.')), 5000);
    req.on('data', data).once('end', end).once('error', fail).once('aborted', aborted);
  });
}

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2',
};

export function createAppServer(options: {
  generate: (request: ActivityRequest) => Promise<ActivityCard>; distDir: string;
}): Server {
  let busy = false;
  const server = createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    void handle(req, res).catch(() => json(res, 500, { error: 'The local server could not handle the request.' }));
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 30;

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const port = req.socket.localPort;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    const origins = hosts.map(host => `http://${host}`);
    if (process.env.NODE_ENV === 'development') origins.push('http://127.0.0.1:5173', 'http://localhost:5173');
    if (!hosts.includes(req.headers.host ?? '') ||
      (req.headers.origin !== undefined && !origins.includes(req.headers.origin))) {
      req.resume();
      return json(res, 403, { error: 'Only local requests are allowed.' });
    }
    const path = req.url?.split('?')[0] ?? '/';
    if (path === '/api/activity') {
      if (req.method !== 'POST') { req.resume(); return json(res, 405, { error: 'Use POST for generation.' }); }
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) {
        req.resume(); return json(res, 415, { error: 'Send a JSON request.' });
      }
      let input: ActivityRequest;
      try { input = parseRequest(JSON.parse(await readBody(req))); }
      catch (error) {
        return json(res, error instanceof BodyError ? error.status : 400,
          { error: error instanceof BodyError ? error.message : 'Choose a supported duration and surroundings.' });
      }
      if (busy) return json(res, 409, { error: 'An activity is already being generated. Wait and try again.' });
      busy = true;
      try { json(res, 200, await options.generate(input)); }
      catch (error) {
        const timeout = error instanceof GenerationError && error.code === 'timeout';
        json(res, timeout ? 504 : 502, { error: timeout ?
          'The local model took too long. Try again or use a smaller local model.' :
          'Could not generate an activity. Check Ollama and the model, then try again.' });
      } finally { busy = false; }
      return;
    }
    if (path.startsWith('/api/')) return json(res, 404, { error: 'Route not found.' });
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.resume(); return json(res, 405, { error: 'Use GET for the app.' });
    }
    const asset = /^\/assets\/[a-zA-Z0-9_-]+\.(js|css|svg|png|woff2)$/.test(path);
    if (path !== '/' && path !== '/index.html' && !asset) return json(res, 404, { error: 'File not found.' });
    try {
      const root = await realpath(options.distDir);
      const file = await realpath(join(root, path === '/' ? 'index.html' : path.slice(1)));
      const within = relative(root, file);
      if (within.startsWith(`..${sep}`) || within === '..' || resolve(root, within) !== file) {
        return json(res, 404, { error: 'File not found.' });
      }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store', 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { json(res, 404, { error: 'Build the app first, or check the requested file.' }); }
  }
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = createAppServer({ generate: createGenerator({ model: process.env.POCKETPAUSE_MODEL }),
    distDir: fileURLToPath(new URL('../dist/', import.meta.url)) });
  server.listen(3000, '127.0.0.1', () => console.log('PocketPause: http://127.0.0.1:3000'));
}
