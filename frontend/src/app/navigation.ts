import type { Role } from '@/shared/auth/roles';

export const navigation: Record<Role, [string, string, string][]> = {
  proprietario: [
    ['painel', 'Painel geral', 'dashboard'],
    ['elevadores', 'Os meus elevadores', 'elevators'],
  ],
  manutencao: [
    ['elevadores', 'Painel geral', 'dashboard'],
    ['registar', 'Registar elevador', 'register'],
    ['inspecoes', 'Inspeções', 'calendar'],
    ['reprovadas', 'Inspeções reprovadas', 'failed'],
    ['reclamacoes', 'Reclamações', 'complaints'],
  ],
  urbanismo: [
    ['avisos', 'Alvarás registados', 'notices'],
    ['novo-aviso', 'Registar novo alvará', 'register'],
  ],
  gestor: [
    ['painel', 'Painel geral', 'dashboard'],
    ['cadastro', 'Elevadores registados', 'elevators'],
    ['validacoes', 'Validar registo', 'check'],
    ['nao-registados', 'Elevadores não registados', 'notices'],
    ['pedidos', 'Pedidos de inspeção', 'calendar'],
    ['reprovadas', 'Inspeções reprovadas', 'failed'],
  ],
  inspecao: [
    ['atribuidas', 'Inspeções atribuídas', 'check'],
    ['agendar', 'Agendar inspeções', 'calendar'],
  ],
};
