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

/** Email obrigatório, com a mesma regra no registo de elevador e no registo de alvará. */
export function validateEmail(v: Values, errors: Values) {
  // As partes do domínio não incluem o ponto, para a regex não recuar (backtracking) em textos longos.
  if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(v.email ?? ''))
    errors.email = 'Indique um endereço de correio eletrónico válido.';
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

/**
 * Se o ficheiro é mesmo um PDF: começa por «%PDF». A extensão e o tipo que o browser indica
 * vêm só do nome, por isso um ficheiro de texto renomeado para .pdf passa por eles.
 */
export function startsAsPdf(file: Blob): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      resolve(String.fromCharCode(...bytes) === '%PDF');
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 4));
  });
}
