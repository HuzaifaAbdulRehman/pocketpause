import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createAppServer } from '../src/server.ts';
import { createGenerator } from '../src/ollama.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
let server;
if (process.argv[2] === 'test') {
  server = createAppServer({ generate: createGenerator(), distDir: fileURLToPath(new URL('../dist/', import.meta.url)) });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(3000, '127.0.0.1', resolve);
  });
}
const child = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/playwright/cli.js', import.meta.url)), ...process.argv.slice(2)], {
  cwd: root, stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: fileURLToPath(new URL('../.tools/browsers/', import.meta.url)) },
});
function finish(code) {
  process.exitCode = code;
  server?.closeAllConnections();
  server?.close();
}
child.once('error', error => { console.error(error.message); finish(1); });
child.once('exit', code => finish(code ?? 1));
process.once('SIGINT', () => { child.kill(); finish(130); });
process.once('SIGTERM', () => { child.kill(); finish(143); });
