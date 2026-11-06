import { useState } from 'react';
import { decideRegistration } from '@/features/elevators/rules';
import { formatDate } from '@/shared/lib/dates';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Empty } from '@/shared/ui/Empty';
import { Heading } from '@/shared/ui/Heading';
import { Icon } from '@/shared/ui/Icon';
import { Panel } from '@/shared/ui/Panel';
import { Summary } from '@/shared/ui/Summary';
import { usePrototype } from '@/state';

export function ValidateRegistrationPage() {
  const s = usePrototype();
  const pending = s.registrations.filter((r) => r.status === 'Por validar');
  const [selected, setSelected] = useState(s.route.id || pending[0]?.id || '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [association, setAssociation] = useState<string | null>(null);
  const reg = pending.find((r) => r.id === selected) || pending[0];

  function decide(approve: boolean) {
    if (!reg) return;

    if (!approve && !reason.trim()) {
      setError('Indique o motivo da rejeição.');
      document.getElementById('reason')?.focus();

      return;
    }

    s.confirm(
      approve ? 'Aprovar registo' : 'Rejeitar registo',
      approve
        ? 'Aprovar os dados e atribuir uma referência interna ao elevador?'
        : `Motivo: ${reason.trim()}`,
      () => {
        const next = decideRegistration(
          { registrations: s.registrations, elevators: s.elevators, urbanNotices: s.urbanNotices },
          reg.id,
          approve,
          reason,
          association ?? reg.permit,
        );
        s.setRegistrations(next.registrations);
        s.setElevators(next.elevators);
        s.setUrbanNotices(next.urbanNotices);
        if (approve)
          s.setModal({
            title: 'Registo aprovado',
            body: (
              <>
                <p>
                  O registo de {reg.address}, submetido por {reg.company}, foi aprovado.
                </p>
                <p>
                  <strong>Referência interna atribuída:</strong> {next.elevators.at(-1)?.id}
                </p>
              </>
            ),
          });
        else
          s.setModal({
            title: 'Registo rejeitado',
            body: (
              <>
                <p>
                  O registo de {reg.address}, submetido por {reg.company}, foi rejeitado.
                </p>
                <p>
                  <strong>Motivo:</strong> {reason.trim()}
                </p>
              </>
            ),
            tone: 'danger',
          });
        s.dirty.current = false;
        setReason('');
        setError('');
        setAssociation(null);
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
      {!reg ? (
        <Panel>
          <Empty>Todos os registos foram analisados.</Empty>
        </Panel>
      ) : (
        <div className="split-panel">
          <Panel title={`Por validar (${pending.length})`} className="selection-list">
            {pending.map((r) => (
              <button
                key={r.id}
                className={`selection-item ${reg.id === r.id ? 'selected' : ''}`}
                aria-pressed={reg.id === r.id}
                onClick={() => {
                  if (s.dirty.current && !window.confirm('Descartar a decisão por guardar?'))
                    return;

                  s.dirty.current = false;
                  setSelected(r.id);
                  setReason('');
                  setError('');
                  setAssociation(null);
                }}
              >
                <strong>{r.address}</strong>
                <span>{r.company}</span>
              </button>
            ))}
          </Panel>
          <Panel className="validation-panel">
            <div className="panel-heading">
              <h2>{reg.address}</h2>
              <Badge>{reg.status}</Badge>
            </div>
            <div className="association">
              <label htmlFor="association">Alvará do Urbanismo associado</label>
              <small>Altere a associação se o registo corresponder a outro alvará.</small>
              <select
                id="association"
                value={association ?? reg.permit}
                onChange={(e) => {
                  setAssociation(e.target.value);
                  s.dirty.current = true;
                }}
              >
                <option value="">Sem alvará associado</option>
                {s.urbanNotices.map((n) => (
                  <option key={n.id} value={n.permit}>
                    {n.permit} — {n.address}
                  </option>
                ))}
              </select>
            </div>
            <Summary
              items={[
                ['Morada', `${reg.address}, ${reg.postal}, Aveiro`],
                ['Freguesia', reg.parish],
                ['Entidade', `${reg.owner} · NIF ${reg.nif}`],
                ['Contacto do proprietário', [reg.email, reg.phone].filter(Boolean).join(' · ')],
                ['N.º DGE', reg.dge || 'Por atribuir'],
                ['Empresa de manutenção', reg.company],
                ['Entrada em serviço', formatDate(reg.service)],
              ]}
            />
            {reg.document && (
              <div className="inset">
                <button
                  className="text-button"
                  onClick={() => s.report(reg.id, 'Documento de suporte', s.documents[reg.id])}
                >
                  <Icon name="download" />
                  {reg.document}
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
