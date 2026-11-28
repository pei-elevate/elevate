export interface Elevator {
  /** Referência interna (01.05.xxxx). */
  id: string;
  /** Id do elevador na API, usado no URL; os mocks não o têm. */
  key?: number;
  dge: string;
  owner: string;
  address: string;
  parish: string;
  company: string;
  inspector: string;
  validUntil: string;
  status: string;
  entry: string;
  entryDate: string;
  scope: string;
}

export interface Registration {
  id: string;
  address: string;
  postal: string;
  parish: string;
  owner: string;
  nif: string;
  email: string;
  company: string;
  service: string;
  status: string;
  permit: string;
  document?: string;
  reason?: string;
  dge?: string;
  block?: string;
  phone?: string;
  ownerType?: string;
}

export interface ElevatorFilters {
  query: string;
  status: string;
  parish: string;
  company: string;
  year: string;
}
