import { useState } from 'react';
import { elevatorHistory } from '@/features/elevators/rules';
import type { Elevator } from '@/features/elevators/types';
import { noticeModal } from '@/features/notices/noticeModal';
import { sendManualNotice } from '@/features/notices/rules';
import { formatDate } from '@/shared/lib/dates';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { DataTable } from '@/shared/ui/DataTable';
import { Empty } from '@/shared/ui/Empty';
import { Heading } from '@/shared/ui/Heading';
import { Icon } from '@/shared/ui/Icon';
import { Panel } from '@/shared/ui/Panel';
import { Summary } from '@/shared/ui/Summary';
import { Tabs } from '@/shared/ui/Tabs';
import { usePrototype } from '@/state';

export function ElevatorDetailsPage() {
  const s = usePrototype();
  const e = s.elevators.find((e) => e.id === s.route.id);
  const [tab, setTab] = useState('Inspeções');

  if (!e)
    return (
      <>
        <Heading title="Elevador não encontrado" />
        <Button onClick={() => s.go(s.route.role === 'gestor' ? 'cadastro' : 'elevadores')}>
          Voltar aos elevadores
        </Button>
      </>
    );

  const manager = s.route.role === 'gestor',
    owner = s.route.role === 'proprietario';
  const history = elevatorHistory(e.id, s.requests);
  const notices = s.elevatorNotices.filter((n) => n.elevator === e.id);

  function sendNotice(elevator: Elevator) {
    s.confirm(
      'Enviar aviso de inspeção',
      `Enviar um aviso de necessidade de inspeção do ${elevator.id} a ${elevator.owner} (proprietário) e a ${elevator.company} (empresa de manutenção)? Neste protótipo não será enviado correio eletrónico.`,
      () => {
        s.setElevatorNotices((items) => sendManualNotice(items, elevator));
        setTab('Avisos');
        s.notify('Aviso de necessidade de inspeção enviado.');
      },
      'Enviar aviso',
    );
  }

  const inspectionTable = (
    <DataTable
      headers={[
        'N.º de processo',
        'Data do processo',
        'Âmbito',
        'Empresa de inspeção',
        'Data da inspeção',
        'Resultado',
        'Relatório',
      ]}
    >
      {history.map((h) => (
        <tr key={h.entry}>
          <td>
            <strong>{h.entry}</strong>
          </td>
          <td>{formatDate(h.date)}</td>
          <td>{h.scope}</td>
          <td>{e.inspector}</td>
          <td>{formatDate(h.performed)}</td>
          <td>
            <Badge>{h.result}</Badge>
          </td>
          <td>
            <button
              className="text-button"
              aria-label={`Descarregar relatório ${h.entry}`}
              onClick={() => s.report(h.entry, h.result)}
            >
              <Icon name="download" />
              Descarregar relatório
            </button>
          </td>
        </tr>
      ))}
      {!history.length && (
        <tr>
          <td colSpan={7}>
            <Empty>Ainda não há inspeções concluídas para este elevador.</Empty>
          </td>
        </tr>
      )}
    </DataTable>
  );

  const noticeTable = (
    <DataTable headers={['Data', 'Tipo', 'Assunto', 'Destinatários', 'Ofício']}>
      {notices.map((n) => (
        <tr key={n.id}>
          <td>{formatDate(n.date)}</td>
          <td>{n.type}</td>
          <td>{n.subject}</td>
          <td>{n.recipients}</td>
          <td>
            <button
              className="text-button"
              aria-label={`Ver ofício ${n.id}`}
              onClick={() => s.setModal(noticeModal(e, n))}
            >
              Ver ofício <Icon name="arrow" />
            </button>
          </td>
        </tr>
      ))}
      {!notices.length && (
        <tr>
          <td colSpan={5}>
            <Empty>Sem avisos enviados.</Empty>
          </td>
        </tr>
      )}
    </DataTable>
  );

  const complaintTable = (
    <DataTable headers={['Recebida em', 'Descrição', 'Respondida em', 'Estado']}>
      {s.complaints
        .filter((c) => c.elevator === e.id)
        .map((c) => (
          <tr key={c.id}>
            <td>{formatDate(c.received)}</td>
            <td>{c.description}</td>
            <td>{formatDate(c.responded || '')}</td>
            <td>
              <Badge>{c.status}</Badge>
            </td>
          </tr>
        ))}
      {!s.complaints.some((c) => c.elevator === e.id) && (
        <tr>
          <td colSpan={4}>
            <Empty>Sem reclamações registadas.</Empty>
          </td>
        </tr>
      )}
    </DataTable>
  );

  return (
    <>
      <div className="breadcrumb">
        {s.origin ? (
          <button onClick={() => s.go(s.origin!.page)}>{s.origin.label}</button>
        ) : (
          <button onClick={() => s.go(manager ? 'cadastro' : 'elevadores')}>
            {manager
              ? 'Elevadores registados'
              : s.route.role === 'manutencao'
                ? 'Painel geral'
                : owner
                  ? 'Os meus elevadores'
                  : 'Elevadores'}
          </button>
        )}
        <span>/</span>
        <span>{e.id}</span>
      </div>
      <Heading
        title={`Elevador ${e.id}`}
        description={`${e.owner} · ${e.address}, Aveiro`}
        status={e.status}
        onBack={() => s.back(s.origin?.page || (manager ? 'cadastro' : 'elevadores'))}
        action={
          manager && (
            <Button className="primary" onClick={() => sendNotice(e)}>
              Enviar aviso de inspeção
            </Button>
          )
        }
      />
      <Panel title={manager || owner ? 'Elevador' : undefined}>
        <Summary
          items={[
            ['Referência interna', e.id],
            ['N.º DGE', e.dge],
            ['Entidade', e.owner],
            ['Morada', e.address],
            ['Empresa de manutenção (EMA)', e.company],
            ['Empresa de inspeção', e.inspector],
            ['Última entrada', `${e.entry} · ${formatDate(e.entryDate)}`],
            ['Válido até', formatDate(e.validUntil)],
          ]}
        />
      </Panel>
      {manager || owner ? (
        <Panel
          title="Histórico"
          tools={
            <Tabs
              items={['Inspeções', 'Avisos', 'Reclamações']}
              value={tab}
              onChange={setTab}
              label="Histórico a mostrar"
            />
          }
        >
          {tab === 'Avisos' ? noticeTable : tab === 'Reclamações' ? complaintTable : inspectionTable}
        </Panel>
      ) : (
        <>
          <Panel title="Histórico de inspeções">{inspectionTable}</Panel>
          <Panel title="Histórico de reclamações">{complaintTable}</Panel>
        </>
      )}
    </>
  );
}
