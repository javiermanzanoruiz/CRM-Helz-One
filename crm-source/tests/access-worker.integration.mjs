// Run after npm run build. Keys exist only in memory; outbound networking is mocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Miniflare, createFetchMock } from 'miniflare';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

test('compiled Worker verifies Access and enforces roles against empty local D1', async () => {
  const pair = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(pair.publicKey), kid:'local-test', alg:'RS256' };
  const network = createFetchMock();
  network.disableNetConnect();
  network.get('https://test-team.cloudflareaccess.com').intercept({path:'/cdn-cgi/access/certs'}).reply(200, {keys:[jwk]}, {headers:{'content-type':'application/json'}}).persist();
  const mf = new Miniflare({
    modulesRoot:resolve('dist/server'),
    modules: ['index.js', ...readdirSync('dist/server',{recursive:true}).filter(f=>f.endsWith('.js') && f!=='index.js')].map(file=>({type:'ESModule',path:resolve('dist/server',file)})),
    compatibilityDate:'2026-05-15', compatibilityFlags:['nodejs_compat'],
    fetchMock:network, d1Databases:{DB:'local-access-test'},
    bindings:{CF_ACCESS_TEAM_DOMAIN:'test-team.cloudflareaccess.com',CF_ACCESS_AUD:'test-aud',CRM_ACCESS_USERS:JSON.stringify({
      'admin@example.test':{role:'admin'},'physio@example.test':{role:'fisioterapia',clientIds:[]},'podo@example.test':{role:'podologia',clientIds:[]},
    })},
  });
  try {
    const db = await mf.getD1Database('DB');
    for (const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()) {
      const sql = readFileSync(`drizzle/${file}`,'utf8').replace(/--> statement-breakpoint/g,'');
      for (const statement of sql.split(';').map(s=>s.trim()).filter(Boolean)) await db.prepare(statement).run();
    }
    const request = (path,headers={})=>mf.dispatchFetch(`https://crm.example.test${path}`,{headers,redirect:'manual'});
    assert.equal((await request('/api/crm',{'Cf-Access-Authenticated-User-Email':'admin@example.test'})).status,401);
    for (const [email,role] of [['admin@example.test','admin'],['physio@example.test','fisioterapia'],['podo@example.test','podologia']]) {
      const jwt = await new SignJWT({email,type:'app'}).setProtectedHeader({alg:'RS256',kid:'local-test'})
        .setIssuer('https://test-team.cloudflareaccess.com').setAudience('test-aud').setSubject(`synthetic-${role}`).setIssuedAt().setExpirationTime('5m').sign(pair.privateKey);
      const headers = {'Cf-Access-Jwt-Assertion':jwt};
      const dataResponse = await request(role==='admin'?'/api/crm':'/api/professional',headers);
      assert.equal(dataResponse.status,200,await dataResponse.clone().text());
      assert.equal(dataResponse.headers.get('cache-control'),'private, no-store');
      const data = await dataResponse.json();
      assert.deepEqual(data.clients,[]);
      if(role==='admin') assert.equal(Object.keys(data).length,10);
      else {
        assert.equal(data.role,role);
        assert.equal((await request('/api/crm',headers)).status,403);
        assert.equal((await request('/',headers)).status,307);
      }
      const page = await request(role==='admin'?'/':'/profesionales',headers);
      assert.equal(page.status,200,await page.clone().text());
      assert.equal((await request('/api/access',headers)).status,410);
    }
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM clients').first()).count,0);
  } finally { await mf.dispose(); await network.close(); }
});
