import type { Elevator } from '@/features/elevators/types';

export function detailPage(role: string) {
  return role === 'gestor' ? 'historico' : 'detalhes';
}

/**
 * Id da ficha (o id da API) a partir da referência interna, para os ecrãs que ainda usam os
 * mocks. Sem correspondência, fica a referência, e a ficha mostra «não encontrado».
 */
export function detailId(reference: string, items: Pick<Elevator, 'id' | 'key'>[] | null) {
  const key = items?.find((e) => e.id === reference)?.key;
  return key === undefined ? reference : String(key);
}
