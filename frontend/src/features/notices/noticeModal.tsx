import type { Elevator } from '@/features/elevators/types';
import { OfficialLetter } from '@/features/notices/OfficialLetter';
import type { ElevatorNotice } from '@/features/notices/types';
import { formatDate } from '@/shared/lib/dates';

const manualNoticeBody =
  'A Câmara Municipal de Aveiro identificou a necessidade de inspeção do elevador abaixo identificado. O pedido de inspeção é apresentado na plataforma externa utilizada pelo município. No Elevate pode acompanhar o pedido, o agendamento e o resultado da inspeção.';

function expiringNoticeBody(validUntil: string) {
  return `O certificado de inspeção do elevador abaixo identificado termina a ${formatDate(validUntil)}. O pedido de inspeção periódica deve ser apresentado com a antecedência indicada no aviso. O pedido é apresentado na plataforma externa utilizada pelo município. No Elevate pode acompanhar o pedido, o agendamento e o resultado da inspeção.`;
}

// Janela com o ofício de um aviso, aberta no painel e no histórico do elevador.
export function noticeModal(elevator: Elevator, n: ElevatorNotice) {
  return {
    title: `Aviso ${n.id}`,
    body: (
      <div className="official-notice">
        <OfficialLetter
          date={n.date}
          subject={n.type === 'Manual' ? n.subject : 'Prazo da inspeção periódica'}
          body={n.type === 'Manual' ? manualNoticeBody : expiringNoticeBody(elevator.validUntil)}
          elevator={elevator}
        />
      </div>
    ),
  };
}
