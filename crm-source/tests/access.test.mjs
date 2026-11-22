import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
import { authenticate, authorize, checkMutationOrigin, OWNER_ID } from '../lib/access.ts';
import { runWithIdentity, getIdentity } from '../lib/access-context.ts';
const pair = await generateKeyPair('RS256');
const publicJwk = { ...await exportJWK(pair.publicKey), kid: 'test', alg: 'RS256' };
const keys = createLocalJWKSet({ keys: [publicJwk] });
const env = {
  CF_ACCESS_TEAM_DOMAIN: 'test-team.cloudflareaccess.com', CF_ACCESS_AUD: 'test-aud',
  CRM_ACCESS_USERS: JSON.stringify({
    'admin@example.test': { role: 'admin' },
    'physio@example.test': { role: 'fisioterapia', clientIds: ['synthetic-id'] },
    'podo@example.test': { role: 'podologia', clientIds: [] },
  }),
};
async function token(overrides = {}, key = pair.privateKey, header = {}) {
  return new SignJWT({ email: 'admin@example.test', type: 'app', ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test', ...header })
    .setIssuer('https://test-team.cloudflareaccess.com').setAudience('test-aud')
    .setSubject('synthetic-subject').setIssuedAt().setExpirationTime('5m')
    .sign(key);
}
const request = jwt => new Request('https://crm.example.test/api/crm', { headers: jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {} });
const deny = (promise, status) => assert.rejects(promise, error => error.status === status);
test('signed individual identities resolve external roles and stable owner', async () => {
  for (const [email, role] of [['admin@example.test','admin'], ['physio@example.test','fisioterapia'], ['podo@example.test','podologia']]) {
    const identity = await authenticate(request(await token({ email })), env, keys);
    assert.equal(identity.role, role);
  }
  assert.equal(OWNER_ID, 'helzone-javier');
  const identity = await authenticate(request(await token({ email: ' PHYSIO@EXAMPLE.TEST ' })), env, keys);
  assert.deepEqual(identity.clientIds, ['synthetic-id']);
});
test('unverified email and legacy headers or cookies cannot authenticate', async () => {
  await deny(authenticate(new Request('https://crm.example.test', { headers: {
    'Cf-Access-Authenticated-User-Email': 'admin@example.test',
    'oai-authenticated-user-id': 'helzone-javier',
    Cookie: 'helzone_crm_session=fake',
  } }), env, keys), 401);
});
test('rejects invalid signature, unknown kid, malformed JWT and unlisted identity', async () => {
  const other = await generateKeyPair('RS256');
  for (const jwt of [await token({}, other.privateKey), await token({}, pair.privateKey, { kid: 'unknown' }), 'bad.jwt']) {
    await deny(authenticate(request(jwt), env, keys), 401);
  }
  await deny(authenticate(request(await token({ email: 'unknown@example.test' })), env, keys), 403);
  await deny(authenticate(request(await token({ type: 'service' })), env, keys), 401);
});
test('rejects expired, future, wrong audience/issuer and missing required claims', async () => {
  const base = { email: 'admin@example.test', type: 'app', iss: 'https://test-team.cloudflareaccess.com', aud: 'test-aud', sub: 'test', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+300 };
  for (const delta of [{ exp: 1 }, { nbf: base.exp+100 }, { iat: base.exp+100 }, { aud: 'other' }, { iss: 'https://attacker.example.test' }, { exp: undefined }, { sub: undefined }]) {
    const jwt = await new SignJWT({ ...base, ...delta }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).sign(pair.privateKey);
    await deny(authenticate(request(jwt), env, keys), 401);
  }
});
test('fails closed on missing configuration and invalid role', async () => {
  await deny(authenticate(request(), {}, keys), 503);
  await deny(authenticate(request(), { ...env, CRM_ACCESS_USERS: 'invalid' }, keys), 503);
  await deny(authenticate(request(await token()), { ...env, CRM_ACCESS_USERS: '{"admin@example.test":{"role":"root"}}' }, keys), 403);
});
test('role boundary rejects full CRM for professionals and retired PIN routes', () => {
  for (const role of ['fisioterapia','podologia']) {
    assert.throws(()=>authorize(request(), { role }), error=>error.status===403);
    authorize(new Request('https://crm.example.test/api/professional'), { role });
  }
  authorize(request(), { role: 'admin' });
  assert.throws(()=>authorize(new Request('https://crm.example.test/api/access'), { role: 'admin' }), error=>error.status===410);
});
test('mutations require same origin', () => {
  assert.throws(()=>checkMutationOrigin(new Request('https://crm.example.test/api/crm',{ method:'POST', headers:{ Origin:'https://evil.example.test' } })), error=>error.status===403);
  checkMutationOrigin(new Request('https://crm.example.test/api/crm',{ method:'POST', headers:{ Origin:'https://crm.example.test' } }));
});
test('identities remain isolated across concurrent asynchronous requests', async () => {
  await Promise.all(['admin','podologia'].map(role=>runWithIdentity({role}, async()=> {
    await new Promise(resolve=>setTimeout(resolve, 5)); assert.equal(getIdentity().role,role);
  })));
  assert.equal(getIdentity(),undefined);
});
