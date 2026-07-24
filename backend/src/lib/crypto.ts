import crypto from 'crypto';

const ENCRYPTION_KEY_BASE64 = process.env.ENCRYPTION_KEY as string;
if (!ENCRYPTION_KEY_BASE64) {
  throw new Error("ENCRYPTION_KEY environment variable is required and must not be empty");
}

const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_BASE64, 'base64');
if (ENCRYPTION_KEY.length !== 32) {
  throw new Error("ENCRYPTION_KEY must be a 32-byte base64-encoded string");
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'base64')
  ]);
  return combined.toString('base64');
}

export function decrypt(ciphertext: string): string {
  const combined = Buffer.from(ciphertext, 'base64');
  if (combined.length < 28) {
    throw new Error('Invalid ciphertext length');
  }
  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const encrypted = combined.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
