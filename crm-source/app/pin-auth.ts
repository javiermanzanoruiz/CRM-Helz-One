import { pinOnlyEnabled, pinOnlyOwnerId, pinOnlyReady } from "./pin-only";
import { cookies } from "next/headers";
import { env } from "cloudflare:workers";

const COOKIE = "helzone_crm_session";
const SESSION_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();

function b64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromB64url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signingKey() {
  const secret = (env as unknown as Record<string, string | undefined>).CRM_SESSION_SECRET;
  if (!secret) throw new Error("CRM_SESSION_SECRET is not configured.");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createPinSession() {
  const payload = b64url(encoder.encode(JSON.stringify({ owner: "helzone", exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(payload)));
  return `${payload}.${b64url(signature)}`;
}

export async function pinSessionIsValid(value?: string) {
  if (!value || (pinOnlyEnabled() && !pinOnlyReady())) return false;
  const [payload, encodedSignature, extra] = value.split(".");
  if (!payload || !encodedSignature || extra) return false;
  try {
    const verified = await crypto.subtle.verify("HMAC", await signingKey(), fromB64url(encodedSignature), encoder.encode(payload));
    if (!verified) return false;
    const decoded = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { owner?: string; exp?: number };
    return decoded.owner === "helzone" && typeof decoded.exp === "number" && decoded.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function getPinOwnerId() {
  const session = (await cookies()).get(COOKIE)?.value;
  return (await pinSessionIsValid(session)) ? (pinOnlyEnabled() ? pinOnlyOwnerId() : "helzone-javier") : null;
}

export const pinCookieName = COOKIE;
export const pinSessionMaxAge = SESSION_SECONDS;
