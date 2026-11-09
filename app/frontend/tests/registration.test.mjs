import assert from 'node:assert/strict';
import { test } from 'vitest';
import { registrationChanges } from '@/features/elevators/rules';
import { validateRegistration } from '@/features/elevators/validation';

const values = {
  address: ' Rua A 1 ',
  postal: '3800-000',
  parish: 'Esgueira',
  owner: ' Condomínio A ',
  nif: '123456789',
  email: 'a@exemplo.pt',
  service: '2026-10-01',
  ownerType: 'Condomínio',
};

test('o registo guarda o nome do documento anexado', () => {
  assert.equal(registrationChanges(values, 'contrato.pdf', '').document, 'contrato.pdf');
  // Na correção, sem novo ficheiro, mantém o documento anterior.
  assert.equal(registrationChanges(values, undefined, 'antigo.pdf').document, 'antigo.pdf');
  // Documento removido: deixa de haver documento.
  assert.equal(registrationChanges(values, undefined, '').document, undefined);
  assert.equal(registrationChanges(values, undefined, '').address, 'Rua A 1');
  assert.equal(registrationChanges(values, undefined, '').owner, 'Condomínio A');
});

test('o registo aceita emails válidos e recusa os inválidos', () => {
  const emailError = (email) => validateRegistration({ ...values, email }, null).email;

  for (const email of ['a@exemplo.pt', 'joao.silva@camara.aveiro.pt', 'a+b@x.co'])
    assert.equal(emailError(email), undefined, email);

  for (const email of [
    '',
    'a',
    'a@',
    '@exemplo.pt',
    'a@exemplo',
    'a@@exemplo.pt',
    'a b@exemplo.pt',
    'a@exemplo.',
    'a@.pt',
    'a@exemplo..pt',
  ])
    assert.ok(emailError(email), email);
});

test('a validação do email não demora com textos longos sem domínio válido', () => {
  // Texto que faz a regex antiga recuar muitas vezes (backtracking quadrático).
  const email = `a@${'a.'.repeat(50_000)}@`;
  const start = performance.now();
  validateRegistration({ ...values, email }, null);
  assert.ok(performance.now() - start < 100);
});
