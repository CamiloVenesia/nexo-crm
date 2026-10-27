
import { useMemo, useState } from 'react';

import {
  ArrowRight,
  CalendarClock,
  Download,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

import { useCRM } from '../lib/store';

import {
  dealNeedsAttention,
  getDealFollowUp,
  nextPendingTask,
} from '../lib/commercial';

import {
  csvDownload,
  fmtDate,
  money,
  openDeals,
  overdue,
  pipelineValue,
} from '../lib/utils';

import type { Deal } from '../types';
import { STAGES } from '../types';

import {
  DealCard,
  Empty,
  PageHeading,
  StageBadge,
} from '../components/Shared';

import './commercial.css';

type FollowUpFilter =
  | 'todos'
  | 'urgentes'
  | 'sin-seguimiento';

interface DealsProps {
  onAdd: () => void;
  onEdit: (item: Deal) => void;
}

export function Deals({
  onAdd,
  onEdit,
}: DealsProps) {
  const { data, changeStage, notify } = useCRM();

  // ============================================
  // FILTROS Y VISTAS
  // ============================================

  const [view, setView] = useState<
    'board' | 'table'
  >('board');

  const [search, setSearch] = useState('');
  const [showClosed, setShowClosed] = useState(false);

  const [
    followUpFilter,
    setFollowUpFilter,
  ] = useState<FollowUpFilter>('todos');

  const deals = useMemo(() => {
    const query = search
      .trim()
      .toLocaleLowerCase('es-AR');

    return data.deals.filter((deal) => {
      // Oportunidades cerradas

      if (
        !showClosed &&
        ['ganado', 'perdido'].includes(
          deal.stage,
        )
      ) {
        return false;
      }

      // Empresa y contacto

      const company =
        data.companies.find(
          (item) =>
            item.id === deal.companyId,
        )?.name ?? '';

      const contact =
        data.contacts.find(
          (item) =>
            item.id === deal.contactId,
        )?.name ?? '';

      const searchable = [
        deal.title,
        company,
        contact,
        deal.owner,
      ]
        .join(' ')
        .toLocaleLowerCase('es-AR');

      if (
        query &&
        !searchable.includes(query)
      ) {
        return false;
      }

      // Seguimientos urgentes

      if (
        followUpFilter === 'urgentes' &&
        !dealNeedsAttention(
          deal,
          data.tasks,
        )
      ) {
        return false;
      }

      // Oportunidades sin tareas pendientes

      if (
        followUpFilter ===
          'sin-seguimiento' &&
        nextPendingTask(
          deal.id,
          data.tasks,
        )
      ) {
        return false;
      }

      if (
        followUpFilter ===
          'sin-seguimiento' &&
        ['ganado', 'perdido'].includes(
          deal.stage,
        )
      ) {
        return false;
      }

      return true;
    });
  }, [
    data.deals,
    data.companies,
    data.contacts,
    data.tasks,
    search,
    showClosed,
    followUpFilter,
  ]);

  // ============================================
  // MÉTRICAS
  // ============================================

  const active = openDeals(data.deals);

  const won = data.deals.filter(
    (deal) => deal.stage === 'ganado',
  );

  const urgent = active.filter(
    (deal) =>
      dealNeedsAttention(
        deal,
        data.tasks,
      ),
  );

  const withoutFollowUp = active.filter(
    (deal) =>
      !nextPendingTask(
        deal.id,
        data.tasks,
      ),
  );

  // ============================================
  // EXPORTACIÓN CSV
  // ============================================

  const exportRows = () => {
    csvDownload(
      'nexo-oportunidades.csv',
      [
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
          'Próxima acción',
          'Estado del seguimiento',
        ],

        ...deals.map((deal) => {
          const company =
            data.companies.find(
              (item) =>
                item.id === deal.companyId,
            )?.name ?? '';

          const contact =
            data.contacts.find(
              (item) =>
                item.id === deal.contactId,
            )?.name ?? '';

          const followUp =
            getDealFollowUp(
              deal,
              data.tasks,
            );

          return [
            deal.title,
            company,
            contact,
            deal.amount,
            data.settings.currency,
            STAGES.find(
              (stage) =>
                stage.id === deal.stage,
            )?.label ?? deal.stage,
            deal.probability,
            deal.owner,
            deal.dueDate,
            followUp.label,
            followUp.detail,
          ];
        }),
      ],
    );

    notify('Oportunidades exportadas a CSV');
  };

  // ============================================
  // INTERFAZ
  // ============================================

  return (
    <>
      <PageHeading
        eyebrow="VENTAS / OPORTUNIDADES"
        title="Pipeline de ventas"
        subtitle="Gestioná negociaciones, próximos pasos y seguimientos desde un solo lugar."
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
          MÉTRICAS RESUMIDAS
      ====================================== */}

      <div className="mini-metrics">
        <div>
          <span>En curso</span>

          <strong>
            {active.length}
          </strong>
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

          <strong>
            {won.length}
          </strong>
        </div>

        <div>
          <span>Requieren atención</span>

          <strong>
            {urgent.length}
          </strong>
        </div>
      </div>

      {/* ======================================
          PANEL DEL PIPELINE
      ====================================== */}

      <div className="panel full-panel">
        {/* HERRAMIENTAS */}

        <div className="toolbar commercial-toolbar">
          <div className="search-field">
            <Search size={17} />

            <input
              aria-label="Buscar oportunidades"
              placeholder="Buscar oportunidad, empresa o responsable..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
            />

            {search && (
              <button
                type="button"
                title="Limpiar búsqueda"
                aria-label="Limpiar búsqueda"
                onClick={() =>
                  setSearch('')
                }
              >
                ×
              </button>
            )}
          </div>

          <div className="toolbar-right">
            {/* FILTRO DE SEGUIMIENTO */}

            <select
              className="select-filter commercial-filter"
              aria-label="Filtrar por seguimiento"
              value={followUpFilter}
              onChange={(event) =>
                setFollowUpFilter(
                  event.target.value as FollowUpFilter,
                )
              }
            >
              <option value="todos">
                Todos los seguimientos
              </option>

              <option value="urgentes">
                Requieren atención
              </option>

              <option value="sin-seguimiento">
                Sin tareas pendientes
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

              <span>
                Mostrar cerradas
              </span>
            </label>

            {/* CAMBIAR VISTA */}

            <div className="segmented">
              <button
                type="button"
                className={
                  view === 'board'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setView('board')
                }
                title="Vista tablero"
                aria-label="Vista tablero"
                aria-pressed={
                  view === 'board'
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
                onClick={() =>
                  setView('table')
                }
                title="Vista lista"
                aria-label="Vista lista"
                aria-pressed={
                  view === 'table'
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
            VISTA KANBAN
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

              const stageAmount =
                list.reduce(
                  (total, deal) =>
                    total + deal.amount,
                  0,
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
                  {/* ENCABEZADO */}

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
                        stageAmount,
                        data.settings.currency,
                        true,
                      )}
                    </strong>
                  </div>

                  {/* TARJETAS */}

                  {list.map((deal) => {
                    const followUp =
                      getDealFollowUp(
                        deal,
                        data.tasks,
                      );

                    const closingOverdue =
                      deal.dueDate &&
                      overdue(deal.dueDate) &&
                      ![
                        'ganado',
                        'perdido',
                      ].includes(
                        deal.stage,
                      );

                    return (
                      <div
                        key={deal.id}
                        className="deal-card-stack"
                      >
                        <DealCard
                          deal={deal}
                          onClick={() =>
                            onEdit(deal)
                          }
                          onMove={(
                            newStage,
                          ) =>
                            changeStage(
                              deal.id,
                              newStage,
                            )
                          }
                        />

                        <div
                          className={`deal-follow-up follow-up-${followUp.tone}`}
                        >
                          <CalendarClock
                            size={14}
                          />

                          <div>
                            <strong>
                              {followUp.label}
                            </strong>

                            <small>
                              {followUp.detail}
                            </small>
                          </div>
                        </div>

                        {closingOverdue && (
                          <div className="deal-closing-alert">
                            Cierre estimado vencido
                            {' · '}
                            {fmtDate(
                              deal.dueDate,
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* ESTADO VACÍO */}

                  {!list.length && (
                    <div className="board-empty">
                      No hay oportunidades
                      en esta etapa
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ==================================
              VISTA TABLA
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
                  const company =
                    data.companies.find(
                      (item) =>
                        item.id ===
                        deal.companyId,
                    );

                  const followUp =
                    getDealFollowUp(
                      deal,
                      data.tasks,
                    );

                  const closingOverdue =
                    overdue(
                      deal.dueDate,
                    ) &&
                    ![
                      'ganado',
                      'perdido',
                    ].includes(
                      deal.stage,
                    );

                  return (
                    <tr
                      key={deal.id}
                      tabIndex={0}
                      onClick={() =>
                        onEdit(deal)
                      }
                      onKeyDown={(
                        event,
                      ) => {
                        if (
                          event.key ===
                          'Enter'
                        ) {
                          onEdit(
                            deal,
                          );
                        }
                      }}
                    >
                      <td>
                        <strong>
                          {deal.title}
                        </strong>

                        <small>
                          {deal.owner}
                        </small>
                      </td>

                      <td>
                        {company?.name ??
                          '—'}
                      </td>

                      <td className="money-cell">
                        {money(
                          deal.amount,
                          data.settings.currency,
                        )}
                      </td>

                      <td>
                        <StageBadge
                          stage={
                            deal.stage
                          }
                        />
                      </td>

                      <td>
                        {deal.probability}%
                      </td>

                      <td>
                        <span
                          className={`table-follow-up follow-up-${followUp.tone}`}
                        >
                          <strong>
                            {followUp.label}
                          </strong>

                          <small>
                            {followUp.detail}
                          </small>
                        </span>
                      </td>

                      <td
                        className={
                          closingOverdue
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

        {/* ====================================
            ESTADO VACÍO GENERAL
        ==================================== */}

        {!deals.length && (
          <div className="commercial-empty">
            <Empty
              title="No encontramos oportunidades"
              detail="Probá otra búsqueda, cambiá los filtros o creá una nueva oportunidad."
              onAction={onAdd}
            />
          </div>
        )}
      </div>

      {/* ======================================
          ACLARACIONES
      ====================================== */}

      <div className="hint-row">
        <SlidersHorizontal size={15} />

        Arrastrá las tarjetas entre
        columnas o usá el selector
        de etapa. Cada oportunidad
        muestra su próxima tarea
        pendiente.
      </div>

      {withoutFollowUp.length > 0 && (
        <div className="commercial-notice">
          <CalendarClock size={17} />

          <span>
            <strong>
              {withoutFollowUp.length}
              {' '}
              oportunidad
              {withoutFollowUp.length !== 1
                ? 'es'
                : ''}
              {' '}
              sin tareas pendientes.
            </strong>
            {' '}
            Vincular una próxima acción
            ayuda a evitar seguimientos
            olvidados.
          </span>
        </div>
      )}
    </>
  );
}
