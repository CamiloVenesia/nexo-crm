
import { useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

import { Empty, PageHeading, Tag } from '../components/Shared';
import { useCRM } from '../lib/store';
import { csvDownload, fmtDate, toDateInput } from '../lib/utils';
import type { Task } from '../types';

import './task-history-refresh.css';

type TaskGroup = 'vencidas' | 'hoy' | 'proximas' | 'sin-fecha' | 'completadas';
type View = 'pendientes' | TaskGroup;
type Priority = 'todas' | Task['priority'];

type GroupConfig = {
  id: TaskGroup;
  title: string;
  explanation: string;
};

const GROUPS: GroupConfig[] = [
  { id: 'vencidas', title: 'Vencidas', explanation: 'Requieren atención primero' },
  { id: 'hoy', title: 'Para hoy', explanation: 'Lo que toca resolver ahora' },
  { id: 'proximas', title: 'Próximas', explanation: 'Compromisos de los siguientes días' },
  { id: 'sin-fecha', title: 'Sin fecha', explanation: 'Pendientes de planificación' },
  { id: 'completadas', title: 'Completadas', explanation: 'Tareas que ya resolviste' },
];

const PRIORITY_ORDER: Record<Task['priority'], number> = {
  alta: 0,
  media: 1,
  baja: 2,
};

const clean = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function groupOf(task: Task, today: string): TaskGroup {
  if (task.done) return 'completadas';
  if (!task.dueDate) return 'sin-fecha';
  if (task.dueDate < today) return 'vencidas';
  if (task.dueDate === today) return 'hoy';
  return 'proximas';
}

function byDateAndPriority(a: Task, b: Task): number {
  const dates = (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
  return dates || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.title.localeCompare(b.title, 'es-AR');
}

interface TasksProps {
  onAdd: () => void;
  onEdit: (task: Task) => void;
}

export function Tasks({ onAdd, onEdit }: TasksProps) {
  const { data, toggleTask, notify } = useCRM();
  const [view, setView] = useState<View>('pendientes');
  const [priority, setPriority] = useState<Priority>('todas');
  const [search, setSearch] = useState('');
  const today = toDateInput(new Date());

  const counts = useMemo(() => {
    const summary: Record<TaskGroup, number> = {
      vencidas: 0,
      hoy: 0,
      proximas: 0,
      'sin-fecha': 0,
      completadas: 0,
    };

    for (const task of data.tasks) summary[groupOf(task, today)]++;
    return summary;
  }, [data.tasks, today]);

  const pending = data.tasks.length - counts.completadas;
  const attention = counts.vencidas + counts.hoy;

  const matching = useMemo(() => {
    const query = clean(search);

    return data.tasks.filter((task) => {
      if (priority !== 'todas' && task.priority !== priority) return false;

      const group = groupOf(task, today);
      if (view === 'pendientes' && group === 'completadas') return false;
      if (view !== 'pendientes' && group !== view) return false;

      if (!query) return true;

      const deal = data.deals.find((item) => item.id === task.dealId);
      const company = data.companies.find((item) => item.id === deal?.companyId);
      const searchable = clean([
        task.title,
        task.description,
        deal?.title ?? '',
        company?.name ?? '',
        deal?.owner ?? '',
      ].join(' '));
      return searchable.includes(query);
    });
  }, [data.tasks, data.deals, data.companies, priority, view, search, today]);

  const groups = useMemo(
    () => GROUPS
      .filter((group) => view === 'pendientes' ? group.id !== 'completadas' : group.id === view)
      .map((group) => ({
        ...group,
        tasks: matching.filter((task) => groupOf(task, today) === group.id).sort(byDateAndPriority),
      }))
      .filter((group) => group.tasks.length > 0),
    [matching, view, today],
  );

  const exportCsv = () => {
    csvDownload('nexo-tareas.csv', [
      ['Tarea', 'Descripción', 'Prioridad', 'Estado', 'Vencimiento', 'Oportunidad', 'Cliente'],
      ...matching.map((task) => {
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
    notify('Lista de tareas exportada a CSV.');
  };

  const resetFilters = () => {
    setView('pendientes');
    setPriority('todas');
    setSearch('');
  };

  return (
    <div className="nexo-simple-page">
      <PageHeading
        eyebrow="PRODUCTIVIDAD / TAREAS"
        title="Tareas"
        subtitle="Primero lo urgente. Marcá lo que resolviste y organizá lo que sigue."
        action={
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            <Plus size={16} /> Nueva tarea
          </button>
        }
      />

      <section className="nexo-task-overview" aria-label="Situación de tus tareas">
        <div className="nexo-task-overview-icon"><CalendarDays size={21} /></div>
        <div>
          <span className="nexo-simple-eyebrow">TU AGENDA DE TRABAJO</span>
          <h2>{attention > 0 ? `${attention} tarea${attention === 1 ? '' : 's'} requiere${attention === 1 ? '' : 'n'} atención` : 'No tenés tareas urgentes'}</h2>
          <p>{counts.vencidas} vencidas · {counts.hoy} para hoy · {pending} pendientes en total</p>
        </div>
      </section>

      <section className="nexo-task-navigation" aria-label="Mostrar tareas por estado">
        {([
          ['pendientes', 'Pendientes', pending],
          ['vencidas', 'Vencidas', counts.vencidas],
          ['hoy', 'Hoy', counts.hoy],
          ['proximas', 'Próximas', counts.proximas],
          ['sin-fecha', 'Sin fecha', counts['sin-fecha']],
          ['completadas', 'Completadas', counts.completadas],
        ] as const).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            className={`nexo-task-tab ${view === id ? 'selected' : ''} ${id === 'vencidas' && count > 0 ? 'nexo-task-tab-alert' : ''}`}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {label}<span>{count}</span>
          </button>
        ))}
      </section>

      <section className="panel nexo-simple-panel">
        <div className="nexo-simple-toolbar">
          <label className="nexo-simple-search">
            <Search size={16} />
            <input
              type="search"
              value={search}
              aria-label="Buscar tareas"
              placeholder="Buscar tarea, cliente o negocio..."
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="nexo-simple-actions">
            <label className="nexo-simple-select">
              <SlidersHorizontal size={15} />
              <select
                aria-label="Filtrar prioridad"
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
              >
                <option value="todas">Todas las prioridades</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </label>
            <button type="button" className="btn btn-outline" onClick={exportCsv}>
              <Download size={15} /> Exportar CSV
            </button>
          </div>
        </div>

        <div className="nexo-simple-result-count" role="status">
          Mostrando {matching.length} tarea{matching.length === 1 ? '' : 's'}
          {view === 'completadas' ? ' completadas' : ' según tu selección'}
        </div>

        {groups.length > 0 ? (
          <div className="nexo-task-groups">
            {groups.map((group) => (
              <section className="nexo-task-group" key={group.id} aria-label={group.title}>
                <header className="nexo-task-group-heading">
                  <div>
                    <h2>{group.title}<span>{group.tasks.length}</span></h2>
                    <p>{group.explanation}</p>
                  </div>
                </header>

                {group.tasks.map((task) => {
                  const deal = data.deals.find((item) => item.id === task.dealId);
                  const company = data.companies.find((item) => item.id === deal?.companyId);
                  return (
                    <div className={`nexo-task-item ${task.done ? 'is-done' : ''}`} key={task.id}>
                      <label className="nexo-task-complete" title={task.done ? 'Reabrir tarea' : 'Completar tarea'}>
                        <input
                          type="checkbox"
                          checked={task.done}
                          aria-label={`${task.done ? 'Reabrir' : 'Completar'} tarea: ${task.title}`}
                          onChange={() => toggleTask(task.id)}
                        />
                        <CheckCircle2 size={20} aria-hidden="true" />
                      </label>
                      <button type="button" className="nexo-task-info" onClick={() => onEdit(task)}>
                        <strong>{task.title}</strong>
                        <small>
                          {company?.name || deal?.title || 'Tarea general'}
                          {company && deal ? ` · ${deal.title}` : ''}
                        </small>
                        {task.description && <span>{task.description}</span>}
                      </button>
                      <div className="nexo-task-meta">
                        <Tag tone={task.priority === 'alta' ? 'red' : task.priority === 'media' ? 'purple' : 'neutral'}>
                          {task.priority === 'alta' ? 'Alta' : task.priority === 'media' ? 'Media' : 'Baja'}
                        </Tag>
                        <span className={`nexo-task-due ${group.id === 'vencidas' ? 'late' : ''}`}>
                          <Clock3 size={13} />
                          {task.dueDate ? fmtDate(task.dueDate) : 'Sin fecha'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        ) : (
          <div className="nexo-simple-empty">
            {data.tasks.length === 0 ? (
              <Empty
                title="Todavía no hay tareas"
                detail="Creá tu primera tarea para empezar a organizar el trabajo."
                onAction={onAdd}
                action="Crear tarea"
              />
            ) : (
              <>
                <CheckCircle2 size={26} />
                <strong>No hay tareas en esta vista</strong>
                <p>Probá otro estado, prioridad o búsqueda.</p>
                <button type="button" className="btn btn-outline" onClick={resetFilters}>Ver mis pendientes</button>
              </>
            )}
          </div>
        )}
      </section>

      <p className="nexo-simple-footnote">
        <CheckCircle2 size={15} /> Marcá una tarea para completarla. Tocá su nombre para editarla.
        Las tareas se relacionan con un negocio solo cuando les asignás una oportunidad.
      </p>
    </div>
  );
}
