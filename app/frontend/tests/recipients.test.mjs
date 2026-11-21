import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { test } from 'vitest';
import { Recipients, recipientNames } from '@/features/notices/Recipients';

test('os destinatários ficam só com o nome, sem o email', () => {
  assert.deepEqual(
    recipientNames(
      'Condomínio Edifício Ria <ria@exemplo.pt>; Elevar, Lda. <geral@elevar.exemplo.pt>',
    ),
    ['Condomínio Edifício Ria', 'Elevar, Lda.'],
  );
});

test('um destinatário sem email fica como está', () => {
  assert.deepEqual(recipientNames('Condomínio Viseu 30'), ['Condomínio Viseu 30']);
  assert.deepEqual(recipientNames(''), []);
});

test('cada destinatário aparece numa linha própria', () => {
  const html = renderToString(
    createElement(Recipients, { value: 'Condomínio Edifício Ria <ria@exemplo.pt>; Elevar, Lda.' }),
  );
  assert.equal(
    html,
    '<ul class="recipients"><li>Condomínio Edifício Ria</li><li>Elevar, Lda.</li></ul>',
  );
});
