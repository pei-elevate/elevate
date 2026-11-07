import type { Upload, Values } from '@/shared/forms/types';
import { requiredIn, validateDateFields, validateDocument } from '@/shared/forms/validation';
import { localToday } from '@/shared/lib/dates';

export function validateSchedule(v: Values, file: Upload | null, today = localToday()) {
  const errors: Values = {};
  const required = requiredIn(errors, v);
  required('date', 'a data da inspeção');
  required('time', 'a hora');

  if (v.date && v.date < today) errors.date = 'Escolha a data de hoje ou uma data futura.';

  validateDocument(file, errors);
  validateDateFields(v, ['date'], errors);

  return errors;
}

export function validateResult(v: Values, file: Upload | null, today = localToday()) {
  const errors: Values = {};
  const required = requiredIn(errors, v);

  if (!['Aprovada', 'Reprovada'].includes(v.result))
    errors.result = 'Selecione o resultado da inspeção.';

  required('performed', 'a data de realização');

  if (v.performed > today) errors.performed = 'A data de realização não pode ser futura.';

  if (v.result === 'Reprovada') {
    required('nonconformities', 'as não conformidades');
    required('deadline', 'o prazo de correção');

    if (v.deadline && v.deadline < v.performed)
      errors.deadline = 'O prazo deve ser posterior à data de realização.';
  }

  if (v.result === 'Aprovada') {
    required('validUntil', 'a validade do certificado');

    if (v.validUntil && v.validUntil <= v.performed)
      errors.validUntil = 'A validade deve ser posterior à data da inspeção.';
  }

  if (!file) errors.document = 'Anexe o relatório ou certificado em PDF.';

  validateDocument(file, errors);
  validateDateFields(v, ['performed', v.result === 'Aprovada' ? 'validUntil' : 'deadline'], errors);

  return errors;
}
