
import { useMemo, useState } from 'react';

import {
  Activity as ActivityIcon,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  GitBranch,
  Search,
  UserRound,
} from 'lucide-react';

import { useCRM } from '../lib/store';
import { csvDownload, fmtDateTime } from '../lib/utils';
import type { ActivityType } from '../types';
import { Empty, PageHeading } from '../components/Shared';

import './activity-focus.css';

type Category = 'all' | ActivityType;
type Period = 'all' | '7d' | '30d';
type Order = 'newest' | 'oldest';

const categoryOptions: {
  value: Category;
  label: string;
}[] = [
  { value: 'all', label: 'Todo' },
  { value: 'deal', label: 'Oportunidades' },
  { value: 'task', label: 'Tareas' },
  { value: 'contact', label: 'Contactos' },
  { value: 'company', label: 'Empresas' },
  { value: 'note', label: 'Notas' },
  { value: 'system', label: 'Sistema' },
];

const labels: Record<ActivityType, string> = {
  deal: 'Oportunidad',
  task: 'Tarea',
  contact: 'Contacto',
  company: 'Empresa',
  note: 'Nota',
  system: 'Sistema',
};

const icons: Record<ActivityType, typeof ActivityIcon> = {
  deal: GitBranch,
  task: CheckCircle2,
  contact: UserRound,
  company: Building2,
  note: FileText,
  system: BadgeCheck,
};

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR')
    .trim();

const PAGE_SIZE = 30;

export function Activity() {
  const { data, notify } = useCRM();

  const [type, setType] = useState<Category>('all');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [order, setOrder] = useState<Order>('newest');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const list = useMemo(() => {
    const query = normalize(search);
    const now = Date.now();

    const cutoff =
      period === '7d'
        ? now - 7 * 24 * 60 * 60 * 1000
        : period === '30d'
          ? now - 30 * 24 * 60 * 60 * 1000
          : null;

    return data.activities
      .filter((activity) => {
        if (
          type !== 'all' &&
          activity.type !== type
        ) {
          return false;
        }

        const timestamp = Date.parse(
          activity.createdAt,
        );

        if (
          cutoff !== null &&
          (!Number.isFinite(timestamp) ||
            timestamp < cutoff ||
            timestamp > now)
        ) {
          return false;
        }

        return normalize(
          `${activity.title} ${activity.detail}`,
        ).includes(query);
      })
      .sort((a, b) => {
        const dateA = Date.parse(a.createdAt) || 0;
        const dateB = Date.parse(b.createdAt) || 0;

        return order === 'newest'
          ? dateB - dateA
          : dateA - dateB;
      });
  }, [
    data.activities,
    type,
    search,
    period,
    order,
  ]);

  const shown = list.slice(0, visibleCount);

  const resetFilters = () => {
    setType('all');
    setSearch('');
    setPeriod('all');
    setOrder('newest');
    setVisibleCount(PAGE_SIZE);
  };

  const exportCsv = () => {
    csvDownload('nexo-actividad.csv', [
      [
        'Fecha',
        'Categoría',
        'Movimiento',
        'Detalle',
      ],
      ...list.map((activity) => [
        activity.createdAt,
        labels[activity.type],
        activity.title,
        activity.detail,
      ]),
    ]);

    notify('Actividad exportada a CSV');
  };

  return (
    <>
      <PageHeading
        eyebrow="TRAZABILIDAD / HISTORIAL"
        title="Actividad reciente"
        subtitle="Buscá y consultá los movimientos registrados en tu espacio de trabajo."
      />

      <div className="panel full-panel">
        {/* CATEGORÍAS */}

        <div className="toolbar activity-toolbar">
          <div
            className="tab-row activity-category-tabs"
            aria-label="Filtrar por categoría"
          >
            {categoryOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  type === option.value
                    ? 'active'
                    : ''
                }
                aria-pressed={
                  type === option.value
                }
                onClick={() => {
                  setType(option.value);
                  setVisibleCount(PAGE_SIZE);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <span className="muted activity-counter">
            <ActivityIcon size={15} />

            {list.length} movimiento
            {list.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* BÚSQUEDA Y FILTROS */}

        <div className="activity-filter-bar">
          <div className="search-field activity-search">
            <Search size={17} />

            <input
              type="search"
              aria-label="Buscar en el historial"
              placeholder="Buscar por título o detalle..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
            />
          </div>

          <div className="activity-filter-controls">
            <select
              className="select-filter"
              aria-label="Filtrar por período"
              value={period}
              onChange={(event) => {
                setPeriod(
                  event.target.value as Period,
                );
                setVisibleCount(PAGE_SIZE);
              }}
            >
              <option value="all">
                Todas las fechas
              </option>

              <option value="7d">
                Últimos 7 días
              </option>

              <option value="30d">
                Últimos 30 días
              </option>
            </select>

            <select
              className="select-filter"
              aria-label="Ordenar movimientos"
              value={order}
              onChange={(event) => {
                setOrder(
                  event.target.value as Order,
                );
                setVisibleCount(PAGE_SIZE);
              }}
            >
              <option value="newest">
                Más recientes
              </option>

              <option value="oldest">
                Más antiguos
              </option>
            </select>

            <button
              type="button"
              className="btn btn-outline"
              onClick={exportCsv}
            >
              <Download size={15} />
              CSV
            </button>
          </div>
        </div>

        {/* HISTORIAL */}

        <div className="timeline activity-timeline">
          {shown.map((activity) => {
            const Icon = icons[activity.type];

            return (
              <div
                className="timeline-item"
                key={activity.id}
              >
                <div
                  className={`timeline-icon timeline-${activity.type}`}
                >
                  <Icon size={17} />
                </div>

                <div className="activity-entry">
                  <span className="activity-entry-type">
                    {labels[activity.type]}
                  </span>

                  <strong>
                    {activity.title}
                  </strong>

                  <p>
                    {activity.detail ||
                      'Sin detalles adicionales.'}
                  </p>

                  <small>
                    <Clock3 size={12} />
                    {fmtDateTime(
                      activity.createdAt,
                    )}
                  </small>
                </div>
              </div>
            );
          })}
        </div>

        {/* SIN RESULTADOS */}

        {!list.length && (
          <div className="activity-empty">
            <Empty
              title="No hay movimientos para mostrar"
              detail="Probá otra búsqueda, categoría o período."
            />

            <button
              type="button"
              className="btn btn-outline"
              onClick={resetFilters}
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {/* MOSTRAR MÁS */}

        {shown.length < list.length && (
          <div className="activity-more">
            <span>
              Mostrando {shown.length} de{' '}
              {list.length} movimientos
            </span>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() =>
                setVisibleCount(
                  (count) => count + PAGE_SIZE,
                )
              }
            >
              Mostrar más
            </button>
          </div>
        )}
      </div>

      <div className="hint-row activity-hint">
        <ActivityIcon size={15} />

        Esta demo conserva hasta 150 movimientos
        recientes. Algunos eventos históricos
        incluyen solo una descripción breve;
        el registro no es una auditoría
        completa de cambios.
      </div>
    </>
  );
}
