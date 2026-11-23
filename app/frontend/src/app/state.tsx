import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useLocation, useNavigate } from 'react-router';
import type { ReactNode } from 'react';
import { navigation } from '@/app/navigation';
import { complaints as seedComplaints } from '@/features/complaints/mocks';
import {
  canResolveComplaint as canResolveComplaintRule,
  resolveComplaint as resolveComplaintRule,
} from '@/features/complaints/rules';
import {
  elevators as seedElevators,
  registrations as seedRegistrations,
} from '@/features/elevators/mocks';
import {
  listElevators,
  listPendingRegistrations,
  listSubmittedRegistrations,
  load,
  toElevator,
} from '@/features/elevators/api';
import type { ApiRegistration } from '@/features/elevators/api';
import type { Elevator, ElevatorFilters } from '@/features/elevators/types';
import { DocumentLink, SummaryReport } from '@/features/inspections/InspectionReport';
import { loadAssignedRequests, loadRequests } from '@/features/inspections/api';
import type { Request as InspectionRequest } from '@/features/inspections/types';
import {
  failedInspections as seedFailedInspections,
  requests as seedRequests,
} from '@/features/inspections/mocks';
import { elevatorNotices as seedElevatorNotices } from '@/features/notices/mocks';
import type { ElevatorNotice } from '@/features/notices/types';
import { listPermits } from '@/features/permits/api';
import type { ApiPermit } from '@/features/permits/api';
import { urbanNotices as seedUrbanNotices } from '@/features/permits/mocks';
import { reconcileNotices } from '@/features/permits/rules';
import { roles } from '@/shared/auth/roles';
import type { Role } from '@/shared/auth/roles';
import { Banner } from '@/shared/ui/Banner';

export type Origin = { page: string; label: string };

export type DashboardView = { view: string; month: string };

const unsaved = 'Existem alterações por guardar. Pretende sair e descartá-las?';

/**
 * Página e identificador a partir do caminho (`/página/id`). O perfil não está no endereço:
 * viaja no estado de cada entrada do histórico, por isso voltar atrás e recarregar repõem o
 * perfil com que se lá esteve. Sem perfil guardado, usa-se `fallback`.
 */
export function readRoute(pathname: string, state: unknown, fallback: Role) {
  const saved = (state as { role?: string } | null)?.role;
  const role: Role = saved && Object.hasOwn(roles, saved) ? (saved as Role) : fallback;
  // O id pode conter «/» (ex.: 2026/0377), codificado como %2F.
  const [, p, ...rest] = pathname.split('/');
  let decoded = '';

  try {
    decoded = decodeURIComponent(rest.join('/'));
  } catch {
    decoded = '';
  }

  return { role, page: p || navigation[role][0][0], id: decoded };
}

type SavedElevators = { role: Role; items: Elevator[] };

type SavedRequests = { role: Role; items: InspectionRequest[] };

/** A lista da API, só se pertencer ao perfil atual; senão, null (ainda a carregar). */
export function elevatorsFor(saved: SavedElevators | null, role: Role) {
  return saved?.role === role ? saved.items : null;
}

function useModel(initialRole: Role) {
  const location = useLocation();
  const navigate = useNavigate();
  // Até haver autenticação, o perfil escolhido fica no histórico do browser (não no endereço).
  const { pathname, state } = location;
  const route = useMemo(
    () => readRoute(pathname, state, initialRole),
    [pathname, state, initialRole],
  );
  const [elevators, setElevators] = useState(seedElevators);
  const [requests, setRequests] = useState(seedRequests);
  const [complaints, setComplaints] = useState(seedComplaints);
  const [elevatorNotices, setElevatorNotices] = useState(seedElevatorNotices);
  const [registrations, setRegistrations] = useState(seedRegistrations);
  const [urbanNotices, setUrbanNotices] = useState(() =>
    reconcileNotices(seedUrbanNotices, seedRegistrations),
  );
  // Registos por validar, vindos da API: o ecrã de validação, o menu e o painel do gestor
  // mostram os mesmos. null enquanto carregam.
  const [pendingRegistrations, setPendingRegistrations] = useState<ApiRegistration[] | null>(null);
  const [pendingError, setPendingError] = useState(false);
  const [pendingReloads, setPendingReloads] = useState(0);
  // Registos que a empresa de manutenção submeteu e ainda não deram elevador (por validar e
  // rejeitados), vindos da API. null enquanto carregam.
  const [submittedRegistrations, setSubmittedRegistrations] = useState<ApiRegistration[] | null>(
    null,
  );
  const [submittedError, setSubmittedError] = useState(false);
  const [submittedReloads, setSubmittedReloads] = useState(0);
  // Alvarás vindos da API, com o estado calculado no backend: o Urbanismo e o gestor veem
  // os mesmos. null enquanto carregam.
  const [permits, setPermits] = useState<ApiPermit[] | null>(null);
  const [permitsError, setPermitsError] = useState(false);
  const [permitsReloads, setPermitsReloads] = useState(0);
  // Data do alerta simulado («Emitir alerta») por alvará, até haver a story do alerta.
  const [alerted, setAlerted] = useState<Record<number, string>>({});
  // Pedidos atribuídos à empresa de inspeção, vindos da API: a lista e o contador do menu
  // mostram os mesmos. null enquanto carregam.
  const [assignedRequests, setAssignedRequests] = useState<InspectionRequest[] | null>(null);
  const [assignedError, setAssignedError] = useState(false);
  const [assignedReloads, setAssignedReloads] = useState(0);
  // Pedidos que a empresa de manutenção (os dos seus elevadores) e o gestor (todos)
  // acompanham, vindos da API. Guardados com o perfil a que pertencem, para não mostrar os
  // de outro ao trocar de perfil. null enquanto carregam.
  const [savedRequests, setSavedRequests] = useState<SavedRequests | null>(null);
  const trackedRequests = savedRequests?.role === route.role ? savedRequests.items : null;
  const [trackedError, setTrackedError] = useState(false);
  const [trackedReloads, setTrackedReloads] = useState(0);
  // Elevadores do perfil, vindos da API: a lista e o painel mostram os mesmos. null enquanto
  // carregam. s.elevators (os mocks) continua para os ecrãs que ainda não usam a API.
  // Guardada com o perfil a que pertence, para não mostrar a de outro ao trocar de perfil.
  const [savedElevators, setSavedElevators] = useState<SavedElevators | null>(null);
  const apiElevators = elevatorsFor(savedElevators, route.role);
  const [apiElevatorsError, setApiElevatorsError] = useState(false);
  const [apiElevatorsReloads, setApiElevatorsReloads] = useState(0);
  // Avisos do botão «Enviar aviso de inspeção», ainda simulados: ficam até recarregar.
  const [simulatedNotices, setSimulatedNotices] = useState<ElevatorNotice[]>([]);
  const [failed, setFailed] = useState(seedFailedInspections);
  const [documents, setDocuments] = useState<Record<string, File>>({});
  const [message, setMessage] = useState('');
  const [elevatorFilters, setElevatorFilters] = useState<Partial<Record<Role, ElevatorFilters>>>(
    {},
  );
  // Página de onde se partiu, para o breadcrumb poder voltar a ela (ex.: painel → detalhes).
  const [origin, setOrigin] = useState<Origin | null>(null);
  // Vista do painel (tabela ou calendário, mês, pesquisa), mantida ao voltar de outra página.
  const [dashboardView, setDashboardView] = useState<Partial<Record<Role, DashboardView>>>({});
  const [modal, setModal] = useState<{
    title: string;
    body: ReactNode;
    confirm?: () => void;
    label?: string;
    // Sem botão «Fechar» no rodapé: fecha-se apenas pela cruz.
    bare?: boolean;
    tone?: 'danger';
  } | null>(null);
  const dirty = useRef(false);
  const previous = useRef(location.key);
  const from = useRef('');
  const main = useRef<HTMLElement>(null);
  // Voltar e avançar no browser com alterações por guardar pedem confirmação
  // (as navegações da própria app já perguntam em go()).
  const blocker = useBlocker(({ historyAction }) => historyAction === 'POP' && dirty.current);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;

    if (window.confirm(unsaved)) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    // Primeira página: nada a fazer.
    if (previous.current === location.key) return;

    dirty.current = false;
    from.current = previous.current;
    previous.current = location.key;
    requestAnimationFrame(() => {
      main.current?.querySelector<HTMLElement>('h1')?.focus();
      window.scrollTo(0, 0);
    });
  }, [location.key]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);

    return () => window.removeEventListener('beforeunload', unload);
  }, []);
  useEffect(() => {
    document.title = `${roles[route.role]} · Elevate`;
  }, [route.role]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a página e pendingReloads são gatilhos, para voltar a pedir os registos ao mudar de página ou ao tentar de novo
  useEffect(() => {
    // Só o gestor municipal pode ver os registos por validar.
    if (route.role !== 'gestor') return;

    let cancelled = false;
    setPendingError(false);
    listPendingRegistrations(route.role)
      .then((items) => {
        if (!cancelled) setPendingRegistrations(items);
      })
      .catch(() => {
        if (!cancelled) setPendingError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [route.role, route.page, pendingReloads]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a página e submittedReloads são gatilhos, para voltar a pedir os registos ao mudar de página ou ao tentar de novo
  useEffect(() => {
    // Só a empresa de manutenção submete registos.
    if (route.role !== 'manutencao') return;

    setSubmittedError(false);

    return load(
      () => listSubmittedRegistrations(route.role),
      setSubmittedRegistrations,
      () => setSubmittedError(true),
    );
  }, [route.role, route.page, submittedReloads]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a página e assignedReloads são gatilhos, para voltar a pedir os pedidos ao mudar de página ou ao tentar de novo
  useEffect(() => {
    // Só a empresa de inspeção tem pedidos atribuídos.
    if (route.role !== 'inspecao') return;

    setAssignedError(false);

    return loadAssignedRequests(route.role, setAssignedRequests, () => setAssignedError(true));
  }, [route.role, route.page, assignedReloads]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a página e trackedReloads são gatilhos, para voltar a pedir os pedidos ao mudar de página ou ao tentar de novo
  useEffect(() => {
    // Só a empresa de manutenção e o gestor acompanham o estado dos pedidos, e só no ecrã
    // dos pedidos: a lista do gestor tem todos os do município.
    const role = route.role;
    if (role !== 'manutencao' && role !== 'gestor') return;
    if (route.page !== 'inspecoes' && route.page !== 'pedidos') return;

    setTrackedError(false);

    return loadRequests(
      role,
      (items) => setSavedRequests({ role, items }),
      () => setTrackedError(true),
    );
  }, [route.role, route.page, trackedReloads]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a página e apiElevatorsReloads são gatilhos, para voltar a pedir os elevadores ao mudar de página ou ao tentar de novo
  useEffect(() => {
    // Só o proprietário, a empresa de manutenção e o gestor consultam elevadores.
    const role = route.role;
    if (role !== 'proprietario' && role !== 'manutencao' && role !== 'gestor') return;

    setApiElevatorsError(false);

    return load(
      () => listElevators(role),
      (items) => setSavedElevators({ role, items: items.map(toElevator) }),
      () => setApiElevatorsError(true),
    );
  }, [route.role, route.page, apiElevatorsReloads]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a página e permitsReloads são gatilhos, para voltar a pedir os alvarás ao mudar de página ou ao tentar de novo
  useEffect(() => {
    // Só o Urbanismo e o gestor municipal podem ver os alvarás.
    if (route.role !== 'urbanismo' && route.role !== 'gestor') return;

    let cancelled = false;
    setPermitsError(false);
    listPermits(route.role)
      .then((items) => {
        if (!cancelled) setPermits(items);
      })
      .catch(() => {
        if (!cancelled) setPermitsError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [route.role, route.page, permitsReloads]);

  function go(page: string, id = '', role = route.role, from: Origin | null = null) {
    if (dirty.current && !window.confirm(unsaved)) return;

    dirty.current = false;
    setOrigin(from);

    // Mesma página e perfil: nada muda (como no protótipo com o hash).
    if (page === route.page && id === route.id && role === route.role) return;

    navigate(`/${page}${id ? `/${encodeURIComponent(id)}` : ''}`, { state: { role } });
  }

  function back(fallback: string) {
    if (from.current) navigate(-1);
    else go(fallback);
  }

  function notify(text: string) {
    setMessage(text);
  }

  function confirm(
    title: string,
    body: ReactNode,
    action: () => void,
    label = 'Confirmar',
    tone?: 'danger',
  ) {
    setModal({ title, body, confirm: action, label, tone });
  }

  function canResolveComplaint(id: string) {
    const complaint = complaints.find((item) => item.id === id);
    return !!complaint && canResolveComplaintRule(complaint, elevators, route.role);
  }

  function resolveComplaint(id: string) {
    if (!canResolveComplaint(id)) return;

    confirm(
      'Resolver reclamação',
      'Confirma que o problema foi resolvido?',
      () => {
        setComplaints((items) => resolveComplaintRule(items, elevators, id, route.role));
        notify('Reclamação assinalada como resolvida.');
      },
      'Resolver',
    );
  }

  function report(id: string, result = 'Aprovada', file?: File, bare = false) {
    const uploaded = file || documents[id];
    setModal({
      title: `Relatório — ${id}`,
      bare,
      body: (
        <>
          {uploaded ? (
            <DocumentLink file={uploaded} />
          ) : (
            <>
              <Banner>Documento de demonstração, sem validade oficial.</Banner>
              <SummaryReport id={id} result={result} />
              <p>Inspeave, Lda. · Câmara Municipal de Aveiro</p>
              <p>
                Este registo permite consultar o resultado no protótipo. Não contém um certificado
                oficial.
              </p>
              <DocumentLink
                file={
                  new File(
                    [
                      `Relatório de demonstração\nReferência: ${id}\nResultado: ${result}\nInspeave, Lda. · Câmara Municipal de Aveiro\nSem validade oficial.\n`,
                    ],
                    `relatorio-${id.replace(/\W+/g, '-')}.txt`,
                    { type: 'text/plain' },
                  )
                }
              />
            </>
          )}
        </>
      ),
    });
  }

  return {
    route,
    go,
    origin,
    back,
    dashboardView,
    setDashboardView,
    elevatorFilters,
    setElevatorFilters,
    canResolveComplaint,
    resolveComplaint,
    elevators,
    setElevators,
    requests,
    setRequests,
    complaints,
    setComplaints,
    elevatorNotices,
    setElevatorNotices,
    registrations,
    setRegistrations,
    pendingRegistrations,
    setPendingRegistrations,
    pendingError,
    reloadPendingRegistrations: () => setPendingReloads((n) => n + 1),
    submittedRegistrations,
    submittedError,
    reloadSubmittedRegistrations: () => setSubmittedReloads((n) => n + 1),
    permits,
    permitsError,
    reloadPermits: () => setPermitsReloads((n) => n + 1),
    alerted,
    setAlerted,
    assignedRequests,
    assignedError,
    reloadAssignedRequests: () => setAssignedReloads((n) => n + 1),
    trackedRequests,
    trackedError,
    reloadTrackedRequests: () => setTrackedReloads((n) => n + 1),
    apiElevators,
    apiElevatorsError,
    reloadApiElevators: () => setApiElevatorsReloads((n) => n + 1),
    simulatedNotices,
    setSimulatedNotices,
    urbanNotices,
    setUrbanNotices,
    failed,
    setFailed,
    documents,
    setDocuments,
    message,
    setMessage,
    modal,
    setModal,
    dirty,
    main,
    notify,
    confirm,
    report,
  };
}

const Context = createContext<ReturnType<typeof useModel> | null>(null);

export function PrototypeProvider({
  children,
  initialRole = 'proprietario',
}: {
  children: ReactNode;
  initialRole?: Role;
}) {
  const model = useModel(initialRole);

  return <Context.Provider value={model}>{children}</Context.Provider>;
}

export function usePrototype() {
  const value = useContext(Context);

  if (!value) throw Error('Provider em falta');

  return value;
}
