export interface ElevatorNotice {
  id: string;
  elevator: string;
  date: string;
  type: 'Automático' | 'Manual';
  subject: string;
  recipients: string;
  /** Texto guardado na BD; os avisos simulados usam o texto do modelo. */
  body?: string;
}
