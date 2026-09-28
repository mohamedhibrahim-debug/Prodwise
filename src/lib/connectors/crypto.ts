import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Tokens are sealed with AES-256-GCM before they are stored. The associated data
 * binds a ciphertext to its organization, person and provider, so a sealed value
 * copied to another row cannot be opened there.
 */
export function tokenKey(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  const key = Buffer.from(raw.trim(), "base64");
  return key.length === 32 ? key : null;
}

export function seal(key: Buffer, value: unknown, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return `v1.${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url")}`;
}

export function open<T>(key: Buffer, sealed: string, aad: string): T {
  if (!sealed.startsWith("v1.")) throw new Error("SEALED_FORMAT");
  const raw = Buffer.from(sealed.slice(3), "base64url");
  if (raw.length < 29) throw new Error("SEALED_FORMAT");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")) as T;
}
