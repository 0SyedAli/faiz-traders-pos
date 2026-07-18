import { offlineDb } from "@/lib/offline-db";

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const randomSalt = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const hashPassword = async (password: string, salt: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(salt),
      iterations: 150_000,
    },
    key,
    256,
  );

  return toHex(bits);
};

export const cacheOfflineLogin = async (
  email: string,
  password: string,
  token: string,
  admin: { id: string; name: string; email: string; role: string },
) => {
  const normalizedEmail = email.trim().toLowerCase();
  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);

  await offlineDb.auth.put({
    email: normalizedEmail,
    salt,
    passwordHash,
    token,
    admin,
    updatedAt: new Date().toISOString(),
  });
};

export const verifyOfflineLogin = async (email: string, password: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const row = await offlineDb.auth.get(normalizedEmail);
  if (!row) return null;

  const candidate = await hashPassword(password, row.salt);
  if (candidate !== row.passwordHash) return null;

  return { token: row.token, admin: row.admin };
};
