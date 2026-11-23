import { accessEnabled, accessIdentity, accessOwnerId } from "./access-identity";
import { cookies } from "next/headers";
import { env } from "cloudflare:workers";

export type ProfessionalRole = "fisioterapia" | "podologia";
const COOKIE = "helzone_professional_session";
const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

function b64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromB64url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signingKey() {
  const secret = (env as unknown as Record<string, string | undefined>).CRM_SESSION_SECRET;
  if (!secret) throw new Error("CRM_SESSION_SECRET is not configured.");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createProfessionalSession(role: ProfessionalRole) {
  const payload = b64url(encoder.encode(JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(payload)));
  return `${payload}.${b64url(signature)}`;
}

export async function professionalRoleIsValid(value?: string): Promise<ProfessionalRole | null> {
  if (!value) return null;
  const [payload, encodedSignature, extra] = value.split(".");
  if (!payload || !encodedSignature || extra) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await signingKey(), fromB64url(encodedSignature), encoder.encode(payload));
    if (!valid) return null;
    const decoded = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { role?: string; exp?: number };
    if (decoded.exp == null || decoded.exp <= Math.floor(Date.now() / 1000)) return null;
    return decoded.role === "fisioterapia" || decoded.role === "podologia" ? decoded.role : null;
  } catch {
    return null;
  }
}

export async function getProfessionalRole() {
  if (accessEnabled()) {
    const identity = await accessIdentity();
    if (!identity || identity.role === "admin" || !accessOwnerId()) return null;
    return identity.role;
  }
  return professionalRoleIsValid((await cookies()).get(COOKIE)?.value);
}

export const professionalCookieName = COOKIE;
export const professionalSessionMaxAge = SESSION_SECONDS;
