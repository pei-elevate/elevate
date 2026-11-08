import assert from 'node:assert/strict';
import { test } from 'vitest';
import { registrationChanges } from '@/features/elevators/rules';

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
