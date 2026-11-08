export type Role = 'proprietario' | 'manutencao' | 'urbanismo' | 'gestor' | 'inspecao';

export const roles: Record<Role, string> = {
  proprietario: 'Proprietário',
  manutencao: 'Empresa de manutenção',
  urbanismo: 'Urbanismo',
  gestor: 'Gestor municipal',
  inspecao: 'Empresa de inspeção',
};
