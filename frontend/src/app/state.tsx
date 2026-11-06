import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useLocation, useNavigate } from 'react-router';
import type { ReactNode } from 'react';
import { navigation } from '@/app/navigation';
import { complaints as seedComplaints } from '@/features/complaints/mocks';
import { canResolveComplaint as canResolveComplaintRule, resolveComplaint as resolveComplaintRule } from '@/features/complaints/rules';
import { elevators as seedElevators, registrations as seedRegistrations } from '@/features/elevators/mocks';
import type { ElevatorFilters } from '@/features/elevators/types';
import { DocumentLink, SummaryReport } from '@/features/inspections/InspectionReport';
import { failedInspections as seedFailedInspections, requests as seedRequests } from '@/features/inspections/mocks';
import { elevatorNotices as seedElevatorNotices } from '@/features/notices/mocks';
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

  function go(page: string, id = '', role = route.role, from: Origin | null = null) {
    if (dirty.current && !window.confirm(unsaved)) return;

    dirty.current = false;
    setOrigin(from);

    // Mesma página e perfil: nada muda (como no protótipo com o hash).
    if (page === route.page && id === route.id && role === route.role) return;

    navigate(`/${page}${id ? '/' + encodeURIComponent(id) : ''}`, { state: { role } });
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
