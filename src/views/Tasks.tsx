
import { useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCheck,
  CircleCheckBig,
  ClipboardCheck,
  Clock3,
  Plus,
  Search,
} from 'lucide-react';

import { useCRM } from '../lib/store';
import { Task } from '../types';
import { fmtDate, overdue, todayDue } from '../lib/utils';
import { Empty, PageHeading, Tag } from '../components/Shared';

export function Tasks({
  onAdd,
  onEdit,
}: {
  onAdd: () => void;
  onEdit: (item: Task) => void;
}) {
  const { data, toggleTask } = useCRM();

  const [filter, setFilter] = useState<
    'pendientes' | 'todas' | 'completadas'
  >('pendientes');

  const [search, setSearch] = useState('');

  const list = useMemo(
    () =>
      data.tasks
        .filter(
          (t) =>
            (filter === 'todas' ||
              (filter === 'completadas' ? t.done : !t.done)) &&
            `${t.title} ${t.description}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort(
          (a, b) =>
            Number(a.done) - Number(b.done) ||
            a.dueDate.localeCompare(b.dueDate),
        ),
    [data.tasks, filter, search],
  );

  const pending = data.tasks.filter((t) => !t.done).length;

  const late = data.tasks.filter(
    (t) => !t.done && overdue(t.dueDate),
  ).length;

  const completed = data.tasks.filter((t) => t.done).length;

  return (
    <>
      <PageHeading
        eyebrow="PRODUCTIVIDAD / SEGUIMIENTO"
        title="Tareas y seguimientos"
        subtitle="Lo más importante de un CRM: saber qué tenés que hacer después."
        action={
          <button className="btn btn-primary" onClick={onAdd}>
            <Plus size={16} />
            Nueva tarea
          </button>
        }
      />

      <div className="tasks-stat-grid">
        <div>
          <Clock3 size={19} />
          <strong>{pending}</strong>
          <span>Pendientes</span>
        </div>

        <div>
          <CalendarDays size={19} />
          <strong>{late}</strong>
          <span>Vencidas</span>
        </div>

        <div>
          <CheckCheck size={19} />
          <strong>{completed}</strong>
          <span>Completadas</span>
        </div>
      </div>

      <div className="panel full-panel">
        <div className="toolbar">
          <div className="search-field">
            <Search size={17} />

            <input
              placeholder="Buscar tareas..."
              aria-label="Buscar tareas"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="toolbar-right">
            <div className="tab-row">
              {(['pendientes', 'todas', 'completadas'] as const).map(
                (t) => (
                  <button
                    key={t}
                    className={filter === t ? 'active' : ''}
                    onClick={() => setFilter(t)}
                  >
                    {t === 'pendientes'
                      ? 'Pendientes'
                      : t === 'todas'
                        ? 'Todas'
                        : 'Completadas'}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        <div className="task-list">
          {list.map((t) => {
            const isLate = !t.done && overdue(t.dueDate);
            const isToday = !t.done && todayDue(t.dueDate);

            const deal = data.deals.find(
              (d) => d.id === t.dealId,
            );

            return (
              <div
                className={`task-row ${t.done ? 'task-done' : ''}`}
                key={t.id}
              >
                <label
                  className="task-check"
                  title={
                    t.done
                      ? 'Marcar pendiente'
                      : 'Completar tarea'
                  }
                >
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => toggleTask(t.id)}
                  />

                  <span className="check-control">
                    <CircleCheckBig size={18} />
                  </span>
                </label>

                <button
                  className="task-body"
                  onClick={() => onEdit(t)}
                >
                  <strong>{t.title}</strong>

                  <span>
                    {t.description || 'Sin descripción'}

                    {deal && (
                      <>
                        {' · '}
                        <b>{deal.title}</b>
                      </>
                    )}
                  </span>
                </button>

                <div className="task-row-right">
                  <Tag
                    tone={
                      t.priority === 'alta'
                        ? 'red'
                        : t.priority === 'media'
                          ? 'purple'
                          : 'neutral'
                    }
                  >
                    {t.priority === 'alta'
                      ? 'Alta'
                      : t.priority === 'media'
                        ? 'Media'
                        : 'Baja'}
                  </Tag>

                  <span
                    className={`task-date ${
                      isLate ? 'danger-text' : ''
                    } ${isToday ? 'today-text' : ''}`}
                  >
                    <CalendarDays size={14} />

                    {isLate
                      ? 'Vencida · '
                      : isToday
                        ? 'Hoy · '
                        : ''}

                    {fmtDate(t.dueDate)}
                  </span>

                  <button
                    className="icon-btn small"
                    title="Editar tarea"
                    onClick={() => onEdit(t)}
                  >
                    <ClipboardCheck size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {!list.length && (
          <Empty
            title="No hay tareas en esta vista"
            detail={
              filter === 'pendientes'
                ? '¡Excelente! No te quedan tareas pendientes.'
                : 'Cambiá el filtro o agregá una nueva tarea.'
            }
            onAction={onAdd}
            action="Crear tarea"
          />
        )}
      </div>
    </>
  );
}
