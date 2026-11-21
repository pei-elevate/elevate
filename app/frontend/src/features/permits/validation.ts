import type { Upload, Values } from '@/shared/forms/types';
import {
  requiredIn,
  validateDateFields,
  validateEmail,
  validateOwnerAndAddress,
} from '@/shared/forms/validation';
import { localToday } from '@/shared/lib/dates';

/** O alvará não tem anexo; `_file` mantém a forma comum aos validadores dos formulários. */
export function validatePermit(v: Values, _file: Upload | null = null, today = localToday()) {
  const errors: Values = {};
  const required = requiredIn(errors, v);
  validateOwnerAndAddress(v, errors);
  validateEmail(v, errors);
  required('permit', 'o número do alvará');
  required('permitDate', 'a data do alvará');

  if (v.permitDate > today) errors.permitDate = 'A data do alvará não pode ser futura.';

  if (!/^\d+$/.test(v.count ?? '') || Number(v.count) < 1)
    errors.count = 'Indique pelo menos um elevador.';

  validateDateFields(v, ['permitDate'], errors);

  return errors;
}
