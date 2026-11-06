import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readRoute } from '@/app/state';

test('o perfil viaja com cada entrada do histórico', () => {
  // Voltar atrás para uma página do gestor repõe o perfil com que lá se esteve.
  assert.equal(readRoute('/validacoes', { role: 'gestor' }, 'manutencao').role, 'gestor');
  // Sem perfil guardado (endereço escrito à mão), usa o perfil por omissão.
  assert.equal(readRoute('/validacoes', null, 'proprietario').role, 'proprietario');
  assert.equal(readRoute('/validacoes', { role: 'xyz' }, 'proprietario').role, 'proprietario');
  // Página inicial do perfil e ids com «/».
  assert.equal(readRoute('/', { role: 'inspecao' }, 'proprietario').page, 'atribuidas');
  assert.equal(readRoute('/agendar/2026%2F0377', { role: 'inspecao' }, 'proprietario').id, '2026/0377');
});
