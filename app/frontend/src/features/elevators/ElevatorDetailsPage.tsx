import { useEffect, useState } from 'react';
import {
  getElevator,
  listElevatorInspections,
  listElevatorNotices,
  load,
  toElevator,
  toInspectionRow,
  toNotice,
} from '@/features/elevators/api';
import { elevatorDataModal } from '@/features/elevators/elevatorDataModal';
import type { Elevator } from '@/features/elevators/types';
import { noticeModal } from '@/features/notices/noticeModal';
import { sendManualNotice } from '@/features/notices/rules';
import { ApiError } from '@/shared/api/client';
import type { Role } from '@/shared/auth/roles';
import { formatDate } from '@/shared/lib/dates';
import { Banner } from '@/shared/ui/Banner';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { DataTable } from '@/shared/ui/DataTable';
import { Empty } from '@/shared/ui/Empty';
import { Heading } from '@/shared/ui/Heading';
import { Icon } from '@/shared/ui/Icon';
import { Panel } from '@/shared/ui/Panel';
import { Summary } from '@/shared/ui/Summary';
import { Tabs } from '@/shared/ui/Tabs';
import { usePrototype } from '@/app/state';
import { useReportDownload } from '@/features/inspections/useReportDownload';

type LoadError = 'not_found' | 'failed' | null;

/**
 * Pede um recurso do elevador `key` e guarda-o, com o erro (404 → «não encontrado»).
 * Com `key` null não faz pedido. `fetcher` tem de ser estável (uma função do módulo).
 */
function useElevatorResource<T>(
  fetcher: (role: Role, id: number) => Promise<T>,
  role: Role,
  key: number | null,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<LoadError>(null);
  const [reloads, setReloads] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloads é um gatilho, para tentar de novo
  useEffect(() => {
    if (key === null) return;

    setData(null);
    setError(null);

    return load(
      () => fetcher(role, key),
      (value) => setData(() => value),
      (e) => setError(e instanceof ApiError && e.status === 404 ? 'not_found' : 'failed'),
    );
  }, [fetcher, role, key, reloads]);

  return { data, error, retry: () => setReloads((n) => n + 1) };
}

// Linha da tabela enquanto o histórico carrega ou quando falhou.
function HistoryState({
  colSpan,
  error,
  onRetry,
}: {
  colSpan: number;
  error: LoadError;
  onRetry: () => void;
}) {
  return (
    <tr>
      <td colSpan={colSpan}>
        {error ? (
          <Banner tone="warning" action={<Button onClick={onRetry}>Tentar de novo</Button>}>
            Não foi possível carregar o histórico.
          </Banner>
        ) : (
          <p role="status">A carregar…</p>
        )}
      </td>
    </tr>
  );
}

export function ElevatorDetailsPage() {
  const s = usePrototype();
  const download = useReportDownload();
  const role = s.route.role;
  // O URL leva o id numérico da API; outro valor nem chega a ser pedido.
  const key = /^\d+$/.test(s.route.id) ? Number(s.route.id) : null;
  const manager = role === 'gestor',
    owner = role === 'proprietario';
  const detail = useElevatorResource(getElevator, role, key);
  const inspections = useElevatorResource(listElevatorInspections, role, key);
  // A vista da EMA não tem o separador de avisos.
  const apiNotices = useElevatorResource(listElevatorNotices, role, manager || owner ? key : null);
  const [tab, setTab] = useState('Inspeções');
  const back = () => s.go(manager ? 'cadastro' : 'elevadores');

  if (key === null || detail.error === 'not_found')
    return (
      <>
        <Heading title="Elevador não encontrado" />
        <Button onClick={back}>Voltar aos elevadores</Button>
      </>
    );
  if (!detail.data)
    return (
      <>
        <Heading title="A carregar elevador…" />
        {detail.error && (
          <Banner tone="warning" action={<Button onClick={detail.retry}>Tentar de novo</Button>}>
            Não foi possível carregar o elevador.
          </Banner>
        )}
      </>
    );

  const data = detail.data;
  const e = toElevator(data);
  const history = inspections.data?.map(toInspectionRow) ?? [];
  const notices = [
    ...s.simulatedNotices.filter((n) => n.elevator === e.id),
    ...(apiNotices.data?.map((n) => toNotice(n, e.id)) ?? []),
  ];

  function sendNotice(elevator: Elevator) {
    s.confirm(
      'Enviar aviso de inspeção',
      `Enviar um aviso de necessidade de inspeção do ${elevator.id} a ${elevator.owner} (proprietário) e a ${elevator.company} (empresa de manutenção)? Neste protótipo não será enviado correio eletrónico.`,
      () => {
        s.setSimulatedNotices((items) => sendManualNotice(items, elevator));
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
          <td>{h.inspector}</td>
          <td>{formatDate(h.performed)}</td>
          <td>
            <Badge>{h.result}</Badge>
          </td>
          <td>
            <button
              className="text-button"
              aria-label={`Descarregar relatório ${h.entry}`}
              onClick={() => download({ id: h.entry, key: h.key, result: h.result })}
            >
              <Icon name="download" />
              Descarregar relatório
            </button>
          </td>
        </tr>
      ))}
      {!inspections.data ? (
        <HistoryState colSpan={7} error={inspections.error} onRetry={inspections.retry} />
      ) : (
        !history.length && (
          <tr>
            <td colSpan={7}>
              <Empty>Ainda não há inspeções concluídas para este elevador.</Empty>
            </td>
          </tr>
        )
      )}
    </DataTable>
  );

  const noticeTable = (
    <DataTable headers={['Data', 'Tipo', 'Assunto', 'Ofício']}>
      {notices.map((n) => (
        <tr key={n.id}>
          <td>{formatDate(n.date)}</td>
          <td>{n.type}</td>
          <td>{n.subject}</td>
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
      {!apiNotices.data ? (
        <HistoryState colSpan={4} error={apiNotices.error} onRetry={apiNotices.retry} />
      ) : (
        !notices.length && (
          <tr>
            <td colSpan={4}>
              <Empty>Sem avisos enviados.</Empty>
            </td>
          </tr>
        )
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
          <button onClick={back}>
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
      <Panel
        title={manager || owner ? 'Elevador' : undefined}
        tools={
          <Button onClick={() => s.setModal(elevatorDataModal(data))}>Ver todos os dados</Button>
        }
      >
        <Summary
          items={[
            ['Referência interna', e.id],
            ['Morada', e.address],
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
          {tab === 'Avisos'
            ? noticeTable
            : tab === 'Reclamações'
              ? complaintTable
              : inspectionTable}
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
