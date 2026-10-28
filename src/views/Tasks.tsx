
import { useMemo, useState } from 'react';

import {
  CalendarDays,
  CheckCheck,
  CircleCheckBig,
  ClipboardCheck,
  Clock3,
  Download,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

import { useCRM } from '../lib/store';
import type { Task } from '../types';
import {
  csvDownload,
  fmtDate,
  overdue,
  todayDue,
  toDateInput,
} from '../lib/utils';
import { Empty, PageHeading, Tag } from '../components/Shared';

import './tasks-focus.css';

type StatusFilter = 'pendientes' | 'todas' | 'completadas';
type DateFilter = 'todas' | 'vencidas' | 'hoy' | 'proximas';
type PriorityFilter = 'todas' | Task['priority'];

const priorityOrder: Record<Task['priority'], number> = {
  alta: 0,
  media: 1,
  baja: 2,
};

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR')
    .trim();
}

interface TasksProps {
  onAdd: () => void;
  onEdit: (item: Task) => void;
}

export function Tasks({ onAdd, onEdit }: TasksProps) {
  const { data, toggleTask, notify } = useCRM();

  const [status, setStatus] = useState<StatusFilter>('pendientes');
  const [dateFilter, setDateFilter] = useState<DateFilter>('todas');
  const [priority, setPriority] = useState<PriorityFilter>('todas');
  const [search, setSearch] = useState('');

  const today = toDateInput(new Date());

  const pending = data.tasks.filter((task) => !task.done).length;
  const late = data.tasks.filter(
    (task) => !task.done && Boolean(task.dueDate) && task.dueDate < today,
  ).length;
  const dueToday = data.tasks.filter(
    (task) => !task.done && task.dueDate === today,
  ).length;
  const upcoming = data.tasks.filter(
    (task) => !task.done && Boolean(task.dueDate) && task.dueDate > today,
  ).length;
  const completed = data.tasks.length - pending;
  const statusCount = status === 'completadas'
    ? completed
    : status === 'todas'
      ? data.tasks.length
      : pending;

  const list = useMemo(() => {
    const query = normalize(search);

    return data.tasks
      .filter((task) => {
        if (status === 'pendientes' && task.done) return false;
        if (status === 'completadas' && !task.done) return false;
        if (priority !== 'todas' && task.priority !== priority) return false;

        if (dateFilter !== 'todas') {
          // Los filtros de vencimiento se refieren a tareas pendientes.
          if (task.done || !task.dueDate) return false;
          if (dateFilter === 'vencidas' && task.dueDate >= today) return false;
          if (dateFilter === 'hoy' && task.dueDate !== today) return false;
          if (dateFilter === 'proximas' && task.dueDate <= today) return false;
        }

        const deal = data.deals.find((item) => item.id === task.dealId);
        const company = data.companies.find((item) => item.id === deal?.companyId);
        const text = normalize(
          [task.title, task.description, deal?.title ?? '', company?.name ?? '', deal?.owner ?? ''].join(' '),
        );

        return text.includes(query);
      })
      .sort((a, b) => {
        if (a.done !== b.done) return Number(a.done) - Number(b.done);

        // Sin fecha siempre al final, sin alterar los datos originales.
        const aDate = a.dueDate || '9999-12-31';
        const bDate = b.dueDate || '9999-12-31';
        const byDate = aDate.localeCompare(bDate);
        if (byDate !== 0) return byDate;

        const byPriority = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (byPriority !== 0) return byPriority;

        return a.title.localeCompare(b.title, 'es-AR');
      });
  }, [data.tasks, data.deals, data.companies, search, status, dateFilter, priority, today]);

  const setUrgencyFilter = (next: DateFilter) => {
    setDateFilter(next);
    if (next !== 'todas') setStatus('pendientes');
  };

  const exportCsv = () => {
    csvDownload('nexo-tareas.csv', [
      ['Tarea', 'Descripción', 'Prioridad', 'Estado', 'Vencimiento', 'Oportunidad', 'Empresa'],
      ...list.map((task) => {
        const deal = data.deals.find((item) => item.id === task.dealId);
        const company = data.companies.find((item) => item.id === deal?.companyId);
        return [
          task.title,
          task.description,
          task.priority,
          task.done ? 'Completada' : 'Pendiente',
          task.dueDate,
          deal?.title ?? '',
          company?.name ?? '',
        ];
      }),
    ]);
    notify('Tareas exportadas a CSV');
  };

  return (
    <>
      <PageHeading
        eyebrow="PRODUCTIVIDAD / SEGUIMIENTO"
        title="Tareas y seguimientos"
        subtitle="Lo más importante de un CRM: saber qué tenés que hacer después."
        action={
          <button type="button" className="btn btn-primary" onClick={onAdd}>
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
              placeholder="Buscar tarea, oportunidad o empresa..."
              aria-label="Buscar tareas"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="toolbar-right tasks-toolbar-right">
            <div className="tab-row" aria-label="Estado de las tareas">
              {(['pendientes', 'todas', 'completadas'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={status === item ? 'active' : ''}
                  aria-pressed={status === item}
                  onClick={() => {
                    setStatus(item);
                    if (item === 'completadas') setDateFilter('todas');
                  }}
                >
                  {item === 'pendientes'
                    ? 'Pendientes'
                    : item === 'todas'
                      ? 'Todas'
                      : 'Completadas'}
                </button>
              ))}
            </div>

            <label className="tasks-priority-select">
              <SlidersHorizontal size={14} />
              <select
                className="select-filter"
                aria-label="Filtrar por prioridad"
                value={priority}
                onChange={(event) => setPriority(event.target.value as PriorityFilter)}
              >
                <option value="todas">Todas las prioridades</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </label>

            <button type="button" className="btn btn-outline" onClick={exportCsv}>
              <Download size={15} />
              CSV
            </button>
          </div>
        </div>

        <div className="tasks-date-filters" aria-label="Filtrar por vencimiento">
          <span className="tasks-filter-label">VENCIMIENTO</span>
          {([
            ['todas', 'Sin filtro', statusCount],
            ['vencidas', 'Vencidas', late],
            ['hoy', 'Para hoy', dueToday],
            ['proximas', 'Próximas', upcoming],
          ] as const).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              className={`tasks-filter-button ${dateFilter === id ? 'active' : ''} ${id === 'vencidas' && count > 0 ? 'urgent' : ''}`}
              aria-pressed={dateFilter === id}
              onClick={() => setUrgencyFilter(id)}
            >
              {label} <span>{count}</span>
            </button>
          ))}
        </div>

        <div className="task-list">
          {list.map((task) => {
            const isLate = !task.done && overdue(task.dueDate);
            const isToday = !task.done && todayDue(task.dueDate);
            const deal = data.deals.find((item) => item.id === task.dealId);
            const company = data.companies.find((item) => item.id === deal?.companyId);

            return (
              <div
                className={`task-row ${task.done ? 'task-done' : ''} ${isLate ? 'tasks-row-late' : ''}`}
                key={task.id}
              >
                <label
                  className="task-check"
                  title={task.done ? 'Marcar pendiente' : 'Completar tarea'}
                >
                  <input
                    type="checkbox"
                    aria-label={`${task.done ? 'Reabrir' : 'Completar'} tarea: ${task.title}`}
                    checked={task.done}
                    onChange={() => toggleTask(task.id)}
                  />
                  <span className="check-control">
                    <CircleCheckBig size={18} />
                  </span>
                </label>

                <button type="button" className="task-body" onClick={() => onEdit(task)}>
                  <strong>{task.title}</strong>
                  <span>{task.description || 'Sin descripción'}</span>
                  {deal && (
                    <span className="tasks-related-deal">
                      Oportunidad: <b>{deal.title}</b>
                      {company && <> · {company.name}</>}
                    </span>
                  )}
                </button>

                <div className="task-row-right">
                  <Tag tone={task.priority === 'alta' ? 'red' : task.priority === 'media' ? 'purple' : 'neutral'}>
                    {task.priority === 'alta' ? 'Alta' : task.priority === 'media' ? 'Media' : 'Baja'}
                  </Tag>

                  <span className={`task-date ${isLate ? 'danger-text' : ''} ${isToday ? 'today-text' : ''}`}>
                    <CalendarDays size={14} />
                    {isLate ? 'Vencida · ' : isToday ? 'Hoy · ' : ''}
                    {fmtDate(task.dueDate)}
                  </span>

                  <button
                    type="button"
                    className="icon-btn small"
                    title={`Editar ${task.title}`}
                    aria-label={`Editar tarea ${task.title}`}
                    onClick={() => onEdit(task)}
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
            title="No hay tareas para este filtro"
            detail="Probá otra búsqueda, prioridad o vencimiento, o creá una tarea nueva."
            onAction={onAdd}
            action="Crear tarea"
          />
        )}
      </div>

      <div className="hint-row tasks-hint">
        <CalendarDays size={15} />
        Las tareas se ordenan por fecha de vencimiento y, en la misma fecha, por prioridad.
        Las tareas sin fecha aparecen al final.
      </div>
    </>
  );
}
