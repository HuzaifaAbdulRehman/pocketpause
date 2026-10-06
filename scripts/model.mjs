import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
if (process.platform !== 'win32') throw new Error('This standalone launcher is for the verified Windows setup. On other systems, run local Ollama separately.');
const command = process.argv[2];
if (!['serve', 'pull', '--version'].includes(command)) throw new Error('Use serve, pull or --version.');
const root = fileURLToPath(new URL('../', import.meta.url));
const profile = fileURLToPath(new URL('../.tools/ollama-profile/', import.meta.url));
const models = fileURLToPath(new URL('../.models/', import.meta.url));
await mkdir(profile, { recursive: true });
await mkdir(models, { recursive: true });
const child = spawn(fileURLToPath(new URL('../.tools/ollama-v0.40.0/ollama.exe', import.meta.url)),
  command === 'pull' ? ['pull', process.env.POCKETPAUSE_MODEL ?? 'qwen3:1.7b'] : [command], {
    cwd: root, stdio: command === 'serve' ? 'ignore' : 'inherit', windowsHide: true,
    env: { ...process.env, USERPROFILE: profile, OLLAMA_MODELS: models, OLLAMA_HOST: '127.0.0.1:11434',
      OLLAMA_NO_CLOUD: '1', OLLAMA_NUM_PARALLEL: '1', OLLAMA_NOHISTORY: '1', OLLAMA_MAX_LOADED_MODELS: '1' },
  });
if (command === 'serve') console.log('Starting project-local Ollama on 127.0.0.1:11434. Stop with Ctrl+C.');
child.once('error', error => { console.error(error.message); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
process.once('SIGINT', () => child.kill());
process.once('SIGTERM', () => child.kill());
