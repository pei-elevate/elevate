import { useEffect, useRef, useState } from 'react';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Page } from './pages';
import { PrototypeProvider, usePrototype } from './state';
import { navigation } from '@/app/navigation';
import { roles } from '@/shared/auth/roles';
import type { Role } from '@/shared/auth/roles';

function Interface() {
  const s = usePrototype();
  const [menu, setMenu] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const { role, page } = s.route;
  const rescheduling =
    page === 'agendar' && s.requests.find((r) => r.id === s.route.id)?.status === 'Agendado';
  const names: Record<Role, string> = {
    proprietario: 'Condomínio Edifício Ria',
    manutencao: 'Elevar, Lda.',
    urbanismo: 'Ana Rodrigues',
    gestor: 'Augusta Jesus',
    inspecao: 'Inspeave, Lda.',
  };
  useEffect(() => {
    // Um modal pode substituir outro já aberto (ex.: confirmação seguida do resultado).
    if (s.modal) {
      if (!dialog.current?.open) dialog.current?.showModal();
    } else dialog.current?.close();
  }, [s.modal]);
  useEffect(() => {
    setMenu(false);
  }, [s.route]);
  const badges: Record<string, number> = {
    validacoes: s.registrations.filter((r) => r.status === 'Por validar').length,
    'nao-registados': s.urbanNotices.filter(
      (n) => n.status === 'Não registado' || n.status === 'Parcialmente registado',
    ).length,
    reprovadas: s.failed.filter((f) => !f.resolved).length,
    atribuidas: s.requests.filter((r) => r.status !== 'Concluído').length,
    agendar: s.requests.filter((r) => r.status === 'Por agendar').length,
  };

  function help() {
    s.setModal({
      title: 'Ajuda ao protótipo',
      body: (
        <>
          <p>
            Use o menu lateral para navegar. Pode pesquisar tabelas, registar elevadores e
            reclamações, analisar registos, agendar inspeções e submeter resultados.
          </p>
          <p>
            Para testar outro interveniente, escolha o perfil no rodapé do menu. As alterações são
            partilhadas entre perfis durante esta sessão.
          </p>
          <p>
            Os campos com * são obrigatórios. Os documentos aceites são PDF até 10 MB. Ao cancelar
            um formulário com alterações, pode confirmar se pretende descartá-las.
          </p>
          <Banner>
            Dados fictícios. Não há autenticação, envio de mensagens ou gravação num servidor.
            Recarregar a página repõe os dados iniciais.
          </Banner>
        </>
      ),
    });
  }

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#conteudo"
        onClick={(e) => {
          e.preventDefault();
          s.main.current?.focus();
        }}
      >
        Saltar para o conteúdo
      </a>
      <header className="mobile-topbar">
        <img src="/assets/logo.png" alt="Elevate" />
        <button
          className="menu-toggle"
          onClick={() => setMenu(!menu)}
          aria-expanded={menu}
          aria-controls="navigation"
          aria-label={menu ? 'Fechar menu' : 'Abrir menu'}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            {menu ? (
              <path
                d="M5 5l12 12M17 5L5 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M3 6h16M3 11h16M3 16h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </header>
      {menu && <button className="scrim" aria-label="Fechar menu" onClick={() => setMenu(false)} />}
      <aside className={`sidebar ${menu ? 'open' : ''}`} id="navigation">
        <button
          className="brand"
          onClick={() => s.go(navigation[role][0][0])}
          aria-label="Elevate — início"
        >
          <img src="/assets/logo.png" alt="Elevate" width={132} height={43} />
        </button>
        <nav aria-label="Navegação principal">
          {navigation[role].map(([slug, label, icon]) => {
            const active =
              (page === slug && !rescheduling) ||
              ((page === 'detalhes' || page === 'historico') &&
                (slug === 'elevadores' || slug === 'cadastro')) ||
              // Reagendar e submeter resultado partem das inspeções atribuídas.
              ((page === 'resultado' || (page === 'agendar' && rescheduling)) &&
                slug === 'atribuidas') ||
              (page === 'reclamacao' && slug === 'reclamacoes');
            return (
              <button
                key={slug}
                className={`nav-item ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => s.go(slug)}
              >
                <Icon name={icon} />
                <span>{label}</span>
                {!!badges[slug] && <span className="nav-count">{badges[slug]}</span>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-switch">
            <label htmlFor="profile">Perfil de demonstração</label>
            <select
              id="profile"
              value={role}
              onChange={(e) => {
                const next = e.target.value as Role;
                s.go(navigation[next][0][0], '', next);
              }}
            >
              {Object.entries(roles).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="identity">
            <strong>{names[role]}</strong>
          </div>
          <button className="nav-item" onClick={help}>
            <span className="help-icon" aria-hidden="true">
              ?
            </span>
            <span>Ajuda</span>
          </button>
          <button
            className="nav-item"
            onClick={() =>
              s.confirm(
                'Sair da demonstração',
                'Pretende voltar à escolha de perfil? Os dados de exemplo mantêm-se até recarregar a página.',
                () => s.go('perfis'),
                'Sair',
              )
            }
          >
            <Icon name="logout" />
            <span>Sair</span>
          </button>
        </div>
      </aside>
      <main ref={s.main} id="conteudo" tabIndex={-1} key={`${role}/${page}/${s.route.id}`}>
        {s.message && (
          <div className="feedback" role="status">
            <span aria-hidden="true">✓</span>
            <span>{s.message}</span>
            <button aria-label="Fechar mensagem" onClick={() => s.setMessage('')}>
              ×
            </button>
          </div>
        )}
        {page === 'perfis' ? (
          <>
            <h1>Escolher perfil</h1>
            <p>Selecione o interveniente que pretende explorar.</p>
            <div className="profile-grid">
              {Object.entries(roles).map(([value, label]) => (
                <Button
                  key={value}
                  onClick={() => s.go(navigation[value as Role][0][0], '', value as Role)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <Page />
        )}
        <footer className="page-footer">
          <span>© 2026 Câmara Municipal de Aveiro</span>
          <span>Elevate · Gestão de elevadores</span>
        </footer>
      </main>
      <dialog
        ref={dialog}
        className={[s.modal?.bare && 'bare', s.modal?.tone].filter(Boolean).join(' ') || undefined}
        aria-labelledby="dialog-title"
        onCancel={() => s.setModal(null)}
        onClose={() => s.setModal(null)}
      >
        <div className="dialog-header">
          <h2 id="dialog-title">{s.modal?.title}</h2>
          <button
            className="close-dialog"
            aria-label="Fechar janela"
            onClick={() => s.setModal(null)}
          >
            ×
          </button>
        </div>
        <div className="dialog-body">{s.modal?.body}</div>
        {!s.modal?.bare && (
          <div className="form-actions">
            <Button onClick={() => s.setModal(null)}>
              {s.modal?.confirm ? 'Cancelar' : 'Fechar'}
            </Button>
            {s.modal?.confirm && (
              <Button
                className="primary"
                onClick={() => {
                  const action = s.modal?.confirm;
                  s.setModal(null);
                  action?.();
                }}
              >
                {s.modal.label || 'Confirmar'}
              </Button>
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}

export default function App() {
  return (
    <PrototypeProvider>
      <Interface />
    </PrototypeProvider>
  );
}
