import { isISODate, localToday } from '@/shared/lib/dates';
import type { Upload, Values } from '@/shared/forms/types';

export function validateSubmission(
  kind: string,
  v: Values,
  file: Upload | null,
  today = localToday(),
): Values {
  const errors: Values = {};
  const required = (key: string, label: string) => {
    if (!v[key]?.trim()) errors[key] = `Indique ${label}.`;
  };

  if (kind === 'registar' || kind === 'novo-aviso') {
    required('address', 'a morada');
    required('owner', 'o nome do proprietário');
    required('parish', 'a freguesia');

    if (!/^\d{4}-\d{3}$/.test(v.postal ?? '')) errors.postal = 'Use o formato 3800-000.';

    if (!/^\d{9}$/.test(v.nif ?? '')) errors.nif = 'O NIF deve ter 9 algarismos.';
  }

  if (kind === 'registar') {
    if (!['Condomínio', 'Pessoa singular', 'Pessoa coletiva'].includes(v.ownerType))
      errors.ownerType = 'Selecione o tipo de proprietário.';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email ?? ''))
      errors.email = 'Indique um endereço de correio eletrónico válido.';

    required('service', 'a data de entrada em serviço');

    if (v.service > today) errors.service = 'A entrada em serviço não pode ser futura.';
  }

  if (kind === 'novo-aviso') {
    required('permit', 'o número do alvará');
    required('permitDate', 'a data do alvará');

    if (v.permitDate > today) errors.permitDate = 'A data do alvará não pode ser futura.';

    if (!/^\d+$/.test(v.count ?? '') || Number(v.count) < 1)
      errors.count = 'Indique pelo menos um elevador.';
  }

  if (kind === 'reclamacao') {
    if (!['Aberta', 'Resolvida'].includes(v.status))
      errors.status = 'Selecione o estado da reclamação.';

    required('elevator', 'o elevador');
    required('received', 'a data de receção');
    required('description', 'a descrição do problema');

    if (v.received > today) errors.received = 'A data de receção não pode ser futura.';
  }

  if (kind === 'agendar') {
    required('date', 'a data da inspeção');
    required('time', 'a hora');

    if (v.date && v.date < today) errors.date = 'Escolha a data de hoje ou uma data futura.';
  }

  if (kind === 'resultado') {
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
  }

  if (
    file &&
    (file.size > 10 * 1024 * 1024 ||
      file.size === 0 ||
      !file.name.toLowerCase().endsWith('.pdf') ||
      (file.type && file.type !== 'application/pdf'))
  )
    errors.document = 'Escolha um ficheiro PDF não vazio, até 10 MB.';

  const dateFields =
    kind === 'registar'
      ? ['service']
      : kind === 'novo-aviso'
        ? ['permitDate']
        : kind === 'reclamacao'
          ? ['received']
          : kind === 'agendar'
            ? ['date']
            : kind === 'resultado'
              ? ['performed', v.result === 'Aprovada' ? 'validUntil' : 'deadline']
              : [];

  for (const key of dateFields) {
    if (v[key] && !isISODate(v[key]))
      errors[key] = 'Indique uma data válida no formato DD/MM/YYYY.';
  }

  return errors;
}
