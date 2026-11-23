import { env } from "cloudflare:workers";
import { headers } from "next/headers";

const settings = env as unknown as Record<string, string | undefined>;
export const accessEnabled = () => settings.CRM_AUTH_MODE !== undefined && settings.CRM_AUTH_MODE !== "legacy";
type Role = "admin" | "fisioterapia" | "podologia";

function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[\w-]+$/.test(value)) throw new Error("Invalid token encoding");
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}
function readJson(value: string) {
  return JSON.parse(new TextDecoder().decode(decode(value)));
}

export async function accessIdentity() {
  const team = settings.CRM_ACCESS_TEAM;
  const audience = settings.CRM_ACCESS_AUD;
  if (settings.CRM_AUTH_MODE !== "cloudflare-access" || !team || !/^[a-z0-9-]+$/.test(team) || !audience) return null;
  const issuer = `https://${team}.cloudflareaccess.com`;
  const token = (await headers()).get("cf-access-jwt-assertion");
  if (!token || token.length > 16384) return null;
  try {
    const [head, body, signature, extra] = token.split(".");
    if (!head || !body || !signature || extra !== undefined) return null;
    const header = readJson(head);
    const claims = readJson(body);
    const now = Date.now() / 1000;
    if (header.alg !== "RS256" || typeof header.kid !== "string" ||
        claims.iss !== issuer || !Array.isArray(claims.aud) || !claims.aud.includes(audience) ||
        typeof claims.exp !== "number" || claims.exp <= now ||
        (claims.nbf !== undefined && (typeof claims.nbf !== "number" || claims.nbf > now)) ||
        typeof claims.email !== "string" || claims.type !== "app") return null;
    const email = claims.email.trim().toLowerCase();
    if (!email) return null;
    const roles: [Role, string | undefined][] = [
      ["admin", settings.CRM_ADMIN_EMAIL],
      ["fisioterapia", settings.CRM_PHYSIO_EMAIL],
      ["podologia", settings.CRM_PODOLOGY_EMAIL],
    ];
    const matches = roles.filter(([, allowed]) => allowed?.trim().toLowerCase() === email);
    if (matches.length !== 1) return null;

    const response = await fetch(`${issuer}/cdn-cgi/access/certs`, { redirect: "error" });
    if (!response.ok) return null;
    const { keys } = await response.json() as { keys: (JsonWebKey & { kid?: string })[] };
    const jwk = keys.find(key => key.kid === header.kid && key.kty === "RSA");
    if (!jwk) return null;
    const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
    const key = await crypto.subtle.importKey("jwk", jwk, algorithm, false, ["verify"]);
    const valid = await crypto.subtle.verify(algorithm, key, decode(signature), new TextEncoder().encode(`${head}.${body}`));
    return valid ? { email, role: matches[0][0] } : null;
  } catch {
    return null;
  }
}

export function accessOwnerId() {
  return settings.CRM_DATA_OWNER_ID?.trim() || null;
}
