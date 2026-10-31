
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Circle,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  Video,
  X,
} from 'lucide-react';

import { PageHeading } from '../components/Shared';
import { useCRM } from '../lib/store';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../lib/workspace';
import { fmtDate } from '../lib/utils';
import type { Deal, Task } from '../types';

import './workspace-extras.css';
import './calendar-events.css';

type EventType = 'meeting' | 'call' | 'reminder' | 'other';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  type: EventType;
  location: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface EventFormState {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  type: EventType;
  location: string;
}

type Entry =
  | {
      id: string;
      kind: 'task';
      date: string;
      title: string;
      task: Task;
    }
  | {
      id: string;
      kind: 'deal';
      date: string;
      title: string;
      deal: Deal;
    }
  | {
      id: string;
      kind: 'event';
      date: string;
      title: string;
      event: CalendarEvent;
    };

interface CalendarProps {
  onNewTask: () => void;
  onEditTask: (task: Task) => void;
  onEditDeal: (deal: Deal) => void;
}

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  meeting: 'Reunión',
  call: 'Llamada',
  reminder: 'Recordatorio',
  other: 'Otro evento',
};

const EMPTY_FORM = (date: string): EventFormState => ({
  title: '',
  description: '',
  date,
  startTime: '09:00',
  endTime: '09:30',
  allDay: false,
  type: 'meeting',
  location: '',
});

function localDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function monthCells(
  year: number,
  month: number,
): (string | null)[] {
  const first = new Date(year, month, 1);
  const mondayIndex = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();

  return [
    ...Array.from({ length: mondayIndex }, () => null),
    ...Array.from(
      { length: days },
      (_, index) =>
        localDateInput(
          new Date(year, month, index + 1),
        ),
    ),
  ];
}

function monthRange(year: number, month: number) {
  const first = localDateInput(
    new Date(year, month, 1),
  );

  const last = localDateInput(
    new Date(year, month + 1, 0),
  );

  return { first, last };
}

function makeId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `event-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function mapEvent(row: any): CalendarEvent {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    date: String(row.event_date ?? '').slice(0, 10),
    startTime: row.start_time
      ? String(row.start_time).slice(0, 5)
      : '',
    endTime: row.end_time
      ? String(row.end_time).slice(0, 5)
      : '',
    allDay: Boolean(row.all_day),
    type: (
      [
        'meeting',
        'call',
        'reminder',
        'other',
      ].includes(row.event_type)
        ? row.event_type
        : 'other'
    ) as EventType,
    location: String(row.location ?? ''),
    createdBy: String(row.created_by ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function readLocalEvents(key: string): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is CalendarEvent =>
        Boolean(
          item &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          typeof item.date === 'string',
        ),
    );
  } catch {
    return [];
  }
}

function formatTimeRange(event: CalendarEvent): string {
  if (event.allDay) return 'Todo el día';

  if (event.startTime && event.endTime) {
    return `${event.startTime}–${event.endTime}`;
  }

  return event.startTime || 'Horario sin definir';
}

function eventSortValue(entry: Entry): string {
  if (entry.kind === 'event') {
    return entry.event.allDay
      ? '00:00'
      : entry.event.startTime || '00:00';
  }

  return '99:99';
}

function eventTypeClass(type: EventType): string {
  return `event-${type}`;
}

export function Calendar({
  onNewTask,
  onEditTask,
  onEditDeal,
}: CalendarProps) {
  const workspace = useWorkspace();

  const {
    data,
    toggleTask,
    notify,
  } = useCRM();

  const [viewDate, setViewDate] = useState(
    () => new Date(),
  );

  const [selectedDate, setSelectedDate] = useState(
    () => localDateInput(new Date()),
  );

  const [showClosings, setShowClosings] =
    useState(true);

  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const [eventsLoading, setEventsLoading] =
    useState(true);

  const [eventsError, setEventsError] = useState('');

  const [localReady, setLocalReady] =
    useState(false);

  const [formOpen, setFormOpen] = useState(false);

  const [editingEvent, setEditingEvent] =
    useState<CalendarEvent | null>(null);

  const [form, setForm] = useState<EventFormState>(
    () => EMPTY_FORM(localDateInput(new Date())),
  );

  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const today = localDateInput(new Date());

  const {
    first: monthFirst,
    last: monthLast,
  } = monthRange(year, month);

  const localStorageKey = workspace
    ? `nexo-calendar-events:${workspace.organizationId}`
    : 'nexo-calendar-events:demo';

  const cells = useMemo(
    () => monthCells(year, month),
    [year, month],
  );

  // ==========================================
  // CARGA Y SINCRONIZACIÓN DE EVENTOS
  // ==========================================

  useEffect(() => {
    let active = true;

    if (!supabase || !workspace) {
      setEvents(readLocalEvents(localStorageKey));
      setEventsLoading(false);
      setEventsError('');
      setLocalReady(true);

      return () => {
        active = false;
      };
    }

    const client = supabase;
    const organizationId = workspace.organizationId;

    setEventsLoading(true);
    setEventsError('');

    const loadEvents = async () => {
      const {
        data: rows,
        error,
      } = await client
        .from('crm_events')
        .select(
          'id, title, description, event_date, start_time, end_time, all_day, event_type, location, created_by, created_at, updated_at',
        )
        .eq('organization_id', organizationId)
        .gte('event_date', monthFirst)
        .lte('event_date', monthLast)
        .order('event_date', { ascending: true })
        .order('start_time', {
          ascending: true,
          nullsFirst: true,
        });

      if (!active) return;

      if (error) {
        setEventsError(error.message);
        setEventsLoading(false);
        return;
      }

      setEvents((rows ?? []).map(mapEvent));
      setEventsLoading(false);
    };

    void loadEvents();

    const channel = client
      .channel(
        `calendar-events-${organizationId}-${year}-${month}`,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_events',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          void loadEvents();
        },
      )
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [
    workspace?.organizationId,
    workspace?.userId,
    monthFirst,
    monthLast,
    year,
    month,
    localStorageKey,
  ]);

  // En modo demostración, los eventos se guardan
  // en el navegador. En modo Supabase, PostgreSQL
  // es la fuente de verdad.

  useEffect(() => {
    if (supabase && workspace) return;
    if (!localReady) return;

    try {
      localStorage.setItem(
        localStorageKey,
        JSON.stringify(events),
      );
    } catch {
      setEventsError(
        'No se pudieron guardar los eventos en este navegador.',
      );
    }
  }, [
    events,
    localReady,
    localStorageKey,
    workspace,
  ]);

  // ==========================================
  // EVENTOS, TAREAS Y CIERRES DEL MES
  // ==========================================

  const entries = useMemo<Entry[]>(() => {
    const tasks: Entry[] = data.tasks
      .filter((task) => Boolean(task.dueDate))
      .map((task): Entry => ({
        id: `task-${task.id}`,
        kind: 'task',
        date: task.dueDate,
        title: task.title,
        task,
      }));

    const deals: Entry[] = showClosings
      ? data.deals
          .filter(
            (deal) =>
              Boolean(deal.dueDate) &&
              deal.stage !== 'ganado' &&
              deal.stage !== 'perdido',
          )
          .map((deal): Entry => ({
            id: `deal-${deal.id}`,
            kind: 'deal',
            date: deal.dueDate,
            title: deal.title,
            deal,
          }))
      : [];

    const calendarEntries: Entry[] = events.map(
      (event): Entry => ({
        id: `event-${event.id}`,
        kind: 'event',
        date: event.date,
        title: event.title,
        event,
      }),
    );

    return [
      ...calendarEntries,
      ...tasks,
      ...deals,
    ];
  }, [
    data.tasks,
    data.deals,
    events,
    showClosings,
  ]);

  const byDate = useMemo(() => {
    const dates = new Map<string, Entry[]>();

    for (const entry of entries) {
      dates.set(entry.date, [
        ...(dates.get(entry.date) ?? []),
        entry,
      ]);
    }

    return dates;
  }, [entries]);

  const selectedEntries = [
    ...(byDate.get(selectedDate) ?? []),
  ].sort((a, b) => {
    const timeOrder = eventSortValue(a).localeCompare(
      eventSortValue(b),
    );

    if (timeOrder !== 0) return timeOrder;

    return a.kind.localeCompare(b.kind);
  });

  const pending = data.tasks.filter(
    (task) => !task.done,
  ).length;

  const overdueCount = data.tasks.filter(
    (task) =>
      !task.done &&
      task.dueDate &&
      task.dueDate < today,
  ).length;

  const monthEventCount = events.length;

  const plannedClosings = data.deals.filter(
    (deal) =>
      deal.dueDate &&
      deal.dueDate >= monthFirst &&
      deal.dueDate <= monthLast &&
      !['ganado', 'perdido'].includes(deal.stage),
  ).length;

  const shiftMonth = (amount: number) => {
    const next = new Date(
      year,
      month + amount,
      1,
    );

    setViewDate(next);
    setSelectedDate(localDateInput(next));
  };

  // ==========================================
  // FORMULARIO DE EVENTOS
  // ==========================================

  const openNewEvent = () => {
    setEditingEvent(null);
    setForm(EMPTY_FORM(selectedDate));
    setFormError('');
    setFormOpen(true);
  };

  const openEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);

    setForm({
      title: event.title,
      description: event.description,
      date: event.date,
      startTime: event.startTime || '09:00',
      endTime: event.endTime || '09:30',
      allDay: event.allDay,
      type: event.type,
      location: event.location,
    });

    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;

    setFormOpen(false);
    setEditingEvent(null);
    setFormError('');
  };

  const saveEvent = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (saving) return;

    const title = form.title.trim();

    if (title.length < 2) {
      setFormError(
        'El título debe tener al menos 2 caracteres.',
      );
      return;
    }

    if (!form.date) {
      setFormError(
        'Seleccioná la fecha del evento.',
      );
      return;
    }

    if (
      !form.allDay &&
      (
        !form.startTime ||
        !form.endTime ||
        form.endTime <= form.startTime
      )
    ) {
      setFormError(
        'La hora de finalización debe ser posterior a la hora de inicio.',
      );
      return;
    }

    setSaving(true);
    setFormError('');

    const now = new Date().toISOString();

    try {
      if (supabase && workspace) {
        const payload = {
          title,
          description: form.description.trim(),
          event_date: form.date,
          start_time: form.allDay
            ? null
            : form.startTime,
          end_time: form.allDay
            ? null
            : form.endTime,
          all_day: form.allDay,
          event_type: form.type,
          location: form.location.trim(),
          updated_at: now,
        };

        if (editingEvent) {
          const {
            data: row,
            error,
          } = await supabase
            .from('crm_events')
            .update(payload)
            .eq(
              'organization_id',
              workspace.organizationId,
            )
            .eq('id', editingEvent.id)
            .select(
              'id, title, description, event_date, start_time, end_time, all_day, event_type, location, created_by, created_at, updated_at',
            )
            .single();

          if (error) throw error;

          const updated = mapEvent(row);

          setEvents((current) =>
            current.map((item) =>
              item.id === updated.id
                ? updated
                : item,
            ),
          );
        } else {
          const {
            data: row,
            error,
          } = await supabase
            .from('crm_events')
            .insert({
              organization_id: workspace.organizationId,
              created_by: workspace.userId,
              ...payload,
              created_at: now,
            })
            .select(
              'id, title, description, event_date, start_time, end_time, all_day, event_type, location, created_by, created_at, updated_at',
            )
            .single();

          if (error) throw error;

          const created = mapEvent(row);

          setEvents((current) => [
            ...current,
            created,
          ]);
        }
      } else {
        const localEvent: CalendarEvent = {
          id: editingEvent?.id ?? makeId(),
          title,
          description: form.description.trim(),
          date: form.date,
          startTime: form.allDay
            ? ''
            : form.startTime,
          endTime: form.allDay
            ? ''
            : form.endTime,
          allDay: form.allDay,
          type: form.type,
          location: form.location.trim(),
          createdBy:
            editingEvent?.createdBy ?? 'local',
          createdAt:
            editingEvent?.createdAt ?? now,
          updatedAt: now,
        };

        setEvents((current) => {
          if (editingEvent) {
            return current.map((item) =>
              item.id === localEvent.id
                ? localEvent
                : item,
            );
          }

          return [...current, localEvent];
        });
      }

      const savedDate = form.date;

      setViewDate(
        new Date(
          Number(savedDate.slice(0, 4)),
          Number(savedDate.slice(5, 7)) - 1,
          1,
        ),
      );

      setSelectedDate(savedDate);
      setFormOpen(false);
      setEditingEvent(null);

      notify(
        editingEvent
          ? 'Evento actualizado correctamente.'
          : 'Evento creado correctamente.',
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar el evento.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // ELIMINAR EVENTOS
  // ==========================================

  const deleteEvent = async (
    event: CalendarEvent,
  ) => {
    const canManage =
      !workspace ||
      workspace.role === 'admin' ||
      event.createdBy === workspace.userId;

    if (!canManage) {
      notify(
        'Solo quien creó el evento o un administrador puede eliminarlo.',
      );
      return;
    }

    const confirmed = window.confirm(
      `¿Querés eliminar el evento "${event.title}"? Esta acción no se puede deshacer.`,
    );

    if (!confirmed) return;

    try {
      if (supabase && workspace) {
        const { error } = await supabase
          .from('crm_events')
          .delete()
          .eq(
            'organization_id',
            workspace.organizationId,
          )
          .eq('id', event.id);

        if (error) throw error;
      }

      setEvents((current) =>
        current.filter(
          (item) => item.id !== event.id,
        ),
      );

      notify('Evento eliminado.');
    } catch (error) {
      notify(
        error instanceof Error
          ? `No se pudo eliminar el evento: ${error.message}`
          : 'No se pudo eliminar el evento.',
      );
    }
  };

  const canManageEvent = (
    event: CalendarEvent,
  ) =>
    !workspace ||
    workspace.role === 'admin' ||
    event.createdBy === workspace.userId;

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <div className="nexo-extras nexo-calendar-page">
      <PageHeading
        eyebrow="PRODUCTIVIDAD / CALENDARIO"
        title="Calendario"
        subtitle="Organizá reuniones, llamadas, recordatorios y fechas clave de tu equipo."
        action={
          <div className="nexo-calendar-heading-actions">
            <button
              className="btn btn-outline"
              type="button"
              onClick={onNewTask}
            >
              <Plus size={15} />
              Nueva tarea
            </button>

            <button
              className="btn btn-primary"
              type="button"
              onClick={openNewEvent}
            >
              <CalendarPlus size={16} />
              Nuevo evento
            </button>
          </div>
        }
      />

      <div
        className="nexo-cal-summary nexo-cal-summary-events"
        aria-label="Resumen del calendario"
      >
        <div>
          <strong>{pending}</strong>
          <span>Tareas pendientes</span>
        </div>

        <div>
          <strong>{overdueCount}</strong>
          <span>Tareas vencidas</span>
        </div>

        <div>
          <strong>{monthEventCount}</strong>
          <span>Eventos del mes</span>
        </div>

        <div>
          <strong>{plannedClosings}</strong>
          <span>Cierres previstos</span>
        </div>
      </div>

      {eventsError && (
        <div
          className="nexo-calendar-alert"
          role="alert"
        >
          <strong>
            No se pudieron cargar los eventos.
          </strong>

          <span>{eventsError}</span>

          {supabase && workspace && (
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => window.location.reload()}
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      <div className="nexo-cal-layout">
        <section
          className="panel nexo-cal-panel"
          aria-label="Calendario mensual"
        >
          <div className="nexo-cal-heading">
            <div>
              <h2>
                {new Intl.DateTimeFormat('es-AR', {
                  month: 'long',
                  year: 'numeric',
                }).format(viewDate)}
              </h2>

              {eventsLoading && (
                <small className="nexo-calendar-loading">
                  Sincronizando eventos…
                </small>
              )}
            </div>

            <div className="nexo-cal-actions">
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => {
                  const date = new Date();

                  setViewDate(date);
                  setSelectedDate(
                    localDateInput(date),
                  );
                }}
              >
                Hoy
              </button>

              <button
                className="nexo-extras-icon"
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Mes anterior"
              >
                <ArrowLeft size={17} />
              </button>

              <button
                className="nexo-extras-icon"
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Mes siguiente"
              >
                <ArrowRight size={17} />
              </button>
            </div>
          </div>

          <div
            className="nexo-cal-weekdays"
            aria-hidden="true"
          >
            {[
              'Lun',
              'Mar',
              'Mié',
              'Jue',
              'Vie',
              'Sáb',
              'Dom',
            ].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="nexo-cal-grid">
            {cells.map((date, index) => {
              const dayEntries = date
                ? byDate.get(date) ?? []
                : [];

              return date ? (
                <button
                  key={date}
                  type="button"
                  className={`nexo-cal-cell ${
                    date === selectedDate
                      ? 'selected'
                      : ''
                  } ${
                    date === today
                      ? 'today'
                      : ''
                  }`}
                  aria-label={`${fmtDate(date)}, ${dayEntries.length} elementos`}
                  aria-pressed={
                    date === selectedDate
                  }
                  onClick={() =>
                    setSelectedDate(date)
                  }
                >
                  <span className="nexo-cal-number">
                    {Number(date.slice(-2))}
                  </span>

                  <span className="nexo-cal-events">
                    {dayEntries
                      .slice(0, 3)
                      .map((entry) => (
                        <span
                          key={entry.id}
                          className={`nexo-cal-dot ${
                            entry.kind === 'deal'
                              ? 'closing'
                              : entry.kind === 'task'
                                ? 'task'
                                : eventTypeClass(
                                    entry.event.type,
                                  )
                          }`}
                          title={entry.title}
                        >
                          {entry.title}
                        </span>
                      ))}

                    {dayEntries.length > 3 && (
                      <small>
                        +{dayEntries.length - 3} más
                      </small>
                    )}
                  </span>
                </button>
              ) : (
                <div
                  key={`blank-${index}`}
                  className="nexo-cal-cell blank"
                  aria-hidden="true"
                />
              );
            })}
          </div>

          <div className="nexo-cal-legend nexo-calendar-legend">
            <span>
              <i className="task" />
              Tarea
            </span>

            <span>
              <i className="closing" />
              Cierre previsto
            </span>

            <span>
              <i className="meeting" />
              Evento
            </span>
          </div>
        </section>

        <aside className="panel nexo-cal-agenda">
          <div className="nexo-cal-agenda-head">
            <span>
              <CalendarDays size={17} />
              Agenda del día
            </span>

            <h2>
              {new Intl.DateTimeFormat('es-AR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }).format(
                new Date(`${selectedDate}T12:00:00`),
              )}
            </h2>

            <label className="nexo-cal-switch">
              <input
                type="checkbox"
                checked={showClosings}
                onChange={(event) =>
                  setShowClosings(
                    event.target.checked,
                  )
                }
              />

              Mostrar cierres previstos
            </label>
          </div>

          {selectedEntries.length === 0 ? (
            <div className="nexo-cal-empty">
              <CalendarDays size={25} />

              <strong>
                Sin actividades para este día
              </strong>

              <p>
                Seleccioná otro día o creá un evento.
              </p>

              <button
                className="btn btn-primary"
                type="button"
                onClick={openNewEvent}
              >
                <Plus size={15} />
                Crear evento
              </button>
            </div>
          ) : (
            <div className="nexo-cal-agenda-list">
              {selectedEntries.map((entry) => {
                if (entry.kind === 'task') {
                  return (
                    <div
                      className="nexo-cal-agenda-item"
                      key={entry.id}
                    >
                      <button
                        className="nexo-extras-icon"
                        type="button"
                        onClick={() =>
                          toggleTask(entry.task.id)
                        }
                        aria-label={
                          entry.task.done
                            ? 'Reabrir tarea'
                            : 'Completar tarea'
                        }
                      >
                        {entry.task.done ? (
                          <CheckCircle2 size={19} />
                        ) : (
                          <Circle size={19} />
                        )}
                      </button>

                      <button
                        type="button"
                        className="nexo-cal-agenda-copy"
                        onClick={() =>
                          onEditTask(entry.task)
                        }
                      >
                        <strong
                          className={
                            entry.task.done
                              ? 'done'
                              : ''
                          }
                        >
                          {entry.title}
                        </strong>

                        <small>
                          Tarea · {entry.task.priority}
                          {' · '}
                          {entry.task.done
                            ? 'Completada'
                            : 'Pendiente'}
                        </small>
                      </button>
                    </div>
                  );
                }

                if (entry.kind === 'deal') {
                  return (
                    <button
                      type="button"
                      className="nexo-cal-agenda-item nexo-cal-agenda-deal"
                      key={entry.id}
                      onClick={() =>
                        onEditDeal(entry.deal)
                      }
                    >
                      <span className="nexo-cal-closing-dot" />

                      <span className="nexo-cal-agenda-copy">
                        <strong>{entry.title}</strong>

                        <small>
                          Cierre estimado · {entry.deal.owner}
                        </small>
                      </span>

                      <ArrowRight size={15} />
                    </button>
                  );
                }

                const calendarEvent = entry.event;

                const canManage = canManageEvent(
                  calendarEvent,
                );

                return (
                  <article
                    className="nexo-cal-agenda-item nexo-calendar-event-item"
                    key={entry.id}
                  >
                    <span
                      className={`nexo-calendar-event-mark ${eventTypeClass(calendarEvent.type)}`}
                    >
                      {calendarEvent.type === 'meeting' ? (
                        <Video size={16} />
                      ) : calendarEvent.type === 'call' ? (
                        <Clock3 size={16} />
                      ) : (
                        <CalendarDays size={16} />
                      )}
                    </span>

                    <div className="nexo-cal-agenda-copy">
                      <strong>{calendarEvent.title}</strong>

                      <small>
                        {EVENT_TYPE_LABELS[calendarEvent.type]}
                        {' · '}
                        {formatTimeRange(calendarEvent)}
                      </small>

                      {calendarEvent.location && (
                        <small className="nexo-calendar-location">
                          <MapPin size={11} />
                          {calendarEvent.location}
                        </small>
                      )}

                      {calendarEvent.description && (
                        <p className="nexo-calendar-description">
                          {calendarEvent.description}
                        </p>
                      )}
                    </div>

                    {canManage && (
                      <div className="nexo-calendar-event-actions">
                        <button
                          type="button"
                          className="nexo-extras-icon"
                          aria-label={`Editar ${calendarEvent.title}`}
                          title="Editar evento"
                          onClick={() =>
                            openEditEvent(calendarEvent)
                          }
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          type="button"
                          className="nexo-extras-icon danger"
                          aria-label={`Eliminar ${calendarEvent.title}`}
                          title="Eliminar evento"
                          onClick={() =>
                            void deleteEvent(calendarEvent)
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <p className="nexo-cal-footnote">
            Los eventos se comparten con los integrantes
            de la organización. Las tareas y los cierres
            previstos siguen vinculados a sus registros originales.
          </p>
        </aside>
      </div>

      {formOpen && (
        <div
          className="nexo-calendar-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForm();
            }
          }}
        >
          <section
            className="nexo-calendar-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nexo-calendar-form-title"
          >
            <header className="nexo-calendar-modal-header">
              <div>
                <span>CALENDARIO / EVENTOS</span>

                <h2 id="nexo-calendar-form-title">
                  {editingEvent
                    ? 'Editar evento'
                    : 'Nuevo evento'}
                </h2>
              </div>

              <button
                className="nexo-extras-icon"
                type="button"
                onClick={closeForm}
                aria-label="Cerrar formulario"
                disabled={saving}
              >
                <X size={18} />
              </button>
            </header>

            <form
              className="nexo-calendar-form"
              onSubmit={(event) =>
                void saveEvent(event)
              }
            >
              <label>
                Título del evento

                <input
                  autoFocus
                  required
                  minLength={2}
                  maxLength={120}
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Ej. Reunión con cliente"
                />
              </label>

              <div className="nexo-calendar-form-grid">
                <label>
                  Tipo de evento

                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        type: event.target.value as EventType,
                      }))
                    }
                  >
                    <option value="meeting">Reunión</option>
                    <option value="call">Llamada</option>
                    <option value="reminder">Recordatorio</option>
                    <option value="other">Otro evento</option>
                  </select>
                </label>

                <label>
                  Fecha

                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <label className="nexo-calendar-all-day">
                <input
                  type="checkbox"
                  checked={form.allDay}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      allDay: event.target.checked,
                    }))
                  }
                />

                Evento de todo el día
              </label>

              {!form.allDay && (
                <div className="nexo-calendar-form-grid">
                  <label>
                    Hora de inicio

                    <input
                      type="time"
                      required
                      value={form.startTime}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          startTime: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    Hora de finalización

                    <input
                      type="time"
                      required
                      value={form.endTime}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          endTime: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              )}

              <label>
                Ubicación

                <input
                  maxLength={180}
                  value={form.location}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                  placeholder="Dirección, oficina o enlace de reunión"
                />
              </label>

              <label>
                Descripción

                <textarea
                  rows={3}
                  maxLength={2000}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Detalles, temas a tratar o información adicional…"
                />
              </label>

              {formError && (
                <p
                  className="nexo-calendar-form-error"
                  role="alert"
                >
                  {formError}
                </p>
              )}

              <footer className="nexo-calendar-form-actions">
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={saving}
                >
                  <Save size={15} />

                  {saving
                    ? 'Guardando…'
                    : editingEvent
                      ? 'Guardar cambios'
                      : 'Crear evento'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
