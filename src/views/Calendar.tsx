
import { useMemo, useState } from 'react';

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Plus,
} from 'lucide-react';

import { PageHeading } from '../components/Shared';
import { useCRM } from '../lib/store';
import { fmtDate, toDateInput } from '../lib/utils';
import type { Deal, Task } from '../types';

import './workspace-extras.css';

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
    };

interface CalendarProps {
  onNewTask: () => void;
  onEditTask: (task: Task) => void;
  onEditDeal: (deal: Deal) => void;
}

const isoDay = (date: Date): string => toDateInput(date);

function monthCells(
  year: number,
  month: number,
): (string | null)[] {
  const first = new Date(year, month, 1);
  const mondayIndex = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();

  return [
    ...Array.from(
      { length: mondayIndex },
      () => null,
    ),
    ...Array.from(
      { length: days },
      (_, index) => isoDay(new Date(year, month, index + 1)),
    ),
  ];
}

export function Calendar({
  onNewTask,
  onEditTask,
  onEditDeal,
}: CalendarProps) {
  const [viewDate, setViewDate] = useState(() => new Date());

  const [selectedDate, setSelectedDate] = useState(
    () => isoDay(new Date()),
  );

  const [showClosings, setShowClosings] = useState(true);

  const { data, toggleTask } = useCRM();

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = isoDay(new Date());

  const cells = useMemo(
    () => monthCells(year, month),
    [year, month],
  );

  // Los eventos se construyen con tipos explícitos.
  // Así TypeScript distingue tareas de oportunidades.
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

    return [...tasks, ...deals];
  }, [data.tasks, data.deals, showClosings]);

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
  ].sort(
    (a, b) => a.kind.localeCompare(b.kind),
  );

  const pending = data.tasks.filter(
    (task) => !task.done,
  ).length;

  const overdueCount = data.tasks.filter(
    (task) =>
      !task.done &&
      task.dueDate &&
      task.dueDate < today,
  ).length;

  const shiftMonth = (amount: number) => {
    const next = new Date(year, month + amount, 1);

    setViewDate(next);
    setSelectedDate(isoDay(next));
  };

  return (
    <div className="nexo-extras">
      <PageHeading
        eyebrow="PRODUCTIVIDAD / CALENDARIO"
        title="Calendario"
        subtitle="Tus tareas y las fechas estimadas de cierre, reunidas en una vista."
        action={
          <button
            className="btn btn-primary"
            type="button"
            onClick={onNewTask}
          >
            <Plus size={16} />
            Nueva tarea
          </button>
        }
      />

      <div
        className="nexo-cal-summary"
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
          <strong>
            {data.deals.filter(
              (deal) =>
                deal.dueDate &&
                !['ganado', 'perdido'].includes(deal.stage),
            ).length}
          </strong>

          <span>Cierres previstos</span>
        </div>
      </div>

      <div className="nexo-cal-layout">
        <section
          className="panel nexo-cal-panel"
          aria-label="Calendario mensual"
        >
          <div className="nexo-cal-heading">
            <h2>
              {new Intl.DateTimeFormat('es-AR', {
                month: 'long',
                year: 'numeric',
              }).format(viewDate)}
            </h2>

            <div className="nexo-cal-actions">
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => {
                  const date = new Date();

                  setViewDate(date);
                  setSelectedDate(isoDay(date));
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
                    date === selectedDate ? 'selected' : ''
                  } ${
                    date === today ? 'today' : ''
                  }`}
                  aria-label={`${fmtDate(date)}, ${dayEntries.length} elementos`}
                  aria-pressed={date === selectedDate}
                  onClick={() => setSelectedDate(date)}
                >
                  <span className="nexo-cal-number">
                    {Number(date.slice(-2))}
                  </span>

                  <span className="nexo-cal-events">
                    {dayEntries.slice(0, 2).map((entry) => (
                      <span
                        key={entry.id}
                        className={`nexo-cal-dot ${
                          entry.kind === 'deal'
                            ? 'closing'
                            : 'task'
                        }`}
                      >
                        {entry.title}
                      </span>
                    ))}

                    {dayEntries.length > 2 && (
                      <small>
                        +{dayEntries.length - 2} más
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

          <div className="nexo-cal-legend">
            <span>
              <i className="task" />
              Tarea
            </span>

            <span>
              <i className="closing" />
              Cierre previsto
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
                  setShowClosings(event.target.checked)
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
                Seleccioná otro día o creá una tarea.
              </p>
            </div>
          ) : (
            <div className="nexo-cal-agenda-list">
              {selectedEntries.map((entry) =>
                entry.kind === 'task' ? (
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
                          entry.task.done ? 'done' : ''
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
                ) : (
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
                ),
              )}
            </div>
          )}

          <p className="nexo-cal-footnote">
            El calendario usa fechas de tareas y
            oportunidades. Las reuniones todavía
            no están sincronizadas con un proveedor externo.
          </p>
        </aside>
      </div>
    </div>
  );
}
