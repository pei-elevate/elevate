import type { Upload, Values } from '@/shared/forms/types';
import { isISODate } from '@/shared/lib/dates';

/** Devolve uma função que regista «Indique …» quando o campo está vazio. */
export function requiredIn(errors: Values, v: Values) {
  return (key: string, label: string) => {
    if (!v[key]?.trim()) errors[key] = `Indique ${label}.`;
  };
}

/** Morada, proprietário, freguesia, código postal e NIF (registo de elevador e de alvará). */
export function validateOwnerAndAddress(v: Values, errors: Values) {
  const required = requiredIn(errors, v);
  required('address', 'a morada');
  required('owner', 'o nome do proprietário');
  required('parish', 'a freguesia');

  if (!/^\d{4}-\d{3}$/.test(v.postal ?? '')) errors.postal = 'Use o formato 3800-000.';

  if (!/^\d{9}$/.test(v.nif ?? '')) errors.nif = 'O NIF deve ter 9 algarismos.';
}

/** O anexo, quando existe, tem de ser um PDF não vazio até 10 MB. */
export function validateDocument(file: Upload | null, errors: Values) {
  if (
    file &&
    (file.size > 10 * 1024 * 1024 ||
      file.size === 0 ||
      !file.name.toLowerCase().endsWith('.pdf') ||
      (file.type && file.type !== 'application/pdf'))
  )
    errors.document = 'Escolha um ficheiro PDF não vazio, até 10 MB.';
}

/** Datas preenchidas têm de ser válidas; esta mensagem substitui as anteriores desses campos. */
export function validateDateFields(v: Values, keys: string[], errors: Values) {
  for (const key of keys) {
    if (v[key] && !isISODate(v[key]))
      errors[key] = 'Indique uma data válida no formato DD/MM/YYYY.';
  }
}
