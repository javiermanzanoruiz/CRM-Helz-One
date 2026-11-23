import { pinOnlyEnabled, pinOnlyReady } from "../../pin-only";
import { env } from "cloudflare:workers";
import { createProfessionalSession, professionalCookieName, professionalSessionMaxAge, type ProfessionalRole } from "../../professional-auth";

export const dynamic = "force-dynamic";
const failures = new Map<string, { count: number; resetAt: number }>();

async function matchesCode(expectedCode: string, suppliedCode: string) {
  const [expected, supplied] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(expectedCode)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(suppliedCode)),
  ]);
  const a = new Uint8Array(expected);
  const b = new Uint8Array(supplied);
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  return different === 0;
}

export async function POST(request: Request) {
  if (pinOnlyEnabled() && !pinOnlyReady()) {
    return Response.json({ error: "Acceso pendiente de configuración." }, { status: 503 });
  }
  const address = request.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  const record = failures.get(address);
  if (record && record.resetAt > now && record.count >= 6) {
    return Response.json({ error: "Demasiados intentos. Espera 15 minutos." }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const body = await request.json() as { role?: unknown; code?: unknown };
    const role = body.role === "fisioterapia" || body.role === "podologia" ? body.role as ProfessionalRole : null;
    const code = typeof body.code === "string" ? body.code : "";
    const envValues = env as unknown as Record<string, string | undefined>;
    const expected = role === "fisioterapia" ? envValues.CRM_PHYSIO_PIN : role === "podologia" ? envValues.CRM_PODOLOGY_PIN : undefined;
    if (!role || !expected || code.length > 100 || !(await matchesCode(expected, code))) {
      const current = record && record.resetAt > now ? record : { count: 0, resetAt: now + 15 * 60 * 1000 };
      current.count += 1;
      failures.set(address, current);
      return Response.json({ error: "Acceso no válido. Revisa el perfil y el código." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    failures.delete(address);
    const session = await createProfessionalSession(role);
    return Response.json({ ok: true, role }, {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": `${professionalCookieName}=${session}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${professionalSessionMaxAge}`,
      },
    });
  } catch {
    return Response.json({ error: "No se pudo validar el acceso." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE() {
  return Response.json({ ok: true }, {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": `${professionalCookieName}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    },
  });
}
