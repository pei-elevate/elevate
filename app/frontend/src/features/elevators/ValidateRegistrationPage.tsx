import { useEffect, useState } from 'react';
import { approveRegistration, decisionError, rejectRegistration } from '@/features/elevators/api';
import { listPermits } from '@/features/permits/api';
import type { PermitSummary } from '@/features/permits/api';
import { formatDate } from '@/shared/lib/dates';
import { Badge } from '@/shared/ui/Badge';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Empty } from '@/shared/ui/Empty';
import { Heading } from '@/shared/ui/Heading';
import { Icon } from '@/shared/ui/Icon';
import { Pagination, usePagination } from '@/shared/ui/Pagination';
import { Panel } from '@/shared/ui/Panel';
import { Summary } from '@/shared/ui/Summary';
import { usePrototype } from '@/app/state';

export function ValidateRegistrationPage() {
  const s = usePrototype();
  const role = s.route.role;
  const pending = s.pendingRegistrations;
  const pendingPages = usePagination(pending ?? []);
  const [permits, setPermits] = useState<PermitSummary[]>([]);
  const [permitsError, setPermitsError] = useState(false);
  // Muda para voltar a pedir os alvarás ao backend.
  const [permitReloads, setPermitReloads] = useState(0);
  const loadError = s.pendingError || permitsError;
  const [selected, setSelected] = useState(Number(s.route.id) || 0);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  // Id do alvará escolhido ('' = sem alvará); null mantém o sugerido.
  const [association, setAssociation] = useState<string | null>(null);
  const reg = pending?.find((r) => r.id === selected) || pending?.[0];

  // biome-ignore lint/correctness/useExhaustiveDependencies: permitReloads é o gatilho para tentar de novo
  useEffect(() => {
    let cancelled = false;
    setPermitsError(false);
    listPermits(role)
      .then((items) => {
        if (!cancelled) setPermits(items);
      })
      .catch(() => {
        if (!cancelled) setPermitsError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [role, permitReloads]);

  function retry() {
    s.reloadPendingRegistrations();
    setPermitReloads((n) => n + 1);
  }

  function reset() {
    s.dirty.current = false;
    setReason('');
    setError('');
    setAssociation(null);
  }

  function decide(approve: boolean) {
    if (!reg) return;

    if (!approve && !reason.trim()) {
      setError('Indique o motivo da rejeição.');
      document.getElementById('reason')?.focus();

      return;
    }

    const chosen = association ?? String(reg.permit?.id ?? '');
    const summary = `O registo de ${reg.address}, submetido por ${reg.maintenance_company.name}`;

    s.confirm(
      approve ? 'Aprovar registo' : 'Rejeitar registo',
      approve
        ? 'Aprovar os dados e atribuir uma referência interna ao elevador?'
        : `Motivo: ${reason.trim()}`,
      async () => {
        try {
          const result = approve
            ? await approveRegistration(role, reg.id, chosen ? Number(chosen) : null)
            : await rejectRegistration(role, reg.id, reason.trim());

          s.setPendingRegistrations((items) => items?.filter((r) => r.id !== reg.id) ?? null);
          // Volta a pedir a lista: um pedido feito antes da decisão é descartado e não pode
          // trazer de volta o registo já decidido.
          s.reloadPendingRegistrations();
          reset();
          s.setModal(
            approve
              ? {
                  title: 'Registo aprovado',
                  body: (
                    <>
                      <p>{summary}, foi aprovado.</p>
                      <p>
                        <strong>Referência interna atribuída:</strong> {result.internal_reference}
                      </p>
                    </>
                  ),
                }
              : {
                  title: 'Registo rejeitado',
                  body: (
                    <>
                      <p>{summary}, foi rejeitado.</p>
                      <p>
                        <strong>Motivo:</strong> {result.rejected_reason}
                      </p>
                    </>
                  ),
                  tone: 'danger',
                },
          );
        } catch (e) {
          s.setModal({ title: 'Decisão não guardada', body: decisionError(e), tone: 'danger' });
          retry();
        }
      },
      approve ? 'Aprovar e atribuir referência' : 'Rejeitar registo',
      approve ? undefined : 'danger',
    );
  }

  return (
    <>
      <Heading
        title="Validar registo"
        description="Registos submetidos pelas empresas de manutenção."
      />
      {loadError ? (
        <Banner tone="warning" action={<Button onClick={retry}>Tentar novamente</Button>}>
          Não foi possível carregar os registos.
        </Banner>
      ) : !pending ? (
        <Panel>
          <p role="status">A carregar registos…</p>
        </Panel>
      ) : !reg ? (
        <Panel>
          <Empty>Todos os registos foram analisados.</Empty>
        </Panel>
      ) : (
        <div className="split-panel">
          <Panel title={`Por validar (${pending.length})`} className="selection-list">
            {pendingPages.items.map((r) => (
              <button
                key={r.id}
                className={`selection-item ${reg.id === r.id ? 'selected' : ''}`}
                aria-pressed={reg.id === r.id}
                onClick={() => {
                  if (s.dirty.current && !window.confirm('Descartar a decisão por guardar?'))
                    return;

                  reset();
                  setSelected(r.id);
                }}
              >
                <strong>{r.address}</strong>
                <span>{r.maintenance_company.name}</span>
              </button>
            ))}
            <Pagination pagination={pendingPages} footer />
          </Panel>
          <Panel className="validation-panel">
            <div className="panel-heading">
              <h2>{reg.address}</h2>
              <Badge>Por validar</Badge>
            </div>
            <div className="association">
              <label htmlFor="association">Alvará do Urbanismo associado</label>
              <small>Altere a associação se o registo corresponder a outro alvará.</small>
              <select
                id="association"
                value={association ?? String(reg.permit?.id ?? '')}
                onChange={(e) => {
                  setAssociation(e.target.value);
                  s.dirty.current = true;
                }}
              >
                <option value="">Sem alvará associado</option>
                {/* O sugerido aparece já, mesmo antes de a lista de alvarás chegar. */}
                {(reg.permit && !permits.some((p) => p.id === reg.permit?.id)
                  ? [reg.permit, ...permits]
                  : permits
                ).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.permit_number} — {p.address}
                  </option>
                ))}
              </select>
            </div>
            <Summary
              items={[
                [
                  'Morada',
                  `${reg.address}${reg.building ? ` — ${reg.building}` : ''}, ${reg.postal_code}, Aveiro`,
                ],
                ['Freguesia', reg.parish],
                ['Entidade', `${reg.owner.name} · NIF ${reg.owner.nif}`],
                [
                  'Contacto do proprietário',
                  [reg.owner.email, reg.owner.phone].filter(Boolean).join(' · '),
                ],
                ['Empresa de manutenção', reg.maintenance_company.name],
                ['Entrada em serviço', formatDate(reg.service_date)],
              ]}
            />
            {reg.registration_document && (
              <div className="inset">
                <button
                  className="text-button"
                  onClick={() => s.report(reg.registration_document ?? '', 'Documento de suporte')}
                >
                  <Icon name="download" />
                  {reg.registration_document}
                </button>
              </div>
            )}
            <section className="decision">
              <h3>Decisão</h3>
              <label htmlFor="reason">Motivo (obrigatório em caso de rejeição)</label>
              <textarea
                id="reason"
                rows={3}
                value={reason}
                aria-invalid={!!error}
                aria-describedby={error ? 'reason-error' : undefined}
                placeholder="Ex.: O NIF não corresponde aos dados do edifício."
                onChange={(e) => {
                  setReason(e.target.value);
                  s.dirty.current = true;
                  setError('');
                }}
              />
              {error && (
                <p id="reason-error" className="field-error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <Button className="danger" onClick={() => decide(false)}>
                  Rejeitar
                </Button>
                <Button className="primary" onClick={() => decide(true)}>
                  Aprovar e atribuir referência
                </Button>
              </div>
            </section>
          </Panel>
        </div>
      )}
    </>
  );
}
