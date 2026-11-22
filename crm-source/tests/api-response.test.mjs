import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readApiResponse } from '../lib/api-response.ts';

test('returns a successful empty dataset', async () => {
  const data = { clients: [], professionalNotes: [] };
  assert.deepEqual(await readApiResponse(Response.json(data), 'fallback'), data);
});
test('preserves server error messages', async () => {
  await assert.rejects(readApiResponse(Response.json({ error: 'Acceso no válido' }, { status: 401 }), 'fallback'), { message: 'Acceso no válido' });
});
test('uses a fallback for missing or malformed error messages', async () => {
  for (const body of [null, [], {}, { error: 12 }, { error: '' }]) {
    await assert.rejects(readApiResponse(Response.json(body, { status: 503 }), 'fallback'), { message: 'fallback' });
  }
});
test('rejects non-JSON responses', async () => {
  await assert.rejects(readApiResponse(new Response('<html>error</html>'), 'fallback'), SyntaxError);
});
