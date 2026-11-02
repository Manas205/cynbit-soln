import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const derive = promisify(scrypt);
const credentialsSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    passwordHash: z.string().regex(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/),
  })
  .strict();
export type AdminCredentials = z.infer<typeof credentialsSchema>;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await derive(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [, salt, expected] = stored.split('$');
  const actual = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

export async function loadAdminCredentials(path: string): Promise<AdminCredentials | undefined> {
  let value: unknown;
  if (process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD_HASH) {
    value = { email: process.env.ADMIN_EMAIL, passwordHash: process.env.ADMIN_PASSWORD_HASH };
  } else {
    try {
      value = JSON.parse(await readFile(path, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw new Error('Unable to read admin configuration. Run npm run admin:setup -- --reset.');
    }
  }
  const parsed = credentialsSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      'Invalid admin credentials. Check the admin setup or environment configuration.',
    );
  return parsed.data;
}
