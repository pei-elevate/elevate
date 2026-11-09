export interface UrbanNotice {
  id: string;
  address: string;
  permit: string;
  date: string;
  count: string;
  owner: string;
  status: string;
  /** Data do último alerta emitido ao proprietário, se existir. */
  alerted?: string;
}
