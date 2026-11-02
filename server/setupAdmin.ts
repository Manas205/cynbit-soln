import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { hashPassword } from './adminAuth.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'));
const args = process.argv.slice(2);
const email = args.find((arg) => !arg.startsWith('--')) || 'admin@example.com';
if (
  !z.email().safeParse(email).success ||
  args.some((arg) => arg.startsWith('--') && arg !== '--reset')
) {
  throw new Error('Usage: npm run admin:setup -- [email] [--reset]');
}
const path = process.env.ADMIN_CONFIG_PATH || resolve(root, 'data/admin.json');
if (process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD_HASH)
  throw new Error(
    'Admin credentials are configured through environment variables. Update those variables instead.',
  );
if (existsSync(path) && !args.includes('--reset'))
  throw new Error(
    'An admin account already exists. Use --reset to replace its password, then restart the server.',
  );
await mkdir(dirname(path), { recursive: true });
const password = randomBytes(18).toString('base64url');
await writeFile(
  path,
  JSON.stringify(
    { email: email.toLowerCase(), passwordHash: await hashPassword(password) },
    null,
    2,
  ) + '\n',
  {
    flag: args.includes('--reset') ? 'w' : 'wx',
    mode: 0o600,
  },
);
console.log(
  `Admin account created. Save this generated password in your password manager.\n\nEmail: ${email.toLowerCase()}\nPassword: ${password}\n\nRestart the app, then open /admin. Only the password hash is stored in ${path}.`,
);
