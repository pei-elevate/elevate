import type { Upload, Values } from '@/shared/forms/types';
import { requiredIn, validateDateFields, validateDocument } from '@/shared/forms/validation';
import { localToday } from '@/shared/lib/dates';

export function validateComplaint(v: Values, file: Upload | null, today = localToday()) {
  const errors: Values = {};
  const required = requiredIn(errors, v);

  if (!['Aberta', 'Resolvida'].includes(v.status))
    errors.status = 'Selecione o estado da reclamação.';

  required('elevator', 'o elevador');
  required('received', 'a data de receção');
  required('description', 'a descrição do problema');

  if (v.received > today) errors.received = 'A data de receção não pode ser futura.';

  validateDocument(file, errors);
  validateDateFields(v, ['received'], errors);

  return errors;
}
