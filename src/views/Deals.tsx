
import { useMemo, useState } from 'react';

import {
  ArrowRight,
  Download,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

import { useCRM } from '../lib/store';

import {
  filterDeals,
  getDealFocusCounts,
  getDealFollowUp,
} from '../lib/dealFocus';

import type {
  DealFocusFilter,
} from '../lib/dealFocus';

import {
  csvDownload,
  fmtDate,
  money,
  openDeals,
  overdue,
  pipelineValue,
  toDateInput,
} from '../lib/utils';

import type { Deal } from '../types';
import { STAGES } from '../types';

import {
  DealCard,
  Empty,
  PageHeading,
  StageBadge,
} from '../components/Shared';

interface DealsProps {
  onAdd: () => void;
  onEdit: (item: Deal) => void;
}

export function Deals({
  onAdd,
  onEdit,
}: DealsProps) {
  const {
    data,
    changeStage,
    notify,
  } = useCRM();

  // ============================================
  // VISTA Y FILTROS
  // ============================================

  const [view, setView] = useState<
    'board' | 'table'
  >('board');

  const [search, setSearch] = useState('');

  const [showClosed, setShowClosed] =
    useState(false);

  const [focus, setFocus] =
    useState<DealFocusFilter>('todos');

  const today = toDateInput(new Date());

  // ============================================
  // OPORTUNIDADES FILTRADAS
  // ============================================

  const deals = useMemo(
    () =>
      filterDeals(
        data,
        {
          search,
          showClosed,
          focus,
        },
        today,
      ),
    [
      data,
      search,
      showClosed,
      focus,
      today,
    ],
  );

  const counts = useMemo(
    () => getDealFocusCounts(data, today),
    [data, today],
  );

  const active = openDeals(data.deals);

  const wonCount = data.deals.filter(
    (deal) => deal.stage === 'ganado',
  ).length;

  // ============================================
  // DESCRIPCIÓN DEL PRÓXIMO SEGUIMIENTO
  // ============================================

  const describeFollowUp = (deal: Deal) => {
    const result = getDealFollowUp(
      deal,
      data.tasks,
      today,
    );

    switch (result.state) {
      case 'closed':
        return {
          title: 'Cerrada',
          detail: '—',
        };

      case 'missing':
        return {
          title: 'Sin tarea pendiente',
          detail: 'Programá un seguimiento',
        };

      case 'undated':
        return {
          title: result.task.title,
          detail: 'Sin fecha',
        };

      case 'overdue':
        return {
          title: result.task.title,
          detail: `Vencida · ${fmtDate(
            result.task.dueDate,
          )}`,
        };

      case 'today':
        return {
          title: result.task.title,
          detail: 'Para hoy',
        };

      case 'upcoming':
        return {
          title: result.task.title,
          detail: fmtDate(result.task.dueDate),
        };
    }
  };

  // ============================================
  // EXPORTACIÓN CSV
  // ============================================

  const exportRows = () => {
    csvDownload('nexo-oportunidades.csv', [
      [
        'Oportunidad',
        'Empresa',
        'Contacto',
        'Importe',
        'Moneda',
        'Etapa',
        'Probabilidad',
        'Responsable',
        'Cierre estimado',
        'Próxima tarea',
        'Estado del seguimiento',
      ],

      ...deals.map((deal) => {
        const next = describeFollowUp(deal);

        return [
          deal.title,

          data.companies.find(
            (company) =>
              company.id === deal.companyId,
          )?.name ?? '',

          data.contacts.find(
            (contact) =>
              contact.id === deal.contactId,
          )?.name ?? '',

          deal.amount,
          data.settings.currency,

          STAGES.find(
            (stage) =>
              stage.id === deal.stage,
          )?.label ?? deal.stage,

          deal.probability,
          deal.owner,
          deal.dueDate,

          next.title,
          next.detail,
        ];
      }),
    ]);

    notify(
      'Oportunidades filtradas exportadas a CSV',
    );
  };

  // ============================================
  // INTERFAZ
  // ============================================

  return (
    <>
      <PageHeading
        eyebrow="VENTAS / OPORTUNIDADES"
        title="Pipeline de ventas"
        subtitle="Visualizá cada negociación y mantené el impulso comercial."
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAdd}
          >
            <Plus size={16} />
            Nueva oportunidad
          </button>
        }
      />

      {/* ======================================
          INDICADORES
      ====================================== */}

      <div className="mini-metrics">
        <div>
          <span>En curso</span>

          <strong>{active.length}</strong>
        </div>

        <div>
          <span>Valor abierto</span>

          <strong>
            {money(
              pipelineValue(data.deals),
              data.settings.currency,
              true,
            )}
          </strong>
        </div>

        <div>
          <span>Ganadas</span>

          <strong>{wonCount}</strong>
        </div>

        <div>
          <span>Sin próxima tarea</span>

          <strong>
            {counts.withoutFollowUp}
          </strong>
        </div>
      </div>

      {/* ======================================
          PIPELINE
      ====================================== */}

      <div className="panel full-panel">
        {/* BARRA DE HERRAMIENTAS */}

        <div className="toolbar">
          <div className="search-field">
            <Search size={17} />

            <input
              aria-label="Buscar oportunidades"
              placeholder="Buscar oportunidad, empresa o contacto..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

            {search && (
              <button
                type="button"
                title="Limpiar búsqueda"
                aria-label="Limpiar búsqueda"
                onClick={() => setSearch('')}
              >
                ×
              </button>
            )}
          </div>

          <div className="toolbar-right">
            {/* FILTROS DE SEGUIMIENTO */}

            <select
              className="select-filter"
              aria-label="Filtrar por seguimiento"
              value={focus}
              onChange={(event) =>
                setFocus(
                  event.target
                    .value as DealFocusFilter,
                )
              }
            >
              <option value="todos">
                Todos los seguimientos
              </option>

              <option value="seguimiento-vencido">
                Tareas vencidas (
                {counts.overdueFollowUps})
              </option>

              <option value="seguimiento-hoy">
                Tareas para hoy (
                {counts.todayFollowUps})
              </option>

              <option value="sin-seguimiento">
                Sin próxima tarea (
                {counts.withoutFollowUp})
              </option>

              <option value="cierre-vencido">
                Cierres vencidos (
                {counts.overdueClosings})
              </option>
            </select>

            {/* MOSTRAR CERRADAS */}

            <label className="switch-label">
              <input
                type="checkbox"
                checked={showClosed}
                onChange={(event) =>
                  setShowClosed(
                    event.target.checked,
                  )
                }
              />

              <span>Mostrar cerradas</span>
            </label>

            {/* VISTAS */}

            <div className="segmented">
              <button
                type="button"
                className={
                  view === 'board'
                    ? 'active'
                    : ''
                }
                title="Vista tablero"
                aria-label="Vista tablero"
                aria-pressed={
                  view === 'board'
                }
                onClick={() =>
                  setView('board')
                }
              >
                <LayoutGrid size={16} />
              </button>

              <button
                type="button"
                className={
                  view === 'table'
                    ? 'active'
                    : ''
                }
                title="Vista lista"
                aria-label="Vista lista"
                aria-pressed={
                  view === 'table'
                }
                onClick={() =>
                  setView('table')
                }
              >
                <List size={16} />
              </button>
            </div>

            {/* EXPORTAR */}

            <button
              type="button"
              className="btn btn-outline"
              onClick={exportRows}
            >
              <Download size={15} />
              CSV
            </button>
          </div>
        </div>

        {/* ====================================
            VISTA KANBAN ORIGINAL
        ==================================== */}

        {view === 'board' ? (
          <div className="board-scroll full-board">
            {STAGES.filter(
              (stage) =>
                showClosed ||
                ![
                  'ganado',
                  'perdido',
                ].includes(stage.id),
            ).map((stage) => {
              const list = deals.filter(
                (deal) =>
                  deal.stage === stage.id,
              );

              return (
                <div
                  key={stage.id}
                  className="board-column"
                  onDragOver={(event) =>
                    event.preventDefault()
                  }
                  onDrop={(event) => {
                    event.preventDefault();

                    const id =
                      event.dataTransfer.getData(
                        'text/plain',
                      );

                    if (
                      data.deals.some(
                        (deal) =>
                          deal.id === id,
                      )
                    ) {
                      changeStage(
                        id,
                        stage.id,
                      );
                    }
                  }}
                >
                  {/* ENCABEZADO ORIGINAL */}

                  <div className="column-heading">
                    <div>
                      <span
                        className="stage-dot"
                        style={{
                          background:
                            stage.color,
                        }}
                      />

                      {stage.label}

                      <span className="column-count">
                        {list.length}
                      </span>
                    </div>

                    <strong>
                      {money(
                        list.reduce(
                          (total, deal) =>
                            total + deal.amount,
                          0,
                        ),
                        data.settings.currency,
                        true,
                      )}
                    </strong>
                  </div>

                  {/* TARJETAS ORIGINALES */}

                  {list.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      onClick={() =>
                        onEdit(deal)
                      }
                      onMove={(nextStage) =>
                        changeStage(
                          deal.id,
                          nextStage,
                        )
                      }
                    />
                  ))}

                  {!list.length && (
                    <div className="board-empty">
                      {focus === 'todos' &&
                      !search
                        ? 'Arrastrá una tarjeta a esta etapa'
                        : 'Sin coincidencias para este filtro'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ==================================
              VISTA LISTA
          ================================== */

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Oportunidad</th>
                  <th>Empresa</th>
                  <th>Importe</th>
                  <th>Etapa</th>
                  <th>Prob.</th>
                  <th>Próxima acción</th>
                  <th>Cierre</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {deals.map((deal) => {
                  const followUp =
                    describeFollowUp(deal);

                  const isLate =
                    ![
                      'ganado',
                      'perdido',
                    ].includes(deal.stage) &&
                    overdue(deal.dueDate);

                  return (
                    <tr
                      key={deal.id}
                      tabIndex={0}
                      onClick={() =>
                        onEdit(deal)
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Enter' &&
                          event.target ===
                            event.currentTarget
                        ) {
                          onEdit(deal);
                        }
                      }}
                    >
                      {/* OPORTUNIDAD */}

                      <td>
                        <strong>
                          {deal.title}
                        </strong>

                        <small>
                          {deal.owner}
                        </small>
                      </td>

                      {/* EMPRESA */}

                      <td>
                        {data.companies.find(
                          (company) =>
                            company.id ===
                            deal.companyId,
                        )?.name ?? '—'}
                      </td>

                      {/* IMPORTE */}

                      <td className="money-cell">
                        {money(
                          deal.amount,
                          data.settings.currency,
                        )}
                      </td>

                      {/* ETAPA */}

                      <td>
                        <StageBadge
                          stage={
                            deal.stage
                          }
                        />
                      </td>

                      {/* PROBABILIDAD */}

                      <td>
                        {deal.probability}%
                      </td>

                      {/* PRÓXIMA ACCIÓN */}

                      <td>
                        <strong>
                          {followUp.title}
                        </strong>

                        <small>
                          {followUp.detail}
                        </small>
                      </td>

                      {/* CIERRE ESTIMADO */}

                      <td
                        className={
                          isLate
                            ? 'danger-text'
                            : ''
                        }
                      >
                        {fmtDate(
                          deal.dueDate,
                        )}
                      </td>

                      <td>
                        <ArrowRight
                          size={15}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* SIN RESULTADOS */}

        {!deals.length && (
          <Empty
            title="No encontramos oportunidades"
            detail="Probá otra búsqueda, cambiá el filtro o creá una oportunidad."
            onAction={onAdd}
          />
        )}
      </div>

      {/* INSTRUCCIONES */}

      <div className="hint-row">
        <SlidersHorizontal size={15} />

        Se muestran {deals.length} de{' '}
        {data.deals.length} oportunidades.
        Los filtros no modifican los datos
        y la exportación CSV respeta los
        resultados visibles. Arrastrá las
        tarjetas o utilizá su selector
        para cambiar de etapa.
      </div>
    </>
  );
}
