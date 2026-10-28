
import { useMemo, useState } from 'react';
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
} from 'lucide-react';

import { PageHeading } from '../components/Shared';
import { useCRM } from '../lib/store';
import { csvDownload, toDateInput } from '../lib/utils';
import type { Activity as CRMActivity, ActivityType } from '../types';

import './task-history-refresh.css';

type Category = 'all' | 'sales' | 'tasks' | 'clients' | 'system' | 'notes';
type Period = 'all' | '7d' | '30d';

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'sales', label: 'Negocios' },
  { value: 'tasks', label: 'Tareas' },
  { value: 'clients', label: 'Clientes y contactos' },
  { value: 'system', label: 'Sistema' },
  { value: 'notes', label: 'Notas' },
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
    case 'Nuevo registro': return `Se creó ${ENTITY_NAMES[event.type]}`;
    case 'Registro actualizado': return `Se actualizó ${ENTITY_NAMES[event.type]}`;
    case 'Registro eliminado': return `Se eliminó ${ENTITY_NAMES[event.type]}`;
    case 'Etapa actualizada': return 'Se cambió la etapa de una oportunidad';
    case 'Venta ganada': return 'Se ganó una oportunidad';
    case 'Oportunidad perdida': return 'Se perdió una oportunidad';
    case 'Tarea completada': return 'Se completó una tarea';
    case 'Tarea reabierta': return 'Se reabrió una tarea';
    default: return event.title;
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
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function dayInfo(value: string, today: string, yesterday: string): { key: string; label: string } {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return { key: 'unknown', label: 'Sin fecha registrada' };
  const key = toDateInput(parsed);
  if (key === today) return { key, label: 'Hoy' };
  if (key === yesterday) return { key, label: 'Ayer' };
  return {
    key,
    label: new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parsed),
  };
}

const PAGE_SIZE = 30;

export function Activity() {
  const { data, notify } = useCRM();
  const [category, setCategory] = useState<Category>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const today = toDateInput(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = toDateInput(yesterdayDate);

  const list = useMemo(() => {
    const query = clean(search);
    const now = Date.now();
    const cutoff = period === '7d'
      ? now - 7 * 24 * 60 * 60 * 1000
      : period === '30d'
        ? now - 30 * 24 * 60 * 60 * 1000
        : null;

    return data.activities
      .filter((event) => {
        if (!matchesCategory(event.type, category)) return false;
        const stamp = Date.parse(event.createdAt);
        if (cutoff !== null && (!Number.isFinite(stamp) || stamp < cutoff || stamp > now)) return false;
        return clean([event.title, eventTitle(event), event.detail, TYPE_LABELS[event.type]].join(' ')).includes(query);
      })
      .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  }, [data.activities, category, period, search]);

  const shown = list.slice(0, visibleCount);
  const days = useMemo(() => {
    const groups: { key: string; label: string; entries: CRMActivity[] }[] = [];
    for (const entry of shown) {
      const { key, label } = dayInfo(entry.createdAt, today, yesterday);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.entries.push(entry);
      else groups.push({ key, label, entries: [entry] });
    }
    return groups;
  }, [shown, today, yesterday]);

  const setCategoryAndReset = (next: Category) => {
    setCategory(next);
    setVisibleCount(PAGE_SIZE);
  };

  const exportCsv = () => {
    csvDownload('nexo-historial.csv', [
      ['Fecha', 'Tipo', 'Movimiento', 'Detalle'],
      ...list.map((event) => [event.createdAt, TYPE_LABELS[event.type], eventTitle(event), event.detail]),
    ]);
    notify('Historial exportado a CSV.');
  };

  const clearFilters = () => {
    setCategory('all');
    setPeriod('all');
    setSearch('');
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="nexo-simple-page">
      <PageHeading
        eyebrow="SEGUIMIENTO / HISTORIAL"
        title="Historial"
        subtitle="Un registro de lo que pasó en NEXO, ordenado del movimiento más reciente al más antiguo."
      />

      <section className="nexo-history-intro" aria-label="Qué muestra el historial">
        <ActivityIcon size={20} />
        <div>
          <strong>¿Para qué sirve esta sección?</strong>
          <p>Acá podés consultar qué se creó, modificó, completó o eliminó. No son tareas pendientes: son acciones que ya ocurrieron.</p>
        </div>
      </section>

      <section className="panel nexo-simple-panel">
        <div className="nexo-history-categories" aria-label="Tipos de movimientos">
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

        <div className="nexo-simple-toolbar">
          <label className="nexo-simple-search">
            <Search size={16} />
            <input
              type="search"
              value={search}
              aria-label="Buscar en el historial"
              placeholder="Buscar un cliente, negocio o movimiento..."
              onChange={(event) => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }}
            />
          </label>
          <div className="nexo-simple-actions">
            <label className="nexo-simple-select">
              <SlidersHorizontal size={15} />
              <select
                aria-label="Filtrar por período"
                value={period}
                onChange={(event) => { setPeriod(event.target.value as Period); setVisibleCount(PAGE_SIZE); }}
              >
                <option value="all">Todas las fechas</option>
                <option value="7d">Últimos 7 días</option>
                <option value="30d">Últimos 30 días</option>
              </select>
            </label>
            <button type="button" className="btn btn-outline" onClick={exportCsv}>
              <Download size={15} /> Exportar CSV
            </button>
          </div>
        </div>

        <div className="nexo-simple-result-count" role="status">
          <CalendarDays size={14} /> {list.length} movimiento{list.length === 1 ? '' : 's'} encontrados
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
                      ? parsed.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                      : 'Hora no disponible';
                    return (
                      <article className="nexo-history-entry" key={event.id}>
                        <span className={`nexo-history-icon type-${event.type}`}><Icon size={17} /></span>
                        <div className="nexo-history-entry-content">
                          <div className="nexo-history-entry-top">
                            <strong>{eventTitle(event)}</strong>
                            <time dateTime={event.createdAt}><Clock3 size={12} /> {time}</time>
                          </div>
                          {event.detail && <p>{event.detail}</p>}
                          <span className="nexo-history-kind">{TYPE_LABELS[event.type]}</span>
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
            <p>Podés cambiar el período o elegir otro tipo de movimiento.</p>
            <button type="button" className="btn btn-outline" onClick={clearFilters}>Ver todo el historial</button>
          </div>
        )}

        {shown.length < list.length && (
          <div className="nexo-history-more">
            <span>Mostrando {shown.length} de {list.length}</span>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
            >
              Mostrar más
            </button>
          </div>
        )}
      </section>

      <p className="nexo-simple-footnote">
        <ActivityIcon size={15} /> Esta demo conserva como máximo los últimos 150 movimientos.
        No registra aún qué usuario realizó cada cambio ni representa una auditoría de seguridad completa.
      </p>
    </div>
  );
}
