import type { ReactNode } from 'react';

export function badgeTone(label: string) {
  return ['Válida', 'Aprovada', 'Resolvida', 'Corrigida', 'Registado'].includes(label)
    ? 'green'
    : ['Em atraso', 'Reprovada', 'Não corrigida', 'Rejeitado', 'Não registado'].includes(label)
      ? 'red'
      : ['A vencer', 'Por validar', 'Submetido', 'Aberta', 'Por agendar'].includes(label)
        ? 'yellow'
        : ['Agendado', 'Aviso', 'Reclamação'].includes(label)
          ? 'blue'
          : 'neutral';
}

export function Badge({ children }: { children: ReactNode }) {
  const tone = badgeTone(String(children));

  return (
    <span className={`badge ${tone}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}
