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
}
