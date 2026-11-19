import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authBuckets, sessions, users } from "@/db/schema";
import { DEMO_VIEWER, SEED_PEOPLE } from "@/lib/social";

const COOKIE = "loop_session";
const SESSION_SECONDS = 60 * 60 * 24 * 14;
const reservedHandles = new Set([DEMO_VIEWER.handle, ...SEED_PEOPLE.map((profile) => profile.handle)]);
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, result) => error ? reject(error) : resolve(result));
});

export class AppError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function apiError(error: unknown) {
  if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
  // Drizzle errors can carry query parameters; keep credentials and private content out of logs.
  const name = error instanceof Error ? error.name : "UnknownError";
  const cause = error instanceof Error ? error.cause : null;
  const code = cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string" && /^[A-Z0-9]{5}$/.test(cause.code) ? cause.code : undefined;
  console.error("Loop request failed", { name, code });
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export const field = (body: Record<string, unknown>, key: string) => typeof body[key] === "string" ? body[key] as string : "";
export const isUUID = (value: string) => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);

export function checkOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new AppError("Invalid request origin.", 403);
  if (!origin) return;
  let host: string;
  try { host = new URL(origin).host; } catch { throw new AppError("Invalid request origin.", 403); }
  if (![request.nextUrl.host, request.headers.get("host"), request.headers.get("x-forwarded-host")?.split(",")[0].trim()].includes(host)) {
    throw new AppError("Invalid request origin.", 403);
  }
}

export async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new AppError("Expected JSON.", 415);
  if (Number(request.headers.get("content-length")) > 12000) throw new AppError("Request is too large.", 413);
  const raw = await request.text();
  if (raw.length > 12000) throw new AppError("Request is too large.", 413);
  let value;
  try { value = JSON.parse(raw); } catch { throw new AppError("Invalid request."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("Invalid request.");
  return value;
}

export async function viewerId() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[\da-f]{64}$/.test(token)) return null;
  const [active] = await db.select({ userId: sessions.userId }).from(sessions)
    .where(and(eq(sessions.tokenHash, digest(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  return active?.userId ?? null;
}

const isHttps = (request: NextRequest) => request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https";

export async function loginCookie(request: NextRequest, userId: string) {
  const previous = request.cookies.get(COOKIE)?.value;
  if (previous && /^[\da-f]{64}$/.test(previous)) await db.delete(sessions).where(eq(sessions.tokenHash, digest(previous)));
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({ userId, tokenHash: digest(token), expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) });
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set(COOKIE, token, { httpOnly: true, secure: isHttps(request), sameSite: "lax", maxAge: SESSION_SECONDS, path: "/" });
  return response;
}

export async function logoutCookie(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;
  if (token && /^[\da-f]{64}$/.test(token)) await db.delete(sessions).where(eq(sessions.tokenHash, digest(token)));
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set(COOKIE, "", { httpOnly: true, secure: isHttps(request), sameSite: "lax", maxAge: 0, path: "/" });
  return response;
}

export async function throttle(key: string, limit: number, minutes: number) {
  const expiry = new Date(Date.now() + minutes * 60000);
  const [bucket] = await db.insert(authBuckets).values({ key: digest(key), expiresAt: expiry }).onConflictDoUpdate({
    target: authBuckets.key,
    set: {
      hits: sql`case when ${authBuckets.expiresAt} <= now() then 1 else least(${authBuckets.hits} + 1, ${limit + 1}) end`,
      expiresAt: sql`case when ${authBuckets.expiresAt} <= now() then ${expiry.toISOString()}::timestamptz else ${authBuckets.expiresAt} end`,
    },
  }).returning({ hits: authBuckets.hits });
  if (bucket.hits > limit) throw new AppError("Too many requests. Please wait a little before trying again.", 429);
}

export async function register(request: NextRequest, body: Record<string, unknown>) {
  const name = field(body, "name").trim(), handle = field(body, "handle").trim().toLowerCase();
  const email = field(body, "email").trim().toLowerCase(), password = field(body, "password");
  if (name.length < 2 || name.length > 48) throw new AppError("Use a name between 2 and 48 characters.");
  if (!/^[a-z0-9_]{3,24}$/.test(handle)) throw new AppError("Choose a username with 3–24 letters, numbers, or underscores.");
  if (reservedHandles.has(handle)) throw new AppError("That username is reserved. Choose another one.", 409);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("Enter a valid email address.");
  if (password.length < 8 || password.length > 128) throw new AppError("Use a password between 8 and 128 characters.");
  await throttle(`signup:${requestIp(request)}`, 12, 60);
  const salt = randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${(await derive(password, salt)).toString("hex")}`;
  const [created] = await db.insert(users).values({ name, handle, email, passwordHash }).onConflictDoNothing().returning({ id: users.id });
  if (!created) throw new AppError("That email or username is already registered.", 409);
  return loginCookie(request, created.id);
}

function requestIp(request: NextRequest) {
  return (request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local").slice(0, 80);
}

export async function signIn(request: NextRequest, body: Record<string, unknown>) {
  const email = field(body, "email").trim().toLowerCase();
  const password = field(body, "password");
  if (!email || email.length > 254 || !password || password.length > 128) throw new AppError("Enter your email and password.");
  await throttle(`login-ip:${requestIp(request)}`, 60, 15);
  await throttle(`login-email:${email}`, 12, 15);
  const [user] = await db.select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.email, email)).limit(1);
  const [salt, hash] = (user?.passwordHash ?? `${"0".repeat(32)}:${"0".repeat(128)}`).split(":");
  const valid = timingSafeEqual(await derive(password, salt), Buffer.from(hash, "hex"));
  if (!user || !valid) throw new AppError("That email or password doesn’t match.", 401);
  return loginCookie(request, user.id);
}
