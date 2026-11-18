import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import { approveRegistration, decisionError } from '@/features/elevators/api';
import { ApiError, api } from '@/shared/api/client';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(status, body) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetch);

  return fetch;
}

test('o pedido leva o utilizador do perfil e o corpo em JSON', async () => {
  const fetch = stubFetch(200, { internal_reference: '01.05.0286' });

  const result = await approveRegistration('gestor', 7, 2);

  assert.equal(result.internal_reference, '01.05.0286');
  const [url, init] = fetch.mock.calls[0];
  assert.equal(url, '/api/registrations/7/approve');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['X-User-Id'], 'seed-municipal-manager');
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(init.body), { permit_id: 2 });
});

test('um GET não leva corpo', async () => {
  const fetch = stubFetch(200, []);

  await api('/permits', 'urbanismo');

  const [, init] = fetch.mock.calls[0];
  assert.equal(init.method, 'GET');
  assert.equal(init.body, undefined);
  assert.equal(init.headers['Content-Type'], undefined);
});

test('uma resposta de erro lança ApiError com o estado e o detalhe', async () => {
  stubFetch(409, { detail: 'The registration was already reviewed' });

  await assert.rejects(api('/registrations/1/reject', 'gestor', { method: 'POST', body: {} }), {
    name: 'Error',
    status: 409,
    message: 'The registration was already reviewed',
  });
});

test('mensagens de erro da decisão', () => {
  assert.match(decisionError(new ApiError(409, '')), /já foi analisado/);
  assert.match(decisionError(new ApiError(422, '')), /alvará escolhido já não existe/);
  assert.match(decisionError(new ApiError(500, '')), /Não foi possível guardar/);
  assert.match(decisionError(new TypeError('Failed to fetch')), /Não foi possível guardar/);
});
