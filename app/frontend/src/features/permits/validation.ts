import type { Upload, Values } from '@/shared/forms/types';
import {
  requiredIn,
  validateDateFields,
  validateDocument,
  validateOwnerAndAddress,
} from '@/shared/forms/validation';
import { localToday } from '@/shared/lib/dates';

export function validatePermit(v: Values, file: Upload | null, today = localToday()) {
  const errors: Values = {};
  const required = requiredIn(errors, v);
  validateOwnerAndAddress(v, errors);
  required('permit', 'o número do alvará');
  required('permitDate', 'a data do alvará');

  if (v.permitDate > today) errors.permitDate = 'A data do alvará não pode ser futura.';

  if (!/^\d+$/.test(v.count ?? '') || Number(v.count) < 1)
    errors.count = 'Indique pelo menos um elevador.';

  validateDocument(file, errors);
  validateDateFields(v, ['permitDate'], errors);

  return errors;
}
