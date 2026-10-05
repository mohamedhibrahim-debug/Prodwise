import { timingSafeEqual } from 'node:crypto';

export function validWorkerSecret(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header?.startsWith('Bearer ')) return false;
  const received = Buffer.from(header.slice(7)), expected = Buffer.from(secret);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
