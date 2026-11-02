import type { IncomingMessage, ServerResponse } from 'node:http';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(value));
}

export async function body(req: IncomingMessage, maxSize = 48_000): Promise<unknown> {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json')
    throw new HttpError(415, 'Send JSON data.');
  if (Number(req.headers['content-length'] || 0) > maxSize)
    throw new HttpError(413, 'The request is too large.');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxSize) throw new HttpError(413, 'The request is too large.');
    chunks.push(Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'The request contains invalid JSON.');
  }
}
