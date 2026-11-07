export interface ElevatorNotice {
  id: string;
  elevator: string;
  date: string;
  type: 'Automático' | 'Manual';
  subject: string;
  recipients: string;
}
