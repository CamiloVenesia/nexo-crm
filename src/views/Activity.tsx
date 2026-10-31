
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Activity as ActivityIcon,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  GitBranch,
  Search,
  SlidersHorizontal,
  UserRound,
  UsersRound,
} from 'lucide-react';

import { PageHeading } from '../components/Shared';
import { useCRM } from '../lib/store';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../lib/workspace';
import { csvDownload, toDateInput } from '../lib/utils';
import type { Activity as CRMActivity, ActivityType } from '../types';

import './task-history-refresh.css';
import './activity-history.css';

type Category = 'all' | 'sales' | 'tasks' | 'clients' | 'system' | 'notes';
type Period = 'all' | 'today' | '7d' | '30d';

type ActivityMember = {
  userId: string;
  email: string;
  role: string;
};

type ActivityActorRow = {
  id: string;
  actor_user_id: string | null;
};

type ChatMemberRow = {
  member_user_id: string;
  member_email: string;
  member_role: string;
};

type ActorInfo = {
  userId: string;
  label: string;
  role: string;
};

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'sales', label: 'Negocios' },
  { value: 'tasks', label: 'Tareas' },
  { value: 'clients', label: 'Clientes y contactos' },
  { value: 'system', label: 'Sistema' },
  { value: 'notes', label: 'Notas' },
];

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'all', label: 'Todas las fechas' },
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
];

const ICONS: Record<ActivityType, typeof ActivityIcon> = {
  deal: GitBranch,
  task: CheckCircle2,
  contact: UserRound,
  company: Building2,
  note: FileText,
  system: BadgeCheck,
};

const TYPE_LABELS: Record<ActivityType, string> = {
  deal: 'Negocio',
  task: 'Tarea',
  contact: 'Contacto',
  company: 'Cliente',
  note: 'Nota',
  system: 'Configuración',
};

const ENTITY_NAMES: Record<ActivityType, string> = {
  deal: 'una oportunidad',
  task: 'una tarea',
  contact: 'un contacto',
  company: 'un cliente',
  note: 'una nota',
  system: 'un ajuste',
};

function eventTitle(event: CRMActivity): string {
  switch (event.title) {
    case 'Nuevo registro':
      return `Se creó ${ENTITY_NAMES[event.type]}`;
    case 'Registro actualizado':
      return `Se actualizó ${ENTITY_NAMES[event.type]}`;
    case 'Registro eliminado':
      return `Se eliminó ${ENTITY_NAMES[event.type]}`;
    case 'Etapa actualizada':
      return 'Se cambió la etapa de una oportunidad';
    case 'Venta ganada':
      return 'Se ganó una oportunidad';
    case 'Oportunidad perdida':
      return 'Se perdió una oportunidad';
    case 'Tarea completada':
      return 'Se completó una tarea';
    case 'Tarea reabierta':
      return 'Se reabrió una tarea';
    default:
      return event.title;
  }
}

function matchesCategory(type: ActivityType, category: Category): boolean {
  if (category === 'all') return true;
  if (category === 'sales') return type === 'deal';
  if (category === 'tasks') return type === 'task';
  if (category === 'clients') return type === 'company' || type === 'contact';
  if (category === 'notes') return type === 'note';
  return type === 'system';
}

const clean = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

function dayInfo(
  value: string,
  today: string,
  yesterday: string,
): { key: string; label: string } {
  const parsed = new Date(value);

  if (!Number.isFinite(parsed.getTime())) {
    return { key: 'unknown', label: 'Sin fecha registrada' };
  }

  const key = toDateInput(parsed);

  if (key === today) return { key, label: 'Hoy' };
  if (key === yesterday) return { key, label: 'Ayer' };

  return {
    key,
    label: new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(parsed),
  };
}

function roleLabel(role: string): string {
  if (role === 'admin') return 'Administrador';
  if (role === 'member') return 'Miembro';
  return 'Equipo';
}

const PAGE_SIZE = 30;

export function Activity() {
  const { data, notify } = useCRM();
  const workspace = useWorkspace();
  const organizationId = workspace?.organizationId ?? '';
  const latestActivityId = data.activities[0]?.id ?? '';

  const [category, setCategory] = useState<Category>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [actorByActivityId, setActorByActivityId] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<ActivityMember[]>([]);
  const [actorLoading, setActorLoading] = useState(false);
  const [actorError, setActorError] = useState('');

  // ==========================================
  // CARGAR AUTORES DESDE SUPABASE
  // ==========================================

  useEffect(() => {
    const client = supabase;

    if (!client || !organizationId) {
      setActorByActivityId({});
      setMembers([]);
      setActorLoading(false);
      setActorError('');
      setActorFilter('all');
      return;
    }

    const activeClient = client as NonNullable<typeof supabase>;
    let cancelled = false;

    async function loadActivityAuthors() {
      setActorLoading(true);
      setActorError('');

      try {
        const [activitiesResult, membersResult] = await Promise.all([
          activeClient
            .from('crm_activities')
            .select('id, actor_user_id')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(150),

          activeClient.rpc('nexo_list_chat_members', {
            p_organization_id: organizationId,
          }),
        ]);

        if (activitiesResult.error) throw activitiesResult.error;
        if (membersResult.error) throw membersResult.error;

        const nextActorMap: Record<string, string> = {};

        for (const row of (activitiesResult.data ?? []) as ActivityActorRow[]) {
          if (row.id && row.actor_user_id) {
            nextActorMap[String(row.id)] = String(row.actor_user_id);
          }
        }

        const nextMembers = (
          (membersResult.data ?? []) as unknown as ChatMemberRow[]
        )
          .map((row) => ({
            userId: String(row.member_user_id),
            email: String(row.member_email ?? ''),
            role: String(row.member_role ?? 'member'),
          }))
          .filter((member) => member.userId)
          .sort((a, b) => a.email.localeCompare(b.email, 'es'));

        if (!cancelled) {
          setActorByActivityId(nextActorMap);
          setMembers(nextMembers);
          setActorError('');
        }
      } catch {
        if (!cancelled) {
          setActorByActivityId({});
          setMembers([]);
          setActorError(
            'No se pudieron cargar los autores. El resto del historial sigue disponible.',
          );
        }
      } finally {
        if (!cancelled) setActorLoading(false);
      }
    }

    void loadActivityAuthors();

    return () => {
      cancelled = true;
    };
  }, [organizationId, latestActivityId]);

  // ==========================================
  // IDENTIFICAR AUTOR
  // ==========================================

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );

  const getActor = useCallback(
    (event: CRMActivity): ActorInfo => {
      const userId = actorByActivityId[event.id] ?? '';
      const member = userId ? memberById.get(userId) : undefined;

      if (member) {
        return {
          userId,
          label: member.email || 'Usuario del equipo',
          role: member.role,
        };
      }

      if (userId && userId === workspace?.userId && workspace.userEmail) {
        return {
          userId,
          label: workspace.userEmail,
          role: workspace.role,
        };
      }

      return {
        userId,
        label: userId ? 'Usuario no disponible' : 'Autor no disponible',
        role: '',
      };
    },
    [actorByActivityId, memberById, workspace],
  );

  // ==========================================
  // FECHAS
  // ==========================================

  const today = toDateInput(new Date());

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);

  const yesterday = toDateInput(yesterdayDate);

  // ==========================================
  // FILTRADO DEL HISTORIAL
  // ==========================================

  const list = useMemo(() => {
    const query = clean(search);
    const now = Date.now();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const cutoff = period === 'today'
      ? todayStart.getTime()
      : period === '7d'
        ? now - 7 * 24 * 60 * 60 * 1000
        : period === '30d'
          ? now - 30 * 24 * 60 * 60 * 1000
          : null;

    return data.activities
      .filter((event) => {
        if (!matchesCategory(event.type, category)) return false;

        const actor = getActor(event);

        if (actorFilter !== 'all' && actor.userId !== actorFilter) {
          return false;
        }

        const stamp = Date.parse(event.createdAt);

        if (
          cutoff !== null &&
          (!Number.isFinite(stamp) || stamp < cutoff || stamp > now)
        ) {
          return false;
        }

        return clean([
          event.title,
          eventTitle(event),
          event.detail,
          TYPE_LABELS[event.type],
          actor.label,
          roleLabel(actor.role),
        ].join(' ')).includes(query);
      })
      .sort(
        (a, b) =>
          (Date.parse(b.createdAt) || 0) -
          (Date.parse(a.createdAt) || 0),
      );
  }, [
    data.activities,
    category,
    period,
    search,
    actorFilter,
    getActor,
  ]);

  // ==========================================
  // AGRUPACIÓN POR DÍA
  // ==========================================

  const shown = list.slice(0, visibleCount);

  const days = useMemo(() => {
    const groups: {
      key: string;
      label: string;
      entries: CRMActivity[];
    }[] = [];

    for (const entry of shown) {
      const { key, label } = dayInfo(
        entry.createdAt,
        today,
        yesterday,
      );

      const last = groups[groups.length - 1];

      if (last?.key === key) {
        last.entries.push(entry);
      } else {
        groups.push({
          key,
          label,
          entries: [entry],
        });
      }
    }

    return groups;
  }, [shown, today, yesterday]);

  // ==========================================
  // ACCIONES
  // ==========================================

  const resetPagination = () => setVisibleCount(PAGE_SIZE);

  const setCategoryAndReset = (next: Category) => {
    setCategory(next);
    resetPagination();
  };

  const exportCsv = () => {
    csvDownload('nexo-historial.csv', [
      [
        'Fecha',
        'Usuario',
        'Rol actual',
        'Tipo',
        'Movimiento',
        'Registro o detalle',
      ],
      ...list.map((event) => {
        const actor = getActor(event);

        return [
          event.createdAt,
          actor.label,
          actor.role ? roleLabel(actor.role) : '',
          TYPE_LABELS[event.type],
          eventTitle(event),
          event.detail,
        ];
      }),
    ]);

    notify('Historial exportado a CSV.');
  };

  const clearFilters = () => {
    setCategory('all');
    setPeriod('all');
    setActorFilter('all');
    setSearch('');
    resetPagination();
  };

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <div className="nexo-simple-page nexo-activity-page">
      <PageHeading
        eyebrow="SEGUIMIENTO / HISTORIAL"
        title="Historial"
        subtitle="Un registro de lo que pasó en NEXO, ordenado del movimiento más reciente al más antiguo."
      />

      <section
        className="nexo-history-intro"
        aria-label="Qué muestra el historial"
      >
        <ActivityIcon size={20} />

        <div>
          <strong>¿Para qué sirve esta sección?</strong>

          <p>
            Acá podés consultar qué se creó, modificó, completó o eliminó,
            quién realizó la acción y cuándo ocurrió. No son tareas pendientes:
            son movimientos que ya sucedieron.
          </p>
        </div>
      </section>

      <section className="panel nexo-simple-panel">
        <div
          className="nexo-history-categories"
          aria-label="Tipos de movimientos"
        >
          {CATEGORY_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={category === value ? 'selected' : ''}
              aria-pressed={category === value}
              onClick={() => setCategoryAndReset(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="nexo-simple-toolbar nexo-history-toolbar">
          <label className="nexo-simple-search">
            <Search size={16} />

            <input
              type="search"
              value={search}
              aria-label="Buscar en el historial"
              placeholder="Buscar un cliente, negocio, usuario o movimiento..."
              onChange={(event) => {
                setSearch(event.target.value);
                resetPagination();
              }}
            />
          </label>

          <div className="nexo-simple-actions nexo-history-actions">
            {workspace && (
              <label className="nexo-simple-select nexo-history-user-filter">
                <UsersRound size={15} />

                <select
                  aria-label="Filtrar por usuario"
                  value={actorFilter}
                  disabled={actorLoading && members.length === 0}
                  onChange={(event) => {
                    setActorFilter(event.target.value);
                    resetPagination();
                  }}
                >
                  <option value="all">
                    {actorLoading && members.length === 0
                      ? 'Cargando usuarios...'
                      : 'Todos los usuarios'}
                  </option>

                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.email || 'Usuario del equipo'}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="nexo-simple-select">
              <SlidersHorizontal size={15} />

              <select
                aria-label="Filtrar por período"
                value={period}
                onChange={(event) => {
                  setPeriod(event.target.value as Period);
                  resetPagination();
                }}
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn btn-outline"
              onClick={exportCsv}
            >
              <Download size={15} /> Exportar CSV
            </button>
          </div>
        </div>

        {actorError && (
          <p
            className="nexo-history-attribution-warning"
            role="status"
          >
            <UserRound size={14} /> {actorError}
          </p>
        )}

        <div className="nexo-simple-result-count" role="status">
          <CalendarDays size={14} />

          {list.length} movimiento{list.length === 1 ? '' : 's'} encontrados

          {actorLoading && (
            <span className="nexo-history-loading">
              Actualizando autores...
            </span>
          )}
        </div>

        {days.length ? (
          <div className="nexo-history-days">
            {days.map((day) => (
              <section className="nexo-history-day" key={day.key}>
                <h2>{day.label}</h2>

                <div className="nexo-history-entries">
                  {day.entries.map((event) => {
                    const Icon = ICONS[event.type];
                    const parsed = new Date(event.createdAt);

                    const time = Number.isFinite(parsed.getTime())
                      ? parsed.toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Hora no disponible';

                    const actor = getActor(event);

                    return (
                      <article
                        className="nexo-history-entry"
                        key={event.id}
                      >
                        <span
                          className={`nexo-history-icon type-${event.type}`}
                        >
                          <Icon size={17} />
                        </span>

                        <div className="nexo-history-entry-content">
                          <div className="nexo-history-entry-top">
                            <strong>{eventTitle(event)}</strong>

                            <time dateTime={event.createdAt}>
                              <Clock3 size={12} /> {time}
                            </time>
                          </div>

                          <div className="nexo-history-attribution">
                            <span className="nexo-history-actor">
                              <UserRound size={12} />
                              {actor.label}
                            </span>

                            {actor.role && (
                              <span
                                className="nexo-history-role"
                                title="Rol actual del integrante"
                              >
                                {roleLabel(actor.role)}
                              </span>
                            )}
                          </div>

                          {event.detail && (
                            <p className="nexo-history-related">
                              <span>
                                {event.type === 'system'
                                  ? 'Detalle:'
                                  : 'Registro relacionado:'}
                              </span>{' '}
                              {event.detail}
                            </p>
                          )}

                          <span className="nexo-history-kind">
                            {TYPE_LABELS[event.type]}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="nexo-simple-empty">
            <ActivityIcon size={26} />

            <strong>No hay movimientos para esta búsqueda</strong>

            <p>
              Podés cambiar el período, el usuario o el tipo de movimiento.
            </p>

            <button
              type="button"
              className="btn btn-outline"
              onClick={clearFilters}
            >
              Ver todo el historial
            </button>
          </div>
        )}

        {shown.length < list.length && (
          <div className="nexo-history-more">
            <span>
              Mostrando {shown.length} de {list.length}
            </span>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() =>
                setVisibleCount((current) => current + PAGE_SIZE)
              }
            >
              Mostrar más
            </button>
          </div>
        )}
      </section>

      <p className="nexo-simple-footnote nexo-history-footnote">
        <ActivityIcon size={15} />

        En el espacio conectado, el autor se identifica mediante la sesión
        autenticada y queda registrado en Supabase. El rol mostrado corresponde
        al rol actual del integrante. Esta vista presenta hasta los últimos
        150 movimientos cargados.
      </p>
    </div>
  );
}
