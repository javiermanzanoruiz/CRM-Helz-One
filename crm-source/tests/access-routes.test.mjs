import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const OWNER_ID = 'helzone-javier';
function loadRoute(path, identity, db) {
  const table = name => new Proxy({ table: name }, { get: (target, field) => field === 'table' ? target.table : field });
  const modules = {
    'drizzle-orm': {
      and: (...predicates) => row => predicates.every(p => p(row)),
      eq: (field,value) => row => row[field] === value,
      inArray: (field,values) => row => values.includes(row[field]),
      asc: () => null, desc: () => null,
    },
    '../../../lib/access-context': { getIdentity: () => identity },
    '../../../lib/access': { OWNER_ID },
    '../../../db': { getDb: () => db },
    '../../../db/schema': { clients: table('clients'), professionalNotes: table('notes') },
  };
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url),'utf8'), { compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, { exports, Response, URL, crypto, console, require(name) { assert.ok(Object.hasOwn(modules,name)); return modules[name]; } });
  return exports;
}
function fakeDb() {
  const clients = [
    { id:'assigned', ownerId:OWNER_ID, name:'Synthetic fixture', status:'inactive', monthlyFeeCents:999, physioNotes:'synthetic physio note' },
    { id:'unassigned', ownerId:OWNER_ID },
    { id:'other-owner', ownerId:'unrelated-owner' },
  ];
  const notes = ['fisioterapia','podologia'].flatMap(professionalRole => ['assigned','unassigned','other-owner'].map(clientId => ({ id:`${professionalRole}-${clientId}`, ownerId: clientId === 'other-owner' ? 'unrelated-owner' : OWNER_ID, clientId, professionalRole, note:'synthetic note' })));
  let touched = 0;
  const project = (row, fields) => Object.fromEntries(Object.entries(fields).map(([key,field])=>[key,row[field]]));
  return {
    get touched() { return touched; }, notes,
    select(fields) {
      touched++;
      let rows = [];
      const query = {
        from(table) { rows = table.table === 'clients' ? clients : notes; return query; },
        where(predicate) { rows = rows.filter(predicate); return query; },
        orderBy() { return query; }, limit() { return query; },
        then(resolve,reject) { return Promise.resolve(rows.map(row=>project(row,fields))).then(resolve,reject); },
      };
      return query;
    },
    insert() { touched++; return { values(row) { notes.push(row); return { returning: async fields => [project(row,fields)] }; } }; },
  };
}
for (const role of ['fisioterapia','podologia']) {
  test(`${role}: sees only assigned owner's records and its own area notes`, async () => {
    const db = fakeDb();
    const api = loadRoute('../app/api/professional/route.ts',{ role, clientIds:['assigned','other-owner'] },db);
    const response = await api.GET();
    assert.equal(response.status,200);
    const body = await response.json();
    assert.deepEqual(body.clients.map(c=>c.id),['assigned']);
    assert.equal(Object.hasOwn(body.clients[0],'monthlyFeeCents'),false);
    assert.equal(body.clients[0].legacyProfessionalNotes,role==='fisioterapia'?'synthetic physio note':'');
    assert.deepEqual(body.notes.map(n=>n.id),[`${role}-assigned`]);
  });
  test(`${role}: cannot write unassigned or other-owner records or select another role`, async () => {
    const db = fakeDb();
    const api = loadRoute('../app/api/professional/route.ts',{ role, clientIds:['assigned','other-owner'] },db);
    const req = clientId => new Request('https://crm.example.test/api/professional',{method:'POST',body:JSON.stringify({clientId,note:'synthetic test note',role:'admin',ownerId:'attacker'})});
    assert.equal((await api.POST(req('unassigned'))).status,403);
    assert.equal(db.touched,0);
    assert.equal((await api.POST(req('other-owner'))).status,404);
    assert.equal((await api.POST(req('assigned'))).status,201);
    assert.equal(db.notes.at(-1).professionalRole,role);
    assert.equal(db.notes.at(-1).ownerId,OWNER_ID);
  });
  test(`${role}: cannot call any full CRM operation`, async () => {
    const api = loadRoute('../app/api/crm/route.ts',{role},null);
    for (const method of ['GET','POST','PATCH','DELETE']) {
      assert.equal((await api[method](new Request('https://crm.example.test/api/crm'))).status,401);
    }
  });
}
test('no assignments yields empty lists without querying the DB', async () => {
  const api = loadRoute('../app/api/professional/route.ts',{role:'podologia',clientIds:[]},null);
  assert.deepEqual(await (await api.GET()).json(),{role:'podologia',clients:[],notes:[]});
});
