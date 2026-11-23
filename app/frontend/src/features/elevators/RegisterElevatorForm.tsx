import { useState } from 'react';
import type { FormEvent } from 'react';
import { usePrototype } from '@/app/state';
import {
  correctRegistration,
  registrationError,
  submitRegistration,
} from '@/features/elevators/api';
import type { ApiRegistration } from '@/features/elevators/api';
import { toRegistrationBody, toRegistrationValues } from '@/features/elevators/registration';
import { validateRegistration } from '@/features/elevators/validation';
import { FormShell } from '@/shared/forms/FormShell';
import { OwnerAddressFields } from '@/shared/forms/OwnerAddressFields';
import { useSubmissionForm } from '@/shared/forms/useSubmissionForm';
import { localToday } from '@/shared/lib/dates';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Heading } from '@/shared/ui/Heading';
import { Panel } from '@/shared/ui/Panel';

const title = 'Registar elevador';

/** Registo de um elevador novo, ou correção de um registo rejeitado (`registar/<id>`). */
export function RegisterElevatorForm() {
  const s = usePrototype();

  if (!s.route.id) return <RegistrationForm />;

  // A correção parte do registo rejeitado, que vem da lista dos registos submetidos.
  if (s.route.role === 'manutencao' && !s.submittedRegistrations)
    return (
      <>
        <Heading title="Corrigir registo" />
        {s.submittedError ? (
          <Banner
            tone="warning"
            action={<Button onClick={s.reloadSubmittedRegistrations}>Tentar de novo</Button>}
          >
            Não foi possível carregar o registo.
          </Banner>
        ) : (
          <p role="status">A carregar registo…</p>
        )}
      </>
    );

  const registration = s.submittedRegistrations?.find((r) => String(r.id) === s.route.id);

  if (s.route.role !== 'manutencao' || registration?.registration_status !== 'rejected')
    return (
      <>
        <Heading title="Registo indisponível para correção" />
        <Button onClick={() => s.go('elevadores')}>Voltar aos elevadores</Button>
      </>
    );

  return <RegistrationForm registration={registration} />;
}

function RegistrationForm({ registration }: { registration?: ApiRegistration }) {
  const s = usePrototype();
  const form = useSubmissionForm({
    dirty: s.dirty,
    initial: registration ? toRegistrationValues(registration) : { ownerType: 'Condomínio' },
    initialDocument: registration?.registration_document ?? '',
  });
  // Erro da API que não pertence a nenhum campo (ex.: servidor indisponível).
  const [saveError, setSaveError] = useState('');
  const { values, file, keptDocument, field, upload } = form;
  const parent = 'elevadores';
  const back = () => s.go(parent);

  function submit(event: FormEvent) {
    form.submit(
      event,
      () => validateRegistration(values, file),
      () => {
        void saveRegistration();
      },
    );
  }

  async function saveRegistration() {
    setSaveError('');
    try {
      await form.save(async () => {
        // Por agora só o nome do documento: o ficheiro espera pelo armazenamento de ficheiros.
        const body = toRegistrationBody(values, file?.name || keptDocument);

        if (registration) await correctRegistration(s.route.role, registration.id, body);
        else await submitRegistration(s.route.role, body);
        s.reloadSubmittedRegistrations();
        s.notify(
          registration
            ? 'Registo corrigido e novamente submetido para validação.'
            : 'Registo submetido. Aguarda validação municipal.',
        );
      });
    } catch (error) {
      const { field, message } = registrationError(error);

      if (field) form.setErrors((errors) => ({ ...errors, [field]: message }));
      else setSaveError(message);

      return;
    }
    back();
  }

  return (
    <>
      <Heading
        title={registration ? 'Corrigir registo' : title}
        description="Comunicar um novo elevador ao município."
        onBack={s.route.id ? () => s.back(parent) : undefined}
      />
      {registration?.rejected_reason && (
        <Banner tone="warning">
          <strong>Motivo da rejeição anterior:</strong> {registration.rejected_reason}
        </Banner>
      )}
      <Banner>
        Após a submissão, o município valida o registo e atribui uma referência interna ao elevador.
      </Banner>
      {saveError && (
        <div role="alert">
          <Banner tone="warning">{saveError}</Banner>
        </div>
      )}
      <FormShell
        form={form}
        title={title}
        onSubmit={submit}
        onCancel={back}
        submitLabel={registration ? 'Voltar a submeter' : 'Submeter registo'}
      >
        <OwnerAddressFields field={field} variant="registration" />
        <Panel title="Elevador">
          <div className="form-grid">
            {field('service', 'Entrada em serviço', {
              type: 'date',
              required: true,
              max: localToday(),
            })}
            {field('dge', 'Número DGE', { placeholder: 'Se já atribuído' })}
          </div>
        </Panel>
        <Panel title="Documentos de suporte">
          <div className="form-grid">{upload()}</div>
        </Panel>
      </FormShell>
    </>
  );
}
