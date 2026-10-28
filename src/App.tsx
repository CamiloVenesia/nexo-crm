
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Activity as ActivityIcon,
  ArrowRight,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Command,
  Download,
  GitBranch,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';

import { Brand, Avatar } from './components/Shared';
import { EditorModal, Editing } from './components/EditorModal';

import { CRMProvider, useCRM } from './lib/store';
import { downloadJSON, overdue } from './lib/utils';
import { searchCRM } from './lib/search';
import { Page } from './types';

import { Dashboard } from './views/Dashboard';
import { Deals } from './views/Deals';
import { Contacts } from './views/Contacts';
import { Companies } from './views/Companies';
import { Tasks } from './views/Tasks';
import { Activity } from './views/Activity';
import { Insights } from './views/Insights';
import { Settings } from './views/Settings';

import './styles.css';

const nav: {
  id: Page;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'deals',
    label: 'Oportunidades',
    icon: GitBranch,
  },
  {
    id: 'contacts',
    label: 'Contactos',
    icon: UsersRound,
  },
  {
    id: 'companies',
    label: 'Empresas',
    icon: Building2,
  },
  {
    id: 'tasks',
    label: 'Tareas',
    icon: CalendarClock,
  },
  {
    id: 'activity',
    label: 'Actividad',
    icon: ActivityIcon,
  },
  {
    id: 'insights',
    label: 'Reportes',
    icon: Sparkles,
  },
];

function WorkSpace() {
  const { data, notification } = useCRM();

  const [page, setPage] = useState<Page>(() => {
    const value = window.location.hash.replace('#/', '') as Page;

    return [...nav.map((item) => item.id), 'settings'].includes(value)
      ? value
      : 'dashboard';
  });

  const [editing, setEditing] = useState<Editing | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const navigate = (destination: Page) => {
    setPage(destination);

    window.location.hash = `/${destination}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setMenuOpen(false);
    setSearchOpen(false);
    setAlertsOpen(false);
    setProfileOpen(false);
  };

  useEffect(() => {
    const onHash = () => {
      const destination = window.location.hash.replace(
        '#/',
        '',
      ) as Page;

      if (
        [...nav.map((item) => item.id), 'settings'].includes(
          destination,
        )
      ) {
        setPage(destination);
      }
    };

    window.addEventListener('hashchange', onHash);

    return () => {
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();

        searchRef.current?.focus();
        setSearchOpen(true);
      }

      if (event.key === 'Escape') {
        setSearchOpen(false);
        setAlertsOpen(false);
        setProfileOpen(false);
        setHelpOpen(false);
        setMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const urgent = data.tasks
    .filter((task) => !task.done && overdue(task.dueDate))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Una sola búsqueda para todo NEXO: tildes, empresas,
  // contactos, responsables, notas y tareas vinculadas.
  const matches = useMemo(() => {
    return searchCRM(data, search, 8).flatMap((result) => {
      const open = (): void => {
        switch (result.kind) {
          case 'deal': {
            const value = data.deals.find((deal) => deal.id === result.id);
            if (!value) return;
            navigate('deals');
            setEditing({ kind: 'deal', value });
            break;
          }
          case 'contact': {
            const value = data.contacts.find((item) => item.id === result.id);
            if (!value) return;
            navigate('contacts');
            setEditing({ kind: 'contact', value });
            break;
          }
          case 'company': {
            const value = data.companies.find((item) => item.id === result.id);
            if (!value) return;
            navigate('companies');
            setEditing({ kind: 'company', value });
            break;
          }
          case 'task': {
            const value = data.tasks.find((item) => item.id === result.id);
            if (!value) return;
            navigate('tasks');
            setEditing({ kind: 'task', value });
            break;
          }
        }
        setSearch('');
        setSearchOpen(false);
      };

      return [{
        key: `${result.kind}-${result.id}`,
        label: result.title,
        sub: result.detail,
        action: open,
      }];
    });
  }, [search, data]);

  const edit = (item: Editing) => {
    setEditing(item);
  };

  const menuContent = (
    <>
      {nav.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`nav-link ${page === id ? 'active' : ''}`}
          aria-current={page === id ? 'page' : undefined}
          onClick={() => navigate(id)}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </>
  );

  return (
    <div className="app-shell">
      <div className="ambient-glow ambient-left" />
      <div className="ambient-glow ambient-right" />

      <div className="app-frame">
        <header className="topbar">
          <button
            className="brand-button"
            onClick={() => navigate('dashboard')}
            aria-label="Ir al dashboard"
          >
            <Brand />
          </button>

          <nav className="topnav" aria-label="Navegación principal">
            {menuContent}
          </nav>

          <div className="topbar-tools">
            <div className="global-search">
              <button
                type="button"
                className="search-trigger"
                aria-label="Buscar"
                onClick={() => {
                  setSearchOpen(true);
                  searchRef.current?.focus();
                }}
              >
                <Search size={17} />
              </button>

              <input
                ref={searchRef}
                placeholder="Buscar en NEXO..."
                aria-label="Búsqueda global"
                aria-expanded={searchOpen && search.trim().length >= 2}
                aria-controls="nexo-global-search-results"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && matches[0]) {
                    event.preventDefault();
                    matches[0].action();
                  }
                }}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
              />

              <kbd>Ctrl K</kbd>

              {searchOpen && search.trim().length >= 2 && (
                <div
                  id="nexo-global-search-results"
                  className="search-dropdown"
                  role="region"
                  aria-label="Resultados de búsqueda"
                >
                  <div className="dropdown-label">
                    RESULTADOS DE BÚSQUEDA
                  </div>

                  {matches.length ? (
                    matches.map((match) => (
                      <button
                        key={match.key}
                        type="button"
                        onMouseDown={(event) =>
                          event.preventDefault()
                        }
                        onClick={() => {
                          match.action();
                          setSearch('');
                        }}
                      >
                        <span>
                          <strong>{match.label}</strong>
                          <small>{match.sub}</small>
                        </span>

                        <ArrowRight size={15} />
                      </button>
                    ))
                  ) : (
                    <p>
                      Sin coincidencias para “{search}”
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="popover-anchor">
              <button
                className="tool-icon"
                aria-label="Notificaciones"
                aria-expanded={alertsOpen}
                onClick={() => {
                  setAlertsOpen((open) => !open);
                  setProfileOpen(false);
                }}
              >
                <Bell size={18} />

                {urgent.length > 0 && (
                  <span className="notif-count">
                    {urgent.length}
                  </span>
                )}
              </button>

              {alertsOpen && (
                <div className="floating-menu notifications">
                  <div className="dropdown-label">
                    SEGUIMIENTOS PENDIENTES
                  </div>

                  {urgent.length ? (
                    urgent.slice(0, 4).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => navigate('tasks')}
                      >
                        <CalendarClock size={17} />

                        <span>
                          <strong>{task.title}</strong>
                          <small>Vencida · Revisar tarea</small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="muted">
                      No tenés tareas vencidas.
                    </p>
                  )}

                  <button
                    className="menu-bottom"
                    onClick={() => navigate('tasks')}
                  >
                    Ir a tareas
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="popover-anchor">
              <button
                className="profile-button"
                aria-label="Menú de usuario"
                aria-expanded={profileOpen}
                onClick={() => {
                  setProfileOpen((open) => !open);
                  setAlertsOpen(false);
                }}
              >
                <Avatar
                  name={data.settings.userName}
                  size={32}
                />

                <ChevronDown size={13} />
              </button>

              {profileOpen && (
                <div className="floating-menu profile-menu">
                  <strong>
                    {data.settings.userName}
                  </strong>

                  <small>
                    {data.settings.organization} · Demo local
                  </small>

                  <div className="menu-divider" />

                  <button
                    onClick={() => navigate('settings')}
                  >
                    <SettingsIcon size={16} />
                    Configuración
                  </button>

                  <button
                    onClick={() => {
                      downloadJSON(data);
                      setProfileOpen(false);
                    }}
                  >
                    <Download size={16} />
                    Descargar respaldo
                  </button>
                </div>
              )}
            </div>

            <button
              className="mobile-menu-btn tool-icon"
              aria-label="Abrir menú"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Menu size={21} />
            </button>
          </div>
        </header>

        {menuOpen && (
          <nav className="mobile-nav">
            {menuContent}

            <button
              className="nav-link"
              onClick={() => navigate('settings')}
            >
              <SettingsIcon size={16} />
              Configuración
            </button>
          </nav>
        )}

        <div className="workspace-body">
          <aside
            className="icon-rail"
            aria-label="Accesos rápidos"
          >
            <div className="rail-top">
              <button
                title="Dashboard"
                className={`rail-item ${
                  page === 'dashboard' ? 'current' : ''
                }`}
                onClick={() => navigate('dashboard')}
              >
                <LayoutDashboard size={18} />
              </button>

              <button
                title="Oportunidades"
                className={`rail-item ${
                  page === 'deals' ? 'current' : ''
                }`}
                onClick={() => navigate('deals')}
              >
                <GitBranch size={18} />
              </button>

              <button
                title="Contactos"
                className={`rail-item ${
                  page === 'contacts' ? 'current' : ''
                }`}
                onClick={() => navigate('contacts')}
              >
                <UsersRound size={18} />
              </button>

              <button
                title="Empresas"
                className={`rail-item ${
                  page === 'companies' ? 'current' : ''
                }`}
                onClick={() => navigate('companies')}
              >
                <Building2 size={18} />
              </button>

              <button
                title="Nueva oportunidad"
                className="rail-item rail-plus"
                onClick={() =>
                  edit({
                    kind: 'deal',
                  })
                }
              >
                <Plus size={18} />
              </button>

              <div className="rail-separator" />

              <button
                title="Tareas"
                className={`rail-item ${
                  page === 'tasks' ? 'current' : ''
                }`}
                onClick={() => navigate('tasks')}
              >
                <CalendarClock size={18} />
              </button>

              <button
                title="Actividad"
                className={`rail-item ${
                  page === 'activity' ? 'current' : ''
                }`}
                onClick={() => navigate('activity')}
              >
                <ActivityIcon size={18} />
              </button>

              <button
                title="Reportes"
                className={`rail-item ${
                  page === 'insights' ? 'current' : ''
                }`}
                onClick={() => navigate('insights')}
              >
                <Sparkles size={18} />
              </button>
            </div>

            <div className="rail-bottom">
              <button
                className="rail-item"
                title="Ayuda"
                onClick={() => setHelpOpen(true)}
              >
                <CircleHelp size={18} />
              </button>

              <button
                className={`rail-item ${
                  page === 'settings' ? 'current' : ''
                }`}
                title="Configuración"
                onClick={() => navigate('settings')}
              >
                <SettingsIcon size={18} />
              </button>
            </div>
          </aside>

          <main className="main-area" id="main-content">
            {page === 'dashboard' && (
              <Dashboard
                navigate={navigate}
                newDeal={() => edit({ kind: 'deal' })}
                editDeal={(value) =>
                  edit({
                    kind: 'deal',
                    value,
                  })
                }
              />
            )}

            {page === 'deals' && (
              <Deals
                onAdd={() => edit({ kind: 'deal' })}
                onEdit={(value) =>
                  edit({
                    kind: 'deal',
                    value,
                  })
                }
              />
            )}

            {page === 'contacts' && (
              <Contacts
                onAdd={() => edit({ kind: 'contact' })}
                onEdit={(value) =>
                  edit({
                    kind: 'contact',
                    value,
                  })
                }
              />
            )}

            {page === 'companies' && (
              <Companies
                onAdd={() => edit({ kind: 'company' })}
                onEdit={(value) =>
                  edit({
                    kind: 'company',
                    value,
                  })
                }
              />
            )}

            {page === 'tasks' && (
              <Tasks
                onAdd={() => edit({ kind: 'task' })}
                onEdit={(value) =>
                  edit({
                    kind: 'task',
                    value,
                  })
                }
              />
            )}

            {page === 'activity' && <Activity />}

            {page === 'insights' && <Insights />}

            {page === 'settings' && <Settings />}
          </main>
        </div>

        <footer className="app-footer">
          <span>
            <span className="live-dot" />
            Workspace · {data.settings.organization}
          </span>

          <span>NEXO CRM 0.1 · Demo local</span>

          <span>
            <Command size={12} />
            Ctrl / ⌘ + K para buscar
          </span>
        </footer>
      </div>

      {searchOpen && (
        <button
          className="dismiss-popovers"
          title="Cerrar búsqueda"
          onClick={() => setSearchOpen(false)}
          tabIndex={-1}
        />
      )}

      {editing && (
        <EditorModal
          key={`${editing.kind}-${editing.value?.id ?? 'new'}`}
          editing={editing}
          onClose={() => setEditing(null)}
        />
      )}

      {notification && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {notification}
        </div>
      )}

      {helpOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setHelpOpen(false);
            }
          }}
        >
          <section
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Guía rápida"
          >
            <header>
              <div className="brand-help">
                <Sparkles size={20} />
                Guía rápida
              </div>

              <button
                className="icon-btn"
                onClick={() => setHelpOpen(false)}
                aria-label="Cerrar"
              >
                <X size={19} />
              </button>
            </header>

            <h2>
              Todo lo importante,
              <br />
              <span>en un solo lugar.</span>
            </h2>

            <p>
              Empezá registrando una empresa, sumá sus contactos
              y creá una oportunidad comercial. Movela por las
              etapas del pipeline y agregá tareas para recordar
              el próximo paso.
            </p>

            <ol>
              <li>
                <strong>Empresas</strong> — Registrá las
                organizaciones.
              </li>

              <li>
                <strong>Contactos</strong> — Guardá a las
                personas involucradas.
              </li>

              <li>
                <strong>Oportunidades</strong> — Seguimiento
                de ventas y presupuestos.
              </li>

              <li>
                <strong>Tareas</strong> — Recordatorios
                concretos con vencimiento.
              </li>

              <li>
                <strong>Insights</strong> — Estadísticas que
                se actualizan automáticamente.
              </li>
            </ol>

            <p className="hint-row">
              Podés experimentar sin riesgo: Configuración →
              Reiniciar demo.
            </p>

            <button
              className="btn btn-primary"
              onClick={() => {
                setHelpOpen(false);
                navigate('deals');
              }}
            >
              Explorar oportunidades
              <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <CRMProvider>
      <WorkSpace />
    </CRMProvider>
  );
}
