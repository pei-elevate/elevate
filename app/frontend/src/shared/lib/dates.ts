export function formatDate(v: string) {
  return v
    ? new Intl.DateTimeFormat('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(`${v.slice(0, 10)}T12:00:00`))
    : '—';
}

export function isISODate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function parseDateInput(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);

  if (!match) return '';

  const iso = `${match[3]}-${match[2]}-${match[1]}`;

  return isISODate(iso) ? iso : '';
}

/** Põe as barras de DD/MM/YYYY enquanto se escrevem os números: «15122030» → «15/12/2030». */
export function maskDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}

/** Põe os dois pontos de HH:MM enquanto se escrevem os números: «1430» → «14:30». */
export function maskTime(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);

  return [digits.slice(0, 2), digits.slice(2)].filter(Boolean).join(':');
}

/** Hora válida de 24 horas, no formato HH:MM. */
export function isTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function localToday() {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
