import "server-only";
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";

const scrypt = promisify(scryptCallback);

export const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // ~6 months

// A guest never gets a database row — this is the whole identity. It's
// created client-side-triggered (via /api/auth/guest) only when someone
// explicitly chooses "Continue as a guest", never planted silently on
// first page load.
export type Identity =
  | { kind: "admin" }
  | { kind: "user"; id: string; username: string }
  | { kind: "guest"; id: string };

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

// The dev fallback is intentionally fixed and public (it's right here in
// source) — signing with it is no better than not signing at all, but it
// keeps `npm run dev` working without setup. Production must set its own.
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing SESSION_SECRET environment variable.");
  }
  return "dev-only-insecure-session-secret-do-not-use-in-production";
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Signs an identity into an opaque cookie value ("payload.signature", both base64url). */
export function signIdentity(identity: Identity): string {
  const payload = Buffer.from(JSON.stringify(identity), "utf8").toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/** Verifies a cookie value produced by signIdentity, rejecting anything tampered with or malformed. */
export function verifySessionValue(value: string | undefined | null): Identity | null {
  if (!value) return null;
  const separatorIndex = value.lastIndexOf(".");
  if (separatorIndex === -1) return null;
  const payload = value.slice(0, separatorIndex);
  const signature = value.slice(separatorIndex + 1);

  const expected = createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Identity;
  } catch {
    return null;
  }
}

/** Reads and verifies the current request's session cookie. Server Components + Route Handlers only. */
export async function getIdentity(): Promise<Identity | null> {
  const store = await cookies();
  return verifySessionValue(store.get(SESSION_COOKIE)?.value);
}

/** Sets the signed session cookie. Route Handlers / Server Functions only (cookies() write restriction). */
export async function setIdentityCookie(identity: Identity): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, signIdentity(identity), sessionCookieOptions);
}

export async function clearIdentityCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Checks credentials against the env-configured admin account (never stored in the database). */
export function checkAdminCredentials(username: string, password: string): boolean {
  const isDev = process.env.NODE_ENV !== "production";
  const envUser = process.env.APP_ADMIN_USERNAME ?? (isDev ? "admin" : undefined);
  const envPass = process.env.APP_ADMIN_PASSWORD ?? (isDev ? "admin" : undefined);
  if (!envUser || !envPass) return false;
  return safeEqual(username, envUser) && safeEqual(password, envPass);
}

const SCRYPT_KEY_LENGTH = 64;

/** Hashes a password as "salt:derivedKey" (both hex) using scrypt with a random per-password salt. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const separatorIndex = stored.indexOf(":");
  if (separatorIndex === -1) return false;
  const salt = stored.slice(0, separatorIndex);
  const hashHex = stored.slice(separatorIndex + 1);
  const derived = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  const hashBuf = Buffer.from(hashHex, "hex");
  if (derived.length !== hashBuf.length) return false;
  return timingSafeEqual(derived, hashBuf);
}
