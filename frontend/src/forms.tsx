import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Heading } from '@/shared/ui/Heading';
import { Panel } from '@/shared/ui/Panel';
import { Summary } from '@/shared/ui/Summary';
import { usePrototype } from '@/app/state';
import { certificateStatus, resubmitRegistration } from '@/features/elevators/rules';
import { updateSchedule } from '@/features/inspections/rules';
import { reconcileNotices } from '@/features/permits/rules';
import type { Values } from '@/shared/forms/types';
import { validateSubmission } from '@/shared/forms/validation';
import { formatDate, isISODate, localToday, parseDateInput } from '@/shared/lib/dates';

type Kind = 'registar' | 'novo-aviso' | 'reclamacao' | 'agendar' | 'resultado';

const titles: Record<Kind, string> = {
  registar: 'Registar elevador',
  'novo-aviso': 'Registar novo alvará',
  reclamacao: 'Registar reclamação',
  agendar: 'Agendar inspeção',
  resultado: 'Submeter resultado da inspeção',
};

export function PrototypeForm({ kind }: { kind: Kind }) {
  const s = usePrototype();
  const request = s.requests.find((r) => r.id === s.route.id);
  const registration =
    kind === 'registar' ? s.registrations.find((r) => r.id === s.route.id) : undefined;
  const rescheduling = kind === 'agendar' && request?.status === 'Agendado';
  const elevator = s.elevators.find((e) => e.id === request?.elevator);
  const [values, setValues] = useState<Values>({
    ownerType: 'Condomínio',
    status: 'Aberta',
    elevator: s.elevators.some((e) => e.id === s.route.id) ? s.route.id : '',
    result: 'Aprovada',
    time: '09:00',
    count: '1',
    received: localToday(),
    performed: localToday(),
    company: 'Elevar, Lda.',
    ...(registration
      ? {
          address: registration.address,
          postal: registration.postal,
          parish: registration.parish,
          owner: registration.owner,
          nif: registration.nif,
          email: registration.email,
          service: registration.service,
          ownerType: registration.ownerType || 'Condomínio',
          dge: registration.dge || '',
          block: registration.block || '',
          phone: registration.phone || '',
        }
      : {}),
    ...(kind === 'agendar' && request?.scheduled
      ? {
          date: request.scheduled.slice(0, 10),
          time: request.scheduled.slice(11),
        }
      : {}),
  });
  const [file, setFile] = useState<File | null>(
    registration ? s.documents[registration.id] || null : null,
  );
  const [keptDocument, setKeptDocument] = useState(registration?.document || '');
  const fileInput = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Values>({});
  const [saving, setSaving] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const parent =
    kind === 'registar'
      ? 'elevadores'
      : kind === 'novo-aviso'
        ? 'avisos'
        : kind === 'reclamacao'
          ? 'reclamacoes'
          : kind === 'agendar' && !rescheduling
            ? 'agendar'
            : 'atribuidas';
  const back = () => s.go(parent);

  function change(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    s.dirty.current = true;

    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  }

  const field = (
    name: string,
    label: string,
    options: {
      type?: string;
      placeholder?: string;
      required?: boolean;
      options?: (string | { value: string; label: string })[];
      wide?: boolean;
      hint?: string;
      min?: string;
      max?: string;
    } = {},
  ) => {
    const date = options.type === 'date';
    const hint = date
      ? [
          'Formato DD/MM/YYYY.',
          options.min ? `A partir de ${formatDate(options.min)}.` : '',
          options.max ? `Até ${formatDate(options.max)}.` : '',
        ]
          .filter(Boolean)
          .join(' ')
      : options.hint;
    const props = {
      id: name,
      name,
      value: values[name] || '',
      required: options.required,
      'aria-invalid': !!errors[name],
      'aria-describedby': errors[name] ? `${name}-error` : hint ? `${name}-hint` : undefined,
      onChange: (e: { target: { value: string } }) => change(name, e.target.value),
    };

    return (
      <div className={`field ${options.wide ? 'wide' : ''}`} key={name}>
        <label htmlFor={name}>
          {label}
          {options.required && <span aria-hidden="true"> *</span>}
        </label>
        {options.options ? (
          <select {...props}>
            <option value="">Selecionar…</option>
            {options.options.map((o) => (
              <option
                key={typeof o === 'string' ? o : o.value}
                value={typeof o === 'string' ? o : o.value}
              >
                {typeof o === 'string' ? o : o.label}
              </option>
            ))}
          </select>
        ) : options.type === 'textarea' ? (
          <textarea {...props} rows={4} placeholder={options.placeholder} />
        ) : date ? (
          <input
            {...props}
            type="text"
            placeholder="DD/MM/YYYY"
            maxLength={10}
            value={isISODate(values[name] || '') ? formatDate(values[name]) : values[name] || ''}
            onChange={(e) => change(name, parseDateInput(e.target.value) || e.target.value)}
          />
        ) : (
          <input
            {...props}
            type={options.type || 'text'}
            placeholder={options.placeholder}
            min={options.min}
            max={options.max}
            inputMode={['nif', 'postal', 'phone'].includes(name) ? 'numeric' : undefined}
          />
        )}
        {errors[name] ? (
          <span id={`${name}-error`} className="field-error">
            {errors[name]}
          </span>
        ) : (
          hint && <small id={`${name}-hint`}>{hint}</small>
        )}
      </div>
    );
  };
  // O seletor só abre pelo botão; o campo de ficheiro fica escondido.
  const upload = () => (
    <div className="field wide">
      {kind === 'resultado' && (
        <span id="document-label" className="field-label">
          Relatório ou certificado da inspeção <span aria-hidden="true">*</span>
        </span>
      )}
      <p id="document-hint" className="field-hint">
        {kind === 'resultado'
          ? 'Relatório ou certificado assinado'
          : 'Contrato de manutenção ou outros documentos'}{' '}
        em PDF, até 10 MB.
      </p>
      <div className="file-picker">
        <input
          ref={fileInput}
          type="file"
          id="document"
          name="document"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            s.dirty.current = true;
            setErrors((v) => ({ ...v, document: '' }));
          }}
        />
        <button
          type="button"
          className="file-picker-button"
          aria-invalid={!!errors.document}
          aria-describedby={`${kind === 'resultado' ? 'document-label ' : ''}document-hint${errors.document ? ' document-error' : ''}`}
          onClick={() => fileInput.current?.click()}
        >
          {file || keptDocument ? 'Alterar ficheiro' : 'Escolher ficheiro'}
        </button>
        <span className="file-picker-name" title={file?.name || keptDocument} aria-live="polite">
          {file?.name || keptDocument || 'Nenhum ficheiro selecionado'}
        </span>
        {(file || keptDocument) && (
          <button
            type="button"
            className="remove-file"
            aria-label="Remover ficheiro"
            title="Remover ficheiro"
            onClick={() => {
              setFile(null);
              setKeptDocument('');
              if (fileInput.current) fileInput.current.value = '';
              s.dirty.current = true;
              setErrors((previous) => ({ ...previous, document: '' }));
            }}
          >
            ×
          </button>
        )}
      </div>
      {errors.document && (
        <span id="document-error" className="field-error">
          {errors.document}
        </span>
      )}
    </div>
  );

  function submit(event: FormEvent) {
    event.preventDefault();

    if (saving) return;

    const next = validateSubmission(kind, values, file);

    if (
      kind === 'registar' &&
      values.dge?.trim() &&
      s.elevators.some((e) => e.dge === values.dge.trim())
    )
      next.dge = 'Já existe um elevador com este número DGE.';

    if (kind === 'novo-aviso' && s.urbanNotices.some((n) => n.permit === values.permit?.trim()))
      next.permit = 'Já existe um alvará registado com este número.';

    if (Object.keys(next).length) {
      setErrors(next);
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );

      return;
    }

    if (rescheduling && request) {
      s.confirm(
        'Confirmar reagendamento',
        `Alterar a inspeção de ${formatDate(request.scheduled)}, ${request.scheduled.slice(11)} para ${formatDate(values.date)}, ${values.time}?`,
        () => {
          void saveSubmission();
        },
        'Confirmar reagendamento',
      );
      return;
    }
    void saveSubmission();
  }

  async function saveSubmission() {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const id = registration?.id || crypto.randomUUID();

    if (kind === 'registar') {
      const changes = {
        address: values.address.trim(),
        postal: values.postal,
        parish: values.parish,
        owner: values.owner.trim(),
        nif: values.nif,
        email: values.email,
        service: values.service,
        dge: values.dge?.trim(),
        block: values.block?.trim(),
        phone: values.phone?.trim(),
        ownerType: values.ownerType,
        document: file?.name || keptDocument || undefined,
      };
      const next = registration
        ? resubmitRegistration(s.registrations, registration.id, changes, s.route.role)
        : [
            ...s.registrations,
            {
              ...changes,
              id,
              company: 'Elevar, Lda.',
              status: 'Por validar',
              permit:
                s.urbanNotices.find((notice) => notice.address === changes.address)?.permit || '',
            },
          ];
      s.setRegistrations(next);
      s.setUrbanNotices((items) => reconcileNotices(items, next));
      s.setDocuments((documents) => {
        const nextDocuments = { ...documents };
        if (file) nextDocuments[id] = file;
        else if (!keptDocument) delete nextDocuments[id];
        return nextDocuments;
      });
      s.notify(
        registration
          ? 'Registo corrigido e novamente submetido para validação.'
          : 'Registo submetido. Aguarda validação municipal.',
      );
    }

    if (kind === 'novo-aviso') {
      s.setUrbanNotices((items) => [
        {
          id,
          address: values.address.trim(),
          permit: values.permit.trim(),
          date: values.permitDate,
          count: values.count,
          owner: values.owner.trim(),
          status: 'Não registado',
        },
        ...items,
      ]);
      s.notify('Alvará registado. Disponível para acompanhamento pelo gestor municipal.');
    }

    if (kind === 'reclamacao') {
      s.setComplaints((items) => [
        {
          id,
          elevator: values.elevator,
          received: values.received,
          description: values.description.trim(),
          status: values.status,
          responded: values.status === 'Resolvida' ? localToday() : undefined,
        },
        ...items,
      ]);
      s.notify('Reclamação registada.');
    }

    if (kind === 'agendar' && request) {
      s.setRequests((items) => updateSchedule(items, request.id, values, s.route.role));
      s.notify(
        `${rescheduling ? 'Inspeção reagendada' : 'Inspeção agendada'}. A data está disponível nos perfis envolvidos. Não foram enviadas notificações reais.`,
      );
    }

    if (kind === 'resultado' && request) {
      s.setRequests((items) =>
        items.map((r) =>
          r.id === request.id
            ? {
                ...r,
                status: 'Concluído',
                result: values.result,
                performed: values.performed,
                report: file?.name,
                nonconformities: values.nonconformities,
              }
            : r,
        ),
      );

      if (file) s.setDocuments((d) => ({ ...d, [request.id]: file }));

      s.setElevators((items) =>
        items.map((e) =>
          e.id === request.elevator
            ? {
                ...e,
                status: certificateStatus(values.result, values.validUntil || ''),
                validUntil: values.result === 'Reprovada' ? '' : values.validUntil,
                entry: request.id,
                entryDate: request.date,
              }
            : e,
        ),
      );

      if (values.result === 'Reprovada') {
        s.setFailed((items) => [
          ...items.filter((f) => f.elevator !== request.elevator),
          {
            elevator: request.elevator,
            date: values.performed,
            deadline: values.deadline,
            resolved: false,
            requestId: request.id,
          },
        ]);
      }

      if (values.result === 'Aprovada')
        s.setFailed((items) => items.filter((f) => f.elevator !== request.elevator));

      s.notify('Resultado submetido. O relatório ficou disponível para consulta nesta sessão.');
    }

    s.dirty.current = false;
    setSaving(false);

    if (kind === 'reclamacao') {
      setValues((v) => ({ ...v, description: '', status: 'Aberta', received: localToday() }));
      setErrors({});
    }

    back();
  }

  if (
    kind === 'registar' &&
    s.route.id &&
    (!registration ||
      registration.status !== 'Rejeitado' ||
      registration.company !== 'Elevar, Lda.' ||
      s.route.role !== 'manutencao')
  ) {
    return (
      <>
        <Heading title="Registo indisponível para correção" />
        <Button onClick={() => s.go('elevadores')}>Voltar aos elevadores</Button>
      </>
    );
  }
  if ((kind === 'agendar' || kind === 'resultado') && s.route.role !== 'inspecao') {
    return (
      <>
        <Heading title="Ação indisponível" />
        <Banner>Esta ação pertence à empresa de inspeção.</Banner>
      </>
    );
  }

  if ((kind === 'agendar' || kind === 'resultado') && (!request || !elevator))
    return (
      <>
        <Heading title="Pedido não encontrado" />
        <Button onClick={() => s.go('atribuidas')}>Voltar às inspeções atribuídas</Button>
      </>
    );

  if (
    (kind === 'agendar' && (!request || !['Por agendar', 'Agendado'].includes(request.status))) ||
    (kind === 'resultado' && request?.status !== 'Agendado')
  )
    return (
      <>
        <Heading title="Ação indisponível" />
        <Banner>O estado deste pedido já foi alterado. Consulte a lista de inspeções.</Banner>
        <Button onClick={() => s.go('atribuidas')}>Voltar às inspeções atribuídas</Button>
      </>
    );

  return (
    <>
      {(kind === 'agendar' || kind === 'resultado') && (
        <div className="breadcrumb">
          <button onClick={back}>
            {kind === 'agendar' && !rescheduling ? 'Agendar inspeções' : 'Inspeções atribuídas'}
          </button>
          <span>/</span>
          <span>{elevator?.id}</span>
        </div>
      )}
      {kind === 'reclamacao' && (
        <div className="breadcrumb">
          <button onClick={back}>Reclamações</button>
          <span>/</span>
          <span>Nova reclamação</span>
        </div>
      )}
      <Heading
        title={
          registration ? 'Corrigir registo' : rescheduling ? 'Reagendar inspeção' : titles[kind]
        }
        description={
          kind === 'registar'
            ? 'Comunicar um novo elevador ao município.'
            : kind === 'novo-aviso'
              ? 'Registar alvará de utilização de elevador proveniente de um plano de obras.'
              : kind === 'reclamacao'
                ? 'Registar problemas comunicados pelos residentes.'
                : `Processo n.º ${request?.id}`
        }
        status={request?.status}
        onBack={s.route.id || kind === 'reclamacao' ? () => s.back(parent) : undefined}
      />
      {registration?.reason && (
        <Banner tone="warning">
          <strong>Motivo da rejeição anterior:</strong> {registration.reason}
        </Banner>
      )}
      {kind === 'registar' && (
        <Banner>
          Após a submissão, o município valida o registo e atribui uma referência interna ao
          elevador.
        </Banner>
      )}
      {kind === 'novo-aviso' && (
        <Banner>
          O alvará fica disponível para a divisão de elevadores acompanhar o registo junto do
          proprietário e da empresa de manutenção.
        </Banner>
      )}
      <div className='form-container'>
        <form ref={form} noValidate onSubmit={submit} aria-label={titles[kind]}>
          <p className="required-note">Os campos assinalados com * são obrigatórios.</p>
          {Object.values(errors).some(Boolean) && (
            <div className="form-error" role="alert">
              Não foi possível guardar. Corrija os campos indicados abaixo.
            </div>
          )}
          <fieldset disabled={saving} className="form-body">
            {(kind === 'agendar' || kind === 'resultado') && (
              <Panel title="Dados do pedido">
                <Summary
                  items={[
                    ['N.º de processo', request!.id],
                    ['Referência interna', elevator!.id],
                    ['N.º DGE', elevator!.dge],
                    ['Morada', elevator!.address],
                    ['Âmbito', request!.scope],
                    ['Empresa de manutenção', elevator!.company],
                    ...((kind === 'agendar'
                      ? [
                          ['Proprietário', elevator!.owner],
                          ['Válido até', formatDate(elevator!.validUntil)],
                        ]
                      : [
                          [
                            'Agendada para',
                            `${formatDate(request!.scheduled)} · ${request!.scheduled.slice(11)}`,
                          ],
                        ]) as [string, string][]),
                  ]}
                />
              </Panel>
            )}
            {kind === 'novo-aviso' && (
              <Panel title="Alvará de utilização">
                <div className="form-grid">
                  {field('permit', 'N.º do alvará', {
                    required: true,
                    placeholder: 'Ex.: 123/2026',
                  })}
                  {field('permitDate', 'Data do alvará', {
                    type: 'date',
                    required: true,
                    max: localToday(),
                  })}
                </div>
              </Panel>
            )}
            {(kind === 'registar' || kind === 'novo-aviso') && (
              <>
                <Panel title={kind === 'registar' ? 'Localização' : 'Edifício'}>
                  <div className="form-grid">
                    {field('address', 'Morada', {
                      required: true,
                      placeholder: 'Rua e número',
                      wide: true,
                    })}
                    {field('postal', 'Código postal', { required: true, placeholder: '3800-000' })}
                    {field('parish', 'Freguesia', {
                      required: true,
                      options: [
                        'Glória e Vera Cruz',
                        'Esgueira',
                        'Aradas',
                        'São Bernardo',
                        'Cacia',
                        'Eixo e Eirol',
                        'Oliveirinha',
                        'Requeixo, Nossa Senhora de Fátima e Nariz',
                        'Santa Joana',
                        'São Jacinto',
                      ],
                    })}
                    {kind === 'registar'
                      ? field('block', 'Edifício / bloco', { placeholder: 'Opcional' })
                      : field('count', 'Número de elevadores', {
                          type: 'number',
                          min: '1',
                          required: true,
                        })}
                  </div>
                </Panel>
                <Panel title={kind === 'registar' ? 'Proprietário' : 'Proprietário e manutenção'}>
                  <div className="form-grid">
                    {kind === 'registar' &&
                      field('ownerType', 'Tipo de proprietário', {
                        options: ['Condomínio', 'Pessoa singular', 'Pessoa coletiva'],
                        required: true,
                      })}
                    {field(
                      'owner',
                      kind === 'registar'
                        ? 'Nome do condomínio ou proprietário'
                        : 'Proprietário / promotor',
                      { required: true },
                    )}
                    {field('nif', 'NIF', { required: true, placeholder: '9 algarismos' })}
                    {kind === 'registar' ? (
                      <>
                        {field('email', 'Correio eletrónico', {
                          type: 'email',
                          required: true,
                          placeholder: 'nome@exemplo.pt',
                        })}
                        {field('phone', 'Telefone', { type: 'tel', placeholder: 'Opcional' })}
                      </>
                    ) : (
                      field('company', 'Empresa de manutenção', { placeholder: 'Se conhecida' })
                    )}
                  </div>
                </Panel>
              </>
            )}
            {kind === 'registar' && (
              <>
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
              </>
            )}
            {kind === 'reclamacao' && (
              <Panel title="Dados da reclamação">
                <div className="form-grid">
                  {field('elevator', 'Elevador', {
                    required: true,
                    options: s.elevators
                      .filter((e) => e.company === 'Elevar, Lda.')
                      .map((e) => ({ value: e.id, label: `${e.id} — ${e.address}` })),
                  })}
                  {field('received', 'Data de receção', {
                    type: 'date',
                    required: true,
                    max: localToday(),
                  })}
                  {field('description', 'Descrição do problema', {
                    type: 'textarea',
                    required: true,
                    wide: true,
                    placeholder: 'Descreva o problema comunicado.',
                  })}
                  {field('status', 'Estado', { options: ['Aberta', 'Resolvida'], required: true })}
                </div>
              </Panel>
            )}
            {kind === 'agendar' && (
              <>
                <Panel title="Data e hora">
                  <div className="form-grid">
                    {field('date', 'Data da inspeção', {
                      type: 'date',
                      min: localToday(),
                      required: true,
                    })}
                    {field('time', 'Hora', { type: 'time', required: true })}
                  </div>
                </Panel>
                <Panel title="Destinatários do agendamento">
                  <ul className="check-list">
                    <li>Câmara Municipal de Aveiro</li>
                    <li>{elevator!.company} — manutenção</li>
                    <li>{elevator!.owner} — proprietário</li>
                  </ul>
                  <p className="muted inset">
                    Neste protótipo, a informação é atualizada apenas no ecrã.
                  </p>
                </Panel>
              </>
            )}
            {kind === 'resultado' && (
              <>
                <Panel title="Resultado">
                  <div className="form-grid">
                    {field('result', 'Resultado da inspeção', {
                      required: true,
                      options: ['Aprovada', 'Reprovada'],
                    })}
                    {field('performed', 'Data de realização', {
                      required: true,
                      type: 'date',
                      max: localToday(),
                    })}
                    {values.result === 'Aprovada'
                      ? field('validUntil', 'Certificado válido até', {
                          required: true,
                          type: 'date',
                          min: values.performed || localToday(),
                        })
                      : field('deadline', 'Prazo de correção', {
                          required: true,
                          type: 'date',
                          min: values.performed || localToday(),
                        })}
                    {field('nonconformities', 'Não conformidades', {
                      type: 'textarea',
                      wide: true,
                      required: values.result === 'Reprovada',
                      hint: 'Obrigatório em caso de reprovação. Uma não conformidade por linha.',
                    })}
                  </div>
                </Panel>
                <Panel title="Relatório">
                  <div className="form-grid">{upload()}</div>
                </Panel>
              </>
            )}
            <div className="form-actions">
              <Button onClick={back}>Cancelar</Button>
              <Button type="submit" className="primary" disabled={saving}>
                {saving
                  ? 'A guardar…'
                  : kind === 'agendar'
                    ? rescheduling
                      ? 'Confirmar reagendamento'
                      : 'Confirmar agendamento'
                    : kind === 'resultado'
                      ? 'Submeter resultado'
                      : kind === 'novo-aviso'
                        ? 'Guardar alvará'
                        : kind === 'registar'
                          ? registration
                            ? 'Voltar a submeter'
                            : 'Submeter registo'
                          : 'Registar reclamação'}
              </Button>
            </div>
          </fieldset>
        </form>
      </div>
    </>
  );
}
