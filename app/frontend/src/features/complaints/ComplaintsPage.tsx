import { useState } from 'react';
import { formatDate } from '@/shared/lib/dates';
import { normalize } from '@/shared/lib/text';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { DataTable } from '@/shared/ui/DataTable';
import { Empty } from '@/shared/ui/Empty';
import { Heading } from '@/shared/ui/Heading';
import { Panel } from '@/shared/ui/Panel';
import { Search } from '@/shared/ui/Search';
import { Tabs } from '@/shared/ui/Tabs';
import { usePrototype } from '@/app/state';

export function ComplaintsPage() {
  const s = usePrototype();
  const maintenance = s.route.role === 'manutencao';
  const [status, setStatus] = useState('Todas');
  const [query, setQuery] = useState('');
  const items = s.complaints.filter((complaint) => {
    const elevator = s.elevators.find((e) => e.id === complaint.elevator);
    return (
      elevator?.company === 'Elevar, Lda.' &&
      (status === 'Todas' || complaint.status === status) &&
      normalize(`${complaint.elevator} ${elevator.address} ${complaint.description}`).includes(
        normalize(query),
      )
    );
  });

  return (
    <>
      <Heading
        title="Reclamações"
        description={
          maintenance
            ? 'Problemas comunicados pelos residentes nos elevadores que mantém.'
            : 'Consulta das reclamações. A resolução pertence à EMA.'
        }
      />
      <Panel>
        <div className="filters">
          <Tabs
            items={['Todas', 'Aberta', 'Resolvida']}
            value={status}
            onChange={setStatus}
            label="Estado da reclamação"
          />
          <Search value={query} onChange={setQuery} />
          <button
            className="text-button clear-filters"
            onClick={() => {
              setQuery('');
              setStatus('Todas');
            }}
          >
            Limpar filtros
          </button>
          {maintenance && (
            <Button className="add-button" onClick={() => s.go('reclamacao')}>
              <span aria-hidden="true">+</span> Registar nova reclamação
            </Button>
          )}
        </div>
        <DataTable headers={['Elevador / morada', 'Recebida em', 'Descrição', 'Estado', 'Ação']}>
          {items.map((complaint) => (
            <tr key={complaint.id}>
              <td>
                <strong>{complaint.elevator}</strong>
                <small>{s.elevators.find((e) => e.id === complaint.elevator)?.address}</small>
              </td>
              <td>{formatDate(complaint.received)}</td>
              <td className="description-cell">{complaint.description}</td>
              <td>
                <Badge>{complaint.status}</Badge>
              </td>
              <td>
                {s.canResolveComplaint(complaint.id) ? (
                  <Button onClick={() => s.resolveComplaint(complaint.id)}>
                    Assinalar como resolvida
                  </Button>
                ) : complaint.responded ? (
                  formatDate(complaint.responded)
                ) : (
                  'A aguardar resolução pela EMA'
                )}
              </td>
            </tr>
          ))}
          {!items.length && (
            <tr>
              <td colSpan={5}>
                <Empty>Altere os filtros para encontrar outras reclamações.</Empty>
              </td>
            </tr>
          )}
        </DataTable>
        <div className="panel-footer">{items.length} reclamação(ões)</div>
      </Panel>
    </>
  );
}
