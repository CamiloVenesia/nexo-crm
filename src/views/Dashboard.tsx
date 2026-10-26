
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Clock3,
  GitBranch,
  Plus,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { useCRM } from '../lib/store';

import {
  money,
  openDeals,
  overdue,
  pipelineValue,
  todayDue,
  weightedValue,
  fmtDateTime,
} from '../lib/utils';

import { Deal, Page, STAGES } from '../types';

import {
  DealCard,
  PageHeading,
  SectionTitle,
  StatTile,
  Tag,
} from '../components/Shared';

import {
  ForecastChart,
  PerformanceRing,
  RevenueLegend,
} from '../components/Charts';

export function Dashboard({
  navigate,
  newDeal,
  editDeal,
}: {
  navigate: (page: Page) => void;
  newDeal: () => void;
  editDeal: (deal: Deal) => void;
}) {
  const { data, changeStage } = useCRM();

  const active = openDeals(data.deals);

  const won = data.deals.filter(
    (deal) => deal.stage === 'ganado',
  );

  const closed = data.deals.filter((deal) =>
    ['ganado', 'perdido'].includes(deal.stage),
  );

  const winRate = closed.length
    ? Math.round((won.length / closed.length) * 100)
    : 0;

  const pending = data.tasks.filter((task) => !task.done);

  const critical = pending.filter(
    (task) =>
      overdue(task.dueDate) || todayDue(task.dueDate),
  );

  const insights = [
    critical.length
      ? {
          title: `${critical.length} seguimiento${
            critical.length !== 1 ? 's' : ''
          } para revisar`,
          detail:
            'Hay tareas pendientes para hoy o vencidas. Priorizá esos contactos.',
          tone: 'orange',
        }
      : {
          title: 'Seguimientos al día',
          detail:
            'No tenés tareas vencidas ni pendientes para hoy.',
          tone: 'green',
        },

    active.filter((deal) => overdue(deal.dueDate)).length
      ? {
          title: 'Cierres que necesitan atención',
          detail: `${
            active.filter((deal) => overdue(deal.dueDate))
              .length
          } oportunidades superaron su fecha estimada.`,
          tone: 'blue',
        }
      : {
          title: 'Pipeline en movimiento',
          detail:
            'Las oportunidades abiertas tienen fechas de cierre vigentes.',
          tone: 'blue',
        },
  ];

  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / RESUMEN"
        title="Tu operación, en una sola vista."
        subtitle="Una lectura clara de tus oportunidades, clientes y próximos pasos."
        action={
          <button
            className="btn btn-primary"
            onClick={newDeal}
          >
            <Plus size={17} />
            Nueva oportunidad
          </button>
        }
        secondary={
          <span className="date-chip">
            <CalendarDays size={15} />

            {new Date().toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        }
      />

      <div className="dashboard-layout">
        <div className="dashboard-main">
          <div className="kpi-grid">
            <StatTile
              label="Oportunidades activas"
              value={String(active.length).padStart(2, '0')}
              meta={`${data.deals.length} oportunidades totales`}
              icon={<GitBranch size={16} />}
            />

            <StatTile
              label="Valor del pipeline"
              value={money(
                pipelineValue(data.deals),
                data.settings.currency,
                true,
              )}
              meta="Oportunidades abiertas"
              icon={<TrendingUp size={16} />}
            />

            <StatTile
              label="Tasa de cierre"
              value={`${winRate}%`}
              meta={`${won.length} ganadas / ${closed.length} cerradas`}
              icon={<BadgeCheck size={16} />}
            />

            <StatTile
              label="Ingresos estimados"
              value={money(
                weightedValue(data.deals),
                data.settings.currency,
                true,
              )}
              meta="Ponderados por probabilidad"
              icon={<Zap size={16} />}
            />
          </div>

          <div className="panel board-panel">
            <div className="panel-heading">
              <SectionTitle
                icon={<GitBranch size={18} />}
                title="Pipeline de ventas"
                description="Las oportunidades, organizadas por etapa"
              />

              <button
                className="text-action"
                onClick={() => navigate('deals')}
              >
                Ver pipeline completo
                <ArrowRight size={15} />
              </button>
            </div>

            <div className="board-scroll dashboard-board">
              {STAGES.slice(0, 4).map((stage) => {
                const list = active.filter(
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

                      const id =
                        event.dataTransfer.getData(
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

                    {list.length ? (
                      list.slice(0, 3).map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          onClick={() => editDeal(deal)}
                        />
                      ))
                    ) : (
                      <div className="board-empty">
                        Arrastrá una oportunidad aquí
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel forecast-panel">
            <div className="panel-heading">
              <SectionTitle
                icon={<TrendingUp size={18} />}
                title="Proyección de ingresos"
                description="Estimación según fechas y probabilidades de cierre"
              />

              <RevenueLegend />
            </div>

            <ForecastChart height={224} />

            <div className="panel-footnote">
              Los importes se calculan con los datos cargados
              en esta demo. No representan ingresos reales.
            </div>
          </div>
        </div>

        <aside className="dashboard-side">
          <div className="panel intelligence-panel">
            <SectionTitle
              icon={<Sparkles size={18} />}
              title="Radar comercial"
              description="Señales para decidir qué hacer ahora"
            />

            <div className="insight-stack">
              {insights.map((insight, index) => (
                <button
                  key={index}
                  className="insight-item"
                  onClick={() =>
                    navigate(
                      index === 0 ? 'tasks' : 'deals',
                    )
                  }
                >
                  <span
                    className={`signal-dot ${insight.tone}`}
                  />

                  <strong>{insight.title}</strong>
                  <small>{insight.detail}</small>

                  <ArrowUpRight
                    className="insight-arrow"
                    size={15}
                  />
                </button>
              ))}
            </div>

            <div className="tiny-pill">
              <span className="live-dot" />
              Análisis basado en reglas · Sin IA externa
            </div>
          </div>

          <div className="panel performance-panel">
            <div className="performance-head">
              <SectionTitle
                icon={<Zap size={18} />}
                title="Salud comercial"
                description="Indicador orientativo de actividad"
              />

              <button
                className="icon-btn small"
                onClick={() => navigate('insights')}
                title="Ver métricas"
              >
                <ArrowUpRight size={16} />
              </button>
            </div>

            <PerformanceRing />

            <div className="performance-footer">
              <span>
                <CircleCheck size={15} />
                {won.length} ventas ganadas
              </span>

              <span>
                <Clock3 size={15} />
                {pending.length} pendientes
              </span>
            </div>
          </div>

          <div className="panel next-panel">
            <div className="panel-heading">
              <SectionTitle
                icon={<CalendarDays size={18} />}
                title="Próximas acciones"
              />

              <button
                className="text-action"
                onClick={() => navigate('tasks')}
              >
                Ver todas
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="next-tasks">
              {pending
                .sort((a, b) =>
                  a.dueDate.localeCompare(b.dueDate),
                )
                .slice(0, 4)
                .map((task) => (
                  <button
                    key={task.id}
                    className="next-task"
                    onClick={() => navigate('tasks')}
                  >
                    <span
                      className={`next-icon ${
                        overdue(task.dueDate)
                          ? 'late'
                          : ''
                      }`}
                    >
                      {overdue(task.dueDate) ? (
                        <CircleAlert size={14} />
                      ) : (
                        <CircleCheck size={14} />
                      )}
                    </span>

                    <span>
                      <strong>{task.title}</strong>

                      <small>
                        {overdue(task.dueDate)
                          ? 'Vencida · '
                          : ''}

                        {task.dueDate
                          ? new Date(
                              `${task.dueDate}T12:00:00`,
                            ).toLocaleDateString(
                              'es-AR',
                              {
                                day: 'numeric',
                                month: 'short',
                              },
                            )
                          : 'Sin fecha'}
                      </small>
                    </span>
                  </button>
                ))}

              {pending.length === 0 && (
                <p className="muted small-p">
                  No hay acciones pendientes.
                </p>
              )}
            </div>
          </div>

          <div className="side-note">
            <span>✦</span>

            <p>
              Un buen proceso comercial no solo muestra números:
              deja claro{' '}
              <strong>cuál es el próximo paso.</strong>
            </p>
          </div>
        </aside>
      </div>

      <div className="bottom-strip">
        <span className="strip-icon">
          <BadgeCheck size={16} />
        </span>

        <span>
          <strong>Todo conectado.</strong> Cada cambio en
          oportunidades y tareas se refleja en tus métricas.
        </span>

        <Tag tone="green">
          Datos guardados en tu navegador
        </Tag>

        <span className="strip-time">
          Última actividad:{' '}
          {data.activities.length
            ? fmtDateTime(data.activities[0].createdAt)
            : 'Sin actividad'}
        </span>
      </div>
    </>
  );
}
