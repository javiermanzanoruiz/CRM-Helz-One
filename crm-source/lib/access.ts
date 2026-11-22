import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export const OWNER_ID = 'helzone-javier';
export type Role = 'admin' | 'fisioterapia' | 'podologia';
export type Identity = { email: string; role: Role; clientIds: string[] };
export type AccessEnv = { CF_ACCESS_TEAM_DOMAIN?: string; CF_ACCESS_AUD?: string; CRM_ACCESS_USERS?: string };
export class AccessError extends Error {
  status: number;
  constructor(status: number) { super('Access denied'); this.status = status; }
}
const resolvers = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function authenticate(request: Request, env: AccessEnv, testKey?: JWTVerifyGetKey): Promise<Identity> {
  const domain = env.CF_ACCESS_TEAM_DOMAIN;
  if (!domain || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain) || !env.CF_ACCESS_AUD || !env.CRM_ACCESS_USERS) throw new AccessError(503);
  let users: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(env.CRM_ACCESS_USERS);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    users = {};
    for (const [email, value] of Object.entries(parsed)) {
      const normalized = email.trim().toLowerCase();
      if (!normalized.includes('@') || Object.hasOwn(users, normalized)) throw new Error();
      Object.defineProperty(users, normalized, { value, enumerable: true });
    }
  } catch { throw new AccessError(503); }
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16384) throw new AccessError(401);
  const issuer = `https://${domain}`;
  let key = testKey ?? resolvers.get(issuer);
  if (!key) {
    const remote = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), { timeoutDuration: 5000, cacheMaxAge: 300000 });
    resolvers.set(issuer, remote);
    key = remote;
  }
  let email: string;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['RS256'], issuer, audience: env.CF_ACCESS_AUD,
      requiredClaims: ['exp', 'iat', 'sub', 'email', 'type'],
    });
    if (payload.type !== 'app' || typeof payload.email !== 'string' || typeof payload.sub !== 'string' || !payload.sub || typeof payload.iat !== 'number' || payload.iat > Date.now()/1000 + 30) throw new Error();
    email = payload.email.trim().toLowerCase();
  } catch { throw new AccessError(401); }
  const grant = Object.hasOwn(users, email) ? users[email] : null;
  if (!grant || typeof grant !== 'object' || !('role' in grant)) throw new AccessError(403);
  const role = grant.role;
  if (role !== 'admin' && role !== 'fisioterapia' && role !== 'podologia') throw new AccessError(403);
  const clientIds = 'clientIds' in grant ? grant.clientIds : [];
  if (!Array.isArray(clientIds) || !clientIds.every(id=>typeof id === 'string' && id.length > 0 && id.length <= 64)) throw new AccessError(403);
  return { email, role, clientIds: [...new Set(clientIds as string[])] };
}

export function authorize(request: Request, identity: Identity): void {
  const path = new URL(request.url).pathname;
  if (path === '/api/access' || path === '/api/professional-access') throw new AccessError(410);
  if (path.startsWith('/api/')) {
    if (path === '/api/crm' && identity.role === 'admin') return;
    if (path === '/api/professional' && identity.role !== 'admin') return;
    throw new AccessError(403);
  }
  if (!['GET', 'HEAD'].includes(request.method)) throw new AccessError(403);
  // Prevent cross-site mutation requests; no server actions are used by this CRM.
}

export function checkMutationOrigin(request: Request): void {
  if (['GET', 'HEAD'].includes(request.method)) return;
  if (request.headers.get('Origin') !== new URL(request.url).origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new AccessError(403);
}
