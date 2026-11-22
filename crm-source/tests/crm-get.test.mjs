import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('GET preserves legacy-prefixed records for the legacy owner without deleting', async () => {
  // Synthetic inactive record exercises the former cleanup path without creating dues.
  const client = { id: 'oct26-client-regression', status: 'inactive' };
  let deletes = 0;
  const db = {
    select() {
      let rows = [];
      const query = {
        from(table) { rows = table === 'clients' ? [client] : []; return query; },
        where() { return query; },
        orderBy() { return query; },
        limit() { return query; },
        then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
      };
      return query;
    },
    delete() { deletes++; throw new Error('GET must never delete records'); },
    insert() { throw new Error('Inactive clients must not generate dues'); },
  };
  const schema = new Proxy({}, { get: (_, table) => table });
  const modules = {
    'drizzle-orm': { and: () => null, desc: () => null, eq: () => null, inArray: () => null, like: () => null },
    '../../../lib/access-context': { getIdentity: () => ({ role: 'admin' }) },
    '../../../lib/access': { OWNER_ID: 'helzone-javier' },
    '../../../db': { getDb: () => db },
    '../../../db/schema': schema,
  };
  const source = readFileSync(new URL('../app/api/crm/route.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, {
    exports, Response, URL, console,
    require(name) { assert.ok(Object.hasOwn(modules, name), name); return modules[name]; },
  });
  const response = await exports.GET(new Request('http://localhost/api/crm?month=2026-11'));
  assert.equal(deletes, 0);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).clients, [client]);
});
