import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../server/adminAuth.ts';

test('development server blocks private files through normal and Vite filesystem URLs', async (t) => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const directory = await mkdtemp(join(root, '.admin-server-test-'));
  const configPath = join(directory, 'credentials.json');
  const databasePath = join(directory, 'records.db');
  await writeFile(
    configPath,
    JSON.stringify({
      email: 'admin@example.com',
      passwordHash: await hashPassword('test-password-only'),
    }),
  );
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/server.ts'], {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: '0',
      HOST: '127.0.0.1',
      DATABASE_PATH: databasePath,
      ADMIN_CONFIG_PATH: configPath,
      ADMIN_EMAIL: '',
      ADMIN_PASSWORD_HASH: '',
      ADMIN_ORIGIN: '',
      ADMIN_SECURE_COOKIES: 'false',
    },
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, 'exit');
      child.kill();
      await stopped;
    }
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  let logs = '';
  child.stderr.on('data', (chunk) => {
    logs += chunk.toString();
  });
  const origin = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${logs}`)), 20_000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', () => {
      clearTimeout(timer);
      reject(new Error(`Server exited before startup: ${logs}`));
    });
    child.stdout.on('data', (chunk) => {
      const match = chunk.toString().match(/ready at (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
  });
  const paths: string[] = [];
  for (const path of [configPath, databasePath]) {
    paths.push(`/${relative(root, path).replaceAll('\\', '/')}`);
    paths.push(`/@fs/${path.replaceAll('\\', '/')}`);
  }
  for (const path of paths) {
    const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(5000) });
    assert.ok(
      [403, 404].includes(response.status),
      `${path} must not be downloadable (received ${response.status})`,
    );
  }
  const session = await fetch(`${origin}/api/admin/session`);
  assert.deepEqual(await session.json(), { configured: true, authenticated: false });
  assert.equal((await fetch(`${origin}/admin`)).status, 200);
  assert.equal((await fetch(`${origin}/api/admin/inquiries`)).status, 401);
});
