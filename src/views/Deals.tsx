
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
  csvDownload,
  fmtDate,
  money,
  openDeals,
  overdue,
  pipelineValue,
} from '../lib/utils';

import { Deal, STAGES } from '../types';

import {
  DealCard,
  Empty,
  PageHeading,
  StageBadge,
} from '../components/Shared';

export function Deals({
  onAdd,
  onEdit,
}: {
  onAdd: () => void;
  onEdit: (item: Deal) => void;
}) {
  const { data, changeStage, notify } = useCRM();

  const [view, setView] = useState<'board' | 'table'>('board');
  const [search, setSearch] = useState('');
  const [showClosed, setShowClosed] = useState(false);

  const deals = useMemo(
    () =>
      data.deals.filter((deal) => {
        if (
          !showClosed &&
          ['ganado', 'perdido'].includes(deal.stage)
        ) {
          return false;
        }

        const company =
          data.companies.find(
            (item) => item.id === deal.companyId,
          )?.name ?? '';

        return `${deal.title} ${company} ${deal.owner}`
          .toLowerCase()
          .includes(search.toLowerCase());
      }),
    [data.deals, data.companies, showClosed, search],
  );

  const exportRows = () => {
    csvDownload('nexo-oportunidades.csv', [
      [
        'Oportunidad',
        'Empresa',
        'Importe',
        'Moneda',
        'Etapa',
        'Probabilidad',
        'Responsable',
        'Cierre estimado',
      ],
      ...deals.map((deal) => [
        deal.title,
        data.companies.find(
          (company) => company.id === deal.companyId,
        )?.name ?? '',
        deal.amount,
        data.settings.currency,
        STAGES.find(
          (stage) => stage.id === deal.stage,
        )?.label ?? deal.stage,
        deal.probability,
        deal.owner,
        deal.dueDate,
      ]),
    ]);

    notify('CSV exportado');
  };

  return (
    <>
      <PageHeading
        eyebrow="VENTAS / OPORTUNIDADES"
        title="Pipeline de ventas"
        subtitle="Visualizá cada negociación y mantené el impulso comercial."
        action={
          <button
            className="btn btn-primary"
            onClick={onAdd}
          >
            <Plus size={16} />
            Nueva oportunidad
          </button>
        }
      />

      <div className="mini-metrics">
        <div>
          <span>En curso</span>
          <strong>{openDeals(data.deals).length}</strong>
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
            {
              data.deals.filter(
                (deal) => deal.stage === 'ganado',
              ).length
            }
          </strong>
        </div>

        <div>
          <span>Necesitan seguimiento</span>
          <strong>
            {
              openDeals(data.deals).filter((deal) =>
                overdue(deal.dueDate),
              ).length
            }
          </strong>
        </div>
      </div>

      <div className="panel full-panel">
        <div className="toolbar">
          <div className="search-field">
            <Search size={17} />

            <input
              aria-label="Buscar oportunidades"
              placeholder="Buscar por oportunidad o empresa..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            {search && (
              <button
                title="Limpiar"
                onClick={() => setSearch('')}
              >
                ×
              </button>
            )}
          </div>

          <div className="toolbar-right">
            <label className="switch-label">
              <input
                type="checkbox"
                checked={showClosed}
                onChange={(event) =>
                  setShowClosed(event.target.checked)
                }
              />

              <span>Mostrar cerradas</span>
            </label>

            <div className="segmented">
              <button
                className={view === 'board' ? 'active' : ''}
                onClick={() => setView('board')}
                title="Vista tablero"
              >
                <LayoutGrid size={16} />
              </button>

              <button
                className={view === 'table' ? 'active' : ''}
                onClick={() => setView('table')}
                title="Vista lista"
              >
                <List size={16} />
              </button>
            </div>

            <button
              className="btn btn-outline"
              onClick={exportRows}
            >
              <Download size={15} />
              CSV
            </button>
          </div>
        </div>

        {view === 'board' ? (
          <div className="board-scroll full-board">
            {STAGES.filter(
              (stage) =>
                showClosed ||
                !['ganado', 'perdido'].includes(stage.id),
            ).map((stage) => {
              const list = deals.filter(
                (deal) => deal.stage === stage.id,
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

                    const id = event.dataTransfer.getData(
                      'text/plain',
                    );

                    if (
                      data.deals.some(
                        (deal) => deal.id === id,
                      )
                    ) {
                      changeStage(id, stage.id);
                    }
                  }}
                >
                  <div className="column-heading">
                    <div>
                      <span
                        className="stage-dot"
                        style={{
                          background: stage.color,
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

                  {list.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      onClick={() => onEdit(deal)}
                      onMove={(newStage) =>
                        changeStage(deal.id, newStage)
                      }
                    />
                  ))}

                  {!list.length && (
                    <div className="board-empty">
                      Arrastrá una tarjeta a esta etapa
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Oportunidad</th>
                  <th>Empresa</th>
                  <th>Importe</th>
                  <th>Etapa</th>
                  <th>Prob.</th>
                  <th>Cierre</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {deals.map((deal) => (
                  <tr
                    key={deal.id}
                    onClick={() => onEdit(deal)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        onEdit(deal);
                      }
                    }}
                  >
                    <td>
                      <strong>{deal.title}</strong>
                      <small>{deal.owner}</small>
                    </td>

                    <td>
                      {data.companies.find(
                        (company) =>
                          company.id === deal.companyId,
                      )?.name ?? '—'}
                    </td>

                    <td className="money-cell">
                      {money(
                        deal.amount,
                        data.settings.currency,
                      )}
                    </td>

                    <td>
                      <StageBadge stage={deal.stage} />
                    </td>

                    <td>{deal.probability}%</td>

                    <td
                      className={
                        overdue(deal.dueDate) &&
                        !['ganado', 'perdido'].includes(
                          deal.stage,
                        )
                          ? 'danger-text'
                          : ''
                      }
                    >
                      {fmtDate(deal.dueDate)}
                    </td>

                    <td>
                      <ArrowRight size={15} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!deals.length && (
              <Empty
                title="No encontramos oportunidades"
                detail="Probá otra búsqueda o creá una oportunidad nueva."
                onAction={onAdd}
              />
            )}
          </div>
        )}
      </div>

      <div className="hint-row">
        <SlidersHorizontal size={15} />
        Arrastrá una oportunidad entre columnas o usá su
        selector de etapa. Hacé clic para editar sus detalles.
      </div>
    </>
  );
}
