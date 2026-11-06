import { InspectionCalendar } from '@/features/dashboard/InspectionCalendar';
import { RequestCard } from '@/features/dashboard/RequestCard';
import { ElevatorTable } from '@/features/elevators/ElevatorTable';
import { noticeModal } from '@/features/notices/noticeModal';
import { localToday } from '@/shared/lib/dates';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Heading } from '@/shared/ui/Heading';
import { Icon } from '@/shared/ui/Icon';
import { Metric } from '@/shared/ui/Metric';
import { Panel } from '@/shared/ui/Panel';
import { Tabs } from '@/shared/ui/Tabs';
import { usePrototype } from '@/state';

export function DashboardPage() {
  const s = usePrototype();
  const owner = s.route.role === 'proprietario';
  const items = owner
    ? s.elevators.filter((e) => e.owner === 'Condomínio Edifício Ria')
    : s.elevators;
  // A vista fica no modelo para se manter ao voltar dos detalhes.
  const saved = s.dashboardView[s.route.role] || {
    view: 'Tabela',
    month: localToday().slice(0, 7) + '-01',
  };
  const { view, month } = saved;
  const update = (changes: Partial<typeof saved>) =>
    s.setDashboardView((previous) => ({
      ...previous,
      [s.route.role]: { ...saved, ...changes },
    }));
  const setView = (value: string) => update({ view: value });
  const count = (state: string) => items.filter((e) => e.status === state).length;
  const viewTabs = (
    <Tabs items={['Tabela', 'Calendário']} value={view} onChange={setView} label="Vista" />
  );

  return (
    <>
      <Heading
        title="Painel geral"
        description={
          owner
            ? 'Visão geral dos seus elevadores e pedidos de inspeção.'
            : 'Visão geral dos elevadores e inspeções do município.'
        }
      />
      {owner && (
        <Banner
          tone="warning"
          action={
            <Button
              className="primary"
              onClick={() => {
                const notice = s.elevatorNotices.find((n) => n.id === 'AV-001');
                const elevator = s.elevators.find((e) => e.id === notice?.elevator);
                if (notice && elevator) s.setModal(noticeModal(elevator, notice));
              }}
            >
              Ver aviso <Icon name="arrow" />
            </Button>
          }
        >
          <strong>Inspeção a vencer — 01.05.0079</strong>
          <p>
            O certificado termina a 12/12/2026. Consulte o aviso dirigido a si e à sua empresa de
            manutenção.
          </p>
        </Banner>
      )}
      <section className="metrics" aria-label="Indicadores">
        {owner ? (
          <>
            <Metric
              label="Elevadores registados"
              value={items.length}
              description="Sob a sua propriedade"
            />
            <Metric
              label="Inspeções válidas"
              value={count('Válida')}
              description="Certificado em vigor"
              tone="green"
            />
            <Metric
              label="A vencer"
              value={count('A vencer')}
              description="Prazo próximo do fim"
              tone="yellow"
            />
            <Metric
              label="Em atraso"
              value={count('Em atraso')}
              description="Certificado caducado"
              tone="red"
            />
          </>
        ) : (
          <>
            <Metric
              label="Validações pendentes"
              value={s.registrations.filter((r) => r.status === 'Por validar').length}
              description="Registos para analisar"
              tone="green"
            />
            <Metric
              label="A vencer"
              value={count('A vencer')}
              description="Prazo próximo do fim"
              tone="yellow"
            />
            <Metric
              label="Inspeções em atraso"
              value={count('Em atraso')}
              description="Certificado caducado"
              tone="red"
            />
            <Metric
              label="Inspeções reprovadas"
              value={count('Reprovada')}
              description="Necessitam de intervenção"
              tone="red"
            />
          </>
        )}
      </section>
      <Panel
        title={owner ? 'Os meus elevadores' : 'Elevadores'}
        tools={
          <div className="panel-tools">
            {viewTabs}
            <button
              className="text-button"
              onClick={() => s.go(owner ? 'elevadores' : 'cadastro')}
            >
              Ver todos os elevadores <Icon name="arrow" />
            </button>
          </div>
        }
      >
        {view === 'Calendário' ? (
          <InspectionCalendar
            items={items}
            month={month}
            setMonth={(value) => update({ month: value })}
          />
        ) : (
          <ElevatorTable items={owner ? items : items.slice(0, 5)} compact={!owner} />
        )}
      </Panel>
      {owner && (
        <div className="request-cards">
          {s.requests
            .filter((r) => items.some((e) => e.id === r.elevator))
            .map((r) => (
              <RequestCard key={r.id} request={r} />
            ))}
        </div>
      )}
    </>
  );
}
