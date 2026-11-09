import type { Upload, Values } from '@/shared/forms/types';
import {
  requiredIn,
  validateDateFields,
  validateDocument,
  validateOwnerAndAddress,
} from '@/shared/forms/validation';
import { localToday } from '@/shared/lib/dates';

export function validateRegistration(v: Values, file: Upload | null, today = localToday()) {
  const errors: Values = {};
  const required = requiredIn(errors, v);
  validateOwnerAndAddress(v, errors);

  if (!['Condomínio', 'Pessoa singular', 'Pessoa coletiva'].includes(v.ownerType))
    errors.ownerType = 'Selecione o tipo de proprietário.';

  // As partes do domínio não incluem o ponto, para a regex não recuar (backtracking) em textos longos.
  if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(v.email ?? ''))
    errors.email = 'Indique um endereço de correio eletrónico válido.';

  required('service', 'a data de entrada em serviço');

  if (v.service > today) errors.service = 'A entrada em serviço não pode ser futura.';

  validateDocument(file, errors);
  validateDateFields(v, ['service'], errors);

  return errors;
}
