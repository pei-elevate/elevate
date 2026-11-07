export function detailPage(role: string) {
  return role === 'gestor' ? 'historico' : 'detalhes';
}
