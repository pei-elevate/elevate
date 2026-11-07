import type { Elevator } from '@/features/elevators/types';
import { formatDate } from '@/shared/lib/dates';
import { Summary } from '@/shared/ui/Summary';

// Ofício da Câmara, mostrado na janela de um aviso.
export function OfficialLetter({
  date,
  subject,
  body,
  elevator,
}: {
  date: string;
  subject: string;
  body: string;
  elevator: Elevator;
}) {
  return (
    <>
      <div className="letter-header">
        <strong>CÂMARA MUNICIPAL DE AVEIRO</strong>
        <h2>Ofício</h2>
        <p>Ref. OF-2026-0412 · {formatDate(date)}</p>
      </div>
      <p>
        <strong>Para:</strong> {elevator.owner}
        <br />
        <strong>Conhecimento:</strong> {elevator.company} — empresa de manutenção
      </p>
      <h3>
        {subject} — {elevator.id}
      </h3>
      <p>{body}</p>
      <Summary
        items={[
          ['Referência interna', elevator.id],
          ['N.º DGE', elevator.dge],
          ['Morada', elevator.address],
          ['Empresa de manutenção', elevator.company],
          ['Certificado válido até', formatDate(elevator.validUntil)],
        ]}
      />
    </>
  );
}
