
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Activity as ActivityIcon,
  ArrowRight,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Command,
  Download,
  GitBranch,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';

import { Avatar, Brand } from './components/Shared';
import { NotificationCenter } from './components/NotificationCenter';
import type { CRMNotification } from './components/NotificationCenter';
import { EditorModal } from './components/EditorModal';
import type { Editing } from './components/EditorModal';

import { CRMProvider, useCRM } from './lib/store';
import { isPublicDemoMode } from './lib/persistence';
import { searchCRM } from './lib/search';
import { downloadJSON, overdue } from './lib/utils';

import type { Deal, Page, Task } from './types';

import './styles.css';

// Cada pantalla se descarga solo cuando se necesita.

const Dashboard = lazy(() =>
  import('./views/Dashboard').then((m) => ({
    default: m.Dashboard,
  })),
);

const Deals = lazy(() =>
  import('./views/Deals').then((m) => ({
    default: m.Deals,
  })),
);

const Contacts = lazy(() =>
  import('./views/Contacts').then((m) => ({
    default: m.Contacts,
  })),
);

const Companies = lazy(() =>
  import('./views/Companies').then((m) => ({
    default: m.Companies,
  })),
);

const Tasks = lazy(() =>
  import('./views/Tasks').then((m) => ({
    default: m.Tasks,
  })),
);

const Activity = lazy(() =>
  import('./views/Activity').then((m) => ({
    default: m.Activity,
  })),
);

const Insights = lazy(() =>
  import('./views/Insights').then((m) => ({
    default: m.Insights,
  })),
);

const Settings = lazy(() =>
  import('./views/Settings').then((m) => ({
    default: m.Settings,
  })),
);

const Calendar = lazy(() =>
  import('./views/Calendar').then((m) => ({
    default: m.Calendar,
  })),
);

// La Demo no monta la mensajería real ni ejecuta sus RPC.

const Messages = lazy(() =>
  isPublicDemoMode()
    ? import('./views/DemoMessages').then((m) => ({
        default: m.DemoMessages,
      }))
    : import('./views/Messages').then((m) => ({
        default: m.Messages,
      })),
);

type WorkspacePage = Page | 'messages' | 'calendar';

const nav = [
  { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
  { id: 'messages', label: 'Mensajería', icon: MessageSquare },
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
  { id: 'tasks', label: 'Tareas', icon: CalendarClock },
  { id: 'companies', label: 'Clientes', icon: Building2 },
  { id: 'contacts', label: 'Contactos', icon: UsersRound },
  { id: 'deals', label: 'Pipeline', icon: GitBranch },
  { id: 'activity', label: 'Historial', icon: ActivityIcon },
  { id: 'insights', label: 'Reportes', icon: Sparkles },
] satisfies {
  id: WorkspacePage;
  label: string;
  icon: typeof LayoutDashboard;
}[];

const validPages: WorkspacePage[] = [
  ...nav.map((item) => item.id),
  'settings',
];

function LoadingPage() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 220,
        color: '#a2b4d3',
        fontSize: 13,
      }}
    >
      Cargando sección...
    </div>
  );
}

function WorkSpace() {
  const { data, notification } = useCRM();

  const [page, setPage] = useState<WorkspacePage>(() => {
    const hash = window.location.hash.replace('#/', '') as WorkspacePage;

    return validPages.includes(hash) ? hash : 'dashboard';
  });

  const [editing, setEditing] = useState<Editing | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const navigate = (destination: WorkspacePage) => {
    setPage(destination);
    window.location.hash = `/${destination}`;
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });

    setSearchOpen(false);
    setProfileOpen(false);
    setMenuOpen(false);
  };

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#/', '') as WorkspacePage;

      if (validPages.includes(hash)) {
        setPage(hash);
      }
    };

    window.addEventListener('hashchange', onHashChange);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }

      if (event.key === 'Escape') {
        setSearchOpen(false);
        setProfileOpen(false);
        setMenuOpen(false);
        setHelpOpen(false);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const urgent = data.tasks
    .filter((task) => !task.done && overdue(task.dueDate))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const matches = useMemo(
    () => searchCRM(data, search, 8),
    [data, search],
  );

  const openResult = (result: (typeof matches)[number]) => {
    switch (result.kind) {
      case 'deal': {
        const value = data.deals.find(
          (item) => item.id === result.id,
        );

        if (value) {
          navigate('deals');
          setEditing({ kind: 'deal', value });
        }

        break;
      }

      case 'contact': {
        const value = data.contacts.find(
          (item) => item.id === result.id,
        );

        if (value) {
          navigate('contacts');
          setEditing({ kind: 'contact', value });
        }

        break;
      }

      case 'company': {
        const value = data.companies.find(
          (item) => item.id === result.id,
        );

        if (value) {
          navigate('companies');
          setEditing({ kind: 'company', value });
        }

        break;
      }

      case 'task': {
        const value = data.tasks.find(
          (item) => item.id === result.id,
        );

        if (value) {
          navigate('tasks');
          setEditing({ kind: 'task', value });
        }

        break;
      }
    }

    setSearch('');
    setSearchOpen(false);
  };

  const openNotification = (item: CRMNotification) => {
    const entityId = item.entity_id ?? '';

    if (
      item.entity_type === 'conversation' ||
      item.notification_type === 'message'
    ) {
      navigate('messages');
      return;
    }

    if (
      item.entity_type === 'event' ||
      item.notification_type === 'event_due' ||
      item.notification_type === 'event'
    ) {
      navigate('calendar');
      return;
    }

    if (
      item.entity_type === 'task' ||
      item.notification_type === 'task_due'
    ) {
      const value = data.tasks.find(
        (task) => task.id === entityId,
      );

      navigate('tasks');

      if (value) {
        setEditing({ kind: 'task', value });
      }

      return;
    }

    if (
      item.entity_type === 'deal' ||
      item.notification_type === 'deal_due'
    ) {
      const value = data.deals.find(
        (deal) => deal.id === entityId,
      );

      navigate('deals');

      if (value) {
        setEditing({ kind: 'deal', value });
      }

      return;
    }

    if (item.entity_type === 'company') {
      const value = data.companies.find(
        (company) => company.id === entityId,
      );

      navigate('companies');

      if (value) {
        setEditing({ kind: 'company', value });
      }

      return;
    }

    if (item.entity_type === 'contact') {
      const value = data.contacts.find(
        (contact) => contact.id === entityId,
      );

      navigate('contacts');

      if (value) {
        setEditing({ kind: 'contact', value });
      }

      return;
    }

    navigate('activity');
  };

  const navLinks = nav.map(({ id, label, icon: Icon }) => (
    <button
      key={id}
      type="button"
      className={`nav-link ${page === id ? 'active' : ''}`}
      aria-current={page === id ? 'page' : undefined}
      onClick={() => navigate(id)}
    >
      <Icon size={16} />
      {label}
    </button>
  ));

  return (
    <div className="app-shell">
      <div className="ambient-glow ambient-left" />
      <div className="ambient-glow ambient-right" />

      <div className="app-frame">
        <header className="topbar">
          <button
            className="brand-button"
            type="button"
            onClick={() => navigate('dashboard')}
            aria-label="Ir al inicio"
          >
            <Brand />
          </button>

          <nav
            className="topnav"
            aria-label="Navegación principal"
          >
            {navLinks}
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
                value={search}
                placeholder="Buscar en NEXO..."
                aria-label="Búsqueda global"
                aria-expanded={
                  searchOpen && search.trim().length >= 2
                }
                aria-controls="nexo-global-search-results"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && matches[0]) {
                    event.preventDefault();
                    openResult(matches[0]);
                  }
                }}
              />

              <kbd>Ctrl K</kbd>

              {searchOpen && search.trim().length >= 2 && (
                <div
                  className="search-dropdown"
                  id="nexo-global-search-results"
                  role="region"
                  aria-label="Resultados de búsqueda"
                >
                  <div className="dropdown-label">
                    RESULTADOS DE BÚSQUEDA
                  </div>

                  {matches.length ? (
                    matches.map((result) => (
                      <button
                        type="button"
                        key={`${result.kind}-${result.id}`}
                        onMouseDown={(event) =>
                          event.preventDefault()
                        }
                        onClick={() => openResult(result)}
                      >
                        <span>
                          <strong>{result.title}</strong>
                          <small>{result.detail}</small>
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

            <NotificationCenter
              fallbackTasks={urgent}
              onOpen={openNotification}
              onOpenPanel={() => setProfileOpen(false)}
            />

            <div className="popover-anchor">
              <button
                type="button"
                className="profile-button"
                aria-label="Menú de usuario"
                aria-expanded={profileOpen}
                onClick={() =>
                  setProfileOpen((open) => !open)
                }
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
                    {data.settings.organization}
                  </small>

                  <div className="menu-divider" />

                  <button
                    type="button"
                    onClick={() => navigate('settings')}
                  >
                    <SettingsIcon size={16} />
                    Configuración
                  </button>

                  <button
                    type="button"
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
              type="button"
              className="mobile-menu-btn tool-icon"
              aria-label="Abrir menú"
              aria-expanded={menuOpen}
              onClick={() =>
                setMenuOpen((open) => !open)
              }
            >
              <Menu size={21} />
            </button>
          </div>
        </header>

        {menuOpen && (
          <nav
            className="mobile-nav"
            aria-label="Menú móvil"
          >
            {navLinks}

            <button
              type="button"
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
              {nav.slice(0, 7).map(
                ({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    title={label}
                    aria-label={label}
                    className={`rail-item ${
                      page === id ? 'current' : ''
                    }`}
                    onClick={() => navigate(id)}
                  >
                    <Icon size={18} />
                  </button>
                ),
              )}

              <button
                type="button"
                title="Nueva oportunidad"
                aria-label="Nueva oportunidad"
                className="rail-item rail-plus"
                onClick={() =>
                  setEditing({ kind: 'deal' })
                }
              >
                <Plus size={18} />
              </button>

              <div className="rail-separator" />

              {nav.slice(7).map(
                ({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    title={label}
                    aria-label={label}
                    className={`rail-item ${
                      page === id ? 'current' : ''
                    }`}
                    onClick={() => navigate(id)}
                  >
                    <Icon size={18} />
                  </button>
                ),
              )}
            </div>

            <div className="rail-bottom">
              <button
                type="button"
                className="rail-item"
                title="Ayuda"
                aria-label="Ayuda"
                onClick={() => setHelpOpen(true)}
              >
                <CircleHelp size={18} />
              </button>

              <button
                type="button"
                className={`rail-item ${
                  page === 'settings' ? 'current' : ''
                }`}
                title="Configuración"
                aria-label="Configuración"
                onClick={() => navigate('settings')}
              >
                <SettingsIcon size={18} />
              </button>
            </div>
          </aside>

          <main className="main-area" id="main-content">
            <Suspense fallback={<LoadingPage />}>
              {page === 'dashboard' && (
                <Dashboard
                  navigate={navigate}
                  newDeal={() =>
                    setEditing({ kind: 'deal' })
                  }
                  editDeal={(value: Deal) =>
                    setEditing({ kind: 'deal', value })
                  }
                />
              )}

              {page === 'messages' && <Messages />}

              {page === 'calendar' && (
                <Calendar
                  onNewTask={() =>
                    setEditing({ kind: 'task' })
                  }
                  onEditTask={(value: Task) =>
                    setEditing({ kind: 'task', value })
                  }
                  onEditDeal={(value: Deal) =>
                    setEditing({ kind: 'deal', value })
                  }
                />
              )}

              {page === 'tasks' && (
                <Tasks
                  onAdd={() =>
                    setEditing({ kind: 'task' })
                  }
                  onEdit={(value: Task) =>
                    setEditing({ kind: 'task', value })
                  }
                />
              )}

              {page === 'companies' && (
                <Companies
                  onAdd={() =>
                    setEditing({ kind: 'company' })
                  }
                  onEdit={(value) =>
                    setEditing({ kind: 'company', value })
                  }
                />
              )}

              {page === 'contacts' && (
                <Contacts
                  onAdd={() =>
                    setEditing({ kind: 'contact' })
                  }
                  onEdit={(value) =>
                    setEditing({ kind: 'contact', value })
                  }
                />
              )}

              {page === 'deals' && (
                <Deals
                  onAdd={() =>
                    setEditing({ kind: 'deal' })
                  }
                  onEdit={(value: Deal) =>
                    setEditing({ kind: 'deal', value })
                  }
                />
              )}

              {page === 'activity' && <Activity />}

              {page === 'insights' && <Insights />}

              {page === 'settings' && <Settings />}
            </Suspense>
          </main>
        </div>

        <footer className="app-footer">
          <span>
            <span className="live-dot" />
            Workspace · {data.settings.organization}
          </span>

          <span>NEXO CRM 0.1</span>

          <span>
            <Command size={12} />
            Ctrl / ⌘ + K para buscar
          </span>
        </footer>
      </div>

      {searchOpen && (
        <button
          className="dismiss-popovers"
          aria-label="Cerrar búsqueda"
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
                type="button"
                aria-label="Cerrar"
                onClick={() => setHelpOpen(false)}
              >
                <X size={19} />
              </button>
            </header>

            <h2>
              Todo lo importante,
              <span> en un solo lugar.</span>
            </h2>

            <p>
              Registrá clientes, sumá contactos, creá oportunidades y
              tareas. El calendario organiza los vencimientos; la
              mensajería interna conecta a los integrantes del equipo.
              La demo utiliza únicamente datos de ejemplo.
            </p>

            <ol>
              <li>
                <strong>Clientes</strong> — Organizaciones.
              </li>
              <li>
                <strong>Contactos</strong> — Personas asociadas.
              </li>
              <li>
                <strong>Pipeline</strong> — Oportunidades de venta.
              </li>
              <li>
                <strong>Tareas y Calendario</strong> — Próximas acciones.
              </li>
              <li>
                <strong>Mensajería</strong> — Conversaciones del equipo.
              </li>
              <li>
                <strong>Historial y Reportes</strong> — Seguimiento.
              </li>
            </ol>

            <p className="hint-row">
              Los visitantes de la demo no pueden acceder a datos reales.
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setHelpOpen(false);
                navigate('deals');
              }}
            >
              Explorar pipeline
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
