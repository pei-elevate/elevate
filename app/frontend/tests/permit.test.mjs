import assert from 'node:assert/strict';
import { test } from 'vitest';
import { toNewPermitBody } from '@/features/permits/NewPermitForm';
import { validatePermit } from '@/features/permits/validation';

const valid = {
  permit: '200/2026',
  permitDate: '2026-11-02',
  address: 'Rua Nova 1',
  postal: '3800-100',
  parish: 'Esgueira',
  count: '2',
  owner: 'Condomínio Rua Nova',
  nif: '900000099',
  email: 'rua.nova@ex.pt',
};

test('validatePermit pede o email e já não pede anexo', () => {
  const e = validatePermit({ ...valid, email: '' }, null, '2026-11-21');

  assert.equal(e.email, 'Indique um endereço de correio eletrónico válido.');
  assert.equal(validatePermit({ ...valid, email: 'a@b' }, null, '2026-11-21').email, e.email);
  assert.deepEqual(validatePermit(valid, null, '2026-11-21'), {});
  // Um ficheiro inválido já não é motivo de erro: o formulário deixou de ter anexo.
  assert.deepEqual(
    validatePermit(valid, { name: 'x.txt', type: 'text/plain', size: 0 }, '2026-11-21'),
    {},
  );
});

test('toNewPermitBody faz trim e converte os tipos', () => {
  assert.deepEqual(
    toNewPermitBody({
      permit: ' 200/2026 ',
      permitDate: '2026-11-02',
      address: ' Rua Nova 1 ',
      postal: '3800-100',
      parish: 'Esgueira',
      count: '2',
      owner: 'Cond.',
      nif: '900000099',
      email: 'a@ex.pt',
      phone: ' ',
    }),
    {
      permit_number: '200/2026',
      permit_date: '2026-11-02',
      address: 'Rua Nova 1',
      postal_code: '3800-100',
      parish: 'Esgueira',
      num_elevators: 2,
      owner_name: 'Cond.',
      owner_nif: '900000099',
      owner_email: 'a@ex.pt',
      owner_phone: null,
    },
  );
  assert.equal(toNewPermitBody({ ...valid, phone: ' 912345678 ' }).owner_phone, '912345678');
});
