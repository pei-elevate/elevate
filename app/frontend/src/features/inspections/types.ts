export interface Request {
  id: string;
  elevator: string;
  date: string;
  scope: string;
  status: string;
  scheduled: string;
  result: string;
  performed?: string;
  report?: string;
  nonconformities?: string;
  // Vindos da API; sem eles, a tabela procura o elevador nos dados de exemplo.
  address?: string;
  company?: string;
  inspectionCompany?: string;
  // Id do elevador na API, para abrir a ficha.
  elevatorKey?: number;
}
