import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import { approveRegistration, decisionError } from '@/features/elevators/api';
import { createPermit, listPermits, permitError } from '@/features/permits/api';
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

const permitBody = {
  permit_number: '200/2026',
  permit_date: '2026-11-02',
  address: 'Rua Nova 1',
  postal_code: '3800-100',
  parish: 'Esgueira',
  num_elevators: 2,
  owner_name: 'Condomínio Rua Nova',
  owner_nif: '900000099',
  owner_email: 'rua.nova@ex.pt',
  owner_phone: null,
};

test('createPermit envia o alvará do Urbanismo', async () => {
  const fetch = stubFetch(201, { id: 9, status: 'missing' });

  const created = await createPermit('urbanismo', permitBody);

  assert.equal(created.id, 9);
  const [url, init] = fetch.mock.calls[0];
  assert.equal(url, '/api/permits');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['X-User-Id'], 'seed-urban-planning');
  assert.deepEqual(JSON.parse(init.body), permitBody);
});

test('listPermits pede os alvarás em nome do perfil', async () => {
  const fetch = stubFetch(200, []);

  await listPermits('gestor');

  const [url, init] = fetch.mock.calls[0];
  assert.equal(url, '/api/permits');
  assert.equal(init.headers['X-User-Id'], 'seed-municipal-manager');
});

test('permitError: 409 aponta para o número do alvará', () => {
  assert.deepEqual(permitError(new ApiError(409, 'x')), {
    field: 'permit',
    message: 'Já existe um alvará registado com este número.',
  });
  assert.deepEqual(permitError(new ApiError(500, 'x')), {
    message: 'Não foi possível guardar o alvará. Tente novamente.',
  });
  assert.deepEqual(permitError(new TypeError('Failed to fetch')), {
    message: 'Não foi possível guardar o alvará. Tente novamente.',
  });
});
