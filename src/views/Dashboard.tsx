
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
import { calculateReportMetrics } from '../lib/reporting';
import { fmtDateTime, money, overdue, todayDue } from '../lib/utils';

import type { Deal, Page } from '../types';
import { STAGES } from '../types';

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

interface DashboardProps {
  navigate: (page: Page) => void;
  newDeal: () => void;
  editDeal: (deal: Deal) => void;
}

export function Dashboard({
  navigate,
  newDeal,
  editDeal,
}: DashboardProps) {
  const { data, changeStage } = useCRM();

  // ==========================================
  // MÉTRICAS COMPARTIDAS CON REPORTES
  // ==========================================

  const metrics = calculateReportMetrics(data.deals);
  const currency = data.settings.currency;

  const active = data.deals.filter(
    (deal) =>
      deal.stage !== 'ganado' &&
      deal.stage !== 'perdido',
  );

  const pending = data.tasks.filter(
    (task) => !task.done,
  );

  const lateTasks = pending.filter(
    (task) => overdue(task.dueDate),
  );

  const todayTasks = pending.filter(
    (task) => todayDue(task.dueDate),
  );

  const lateClosings = active.filter(
    (deal) => overdue(deal.dueDate),
  );

  // Ordenamos sin modificar los datos del CRM.

  const nextTasks = [...pending]
    .sort((a, b) =>
      (a.dueDate || '9999-12-31').localeCompare(
        b.dueDate || '9999-12-31',
      ),
    )
    .slice(0, 4);

  // ==========================================
  // RADAR COMERCIAL
  // ==========================================

  const insights = [
    lateTasks.length + todayTasks.length > 0
      ? {
          title: `${
            lateTasks.length + todayTasks.length
          } seguimiento(s) para revisar`,
          detail: `${lateTasks.length} tarea(s) vencida(s) y ${todayTasks.length} para hoy.`,
          tone: 'orange',
          page: 'tasks' as Page,
        }
      : {
          title: 'Seguimientos al día',
          detail:
            'No hay tareas vencidas ni tareas pendientes para hoy.',
          tone: 'green',
          page: 'tasks' as Page,
        },

    lateClosings.length > 0
      ? {
          title: `${lateClosings.length} cierre(s) para revisar`,
          detail:
            'Oportunidades abiertas que superaron su fecha estimada de cierre.',
          tone: 'blue',
          page: 'deals' as Page,
        }
      : {
          title: 'Fechas de cierre al día',
          detail:
            'Ninguna oportunidad abierta tiene un cierre estimado vencido.',
          tone: 'blue',
          page: 'deals' as Page,
        },
  ];

  return (
    <>
      {/* ======================================
          ENCABEZADO ORIGINAL
      ====================================== */}

      <PageHeading
        eyebrow="WORKSPACE / RESUMEN"
        title="Tu operación, en una sola vista."
        subtitle="Una lectura clara de tus oportunidades, clientes y próximos pasos."
        action={
          <button
            type="button"
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

            {new Date().toLocaleDateString(
              'es-AR',
              {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              },
            )}
          </span>
        }
      />

      <div className="dashboard-layout">
        <div className="dashboard-main">
          {/* ==================================
              INDICADORES PRINCIPALES
          ================================== */}

          <div className="kpi-grid">
            <StatTile
              label="Oportunidades activas"
              value={String(
                metrics.openCount,
              ).padStart(2, '0')}
              meta={`${data.deals.length} oportunidades registradas`}
              icon={<GitBranch size={16} />}
            />

            <StatTile
              label="Valor del pipeline"
              value={money(
                metrics.openValue,
                currency,
                true,
              )}
              meta={`Importe de oportunidades abiertas · ${currency}`}
              icon={<TrendingUp size={16} />}
            />

            <StatTile
              label="Tasa de cierre"
              value={
                metrics.closeRate === null
                  ? '—'
                  : `${metrics.closeRate}%`
              }
              meta={`${metrics.wonCount} ganadas de ${metrics.closedCount} cerradas`}
              icon={<BadgeCheck size={16} />}
            />

            <StatTile
              label="Proyección ponderada"
              value={money(
                metrics.weightedOpenValue,
                currency,
                true,
              )}
              meta={`Importe abierto × probabilidad · ${currency}`}
              icon={<Zap size={16} />}
            />
          </div>

          {/* ==================================
              KANBAN RESUMIDO ORIGINAL
          ================================== */}

          <div className="panel board-panel">
            <div className="panel-heading">
              <SectionTitle
                icon={<GitBranch size={18} />}
                title="Pipeline de ventas"
                description="Las oportunidades, organizadas por etapa"
              />

              <button
                type="button"
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
                  (deal) =>
                    deal.stage === stage.id,
                );

                const total = list.reduce(
                  (sum, deal) =>
                    sum + deal.amount,
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
                          total,
                          currency,
                          true,
                        )}
                      </strong>
                    </div>

                    {list.length ? (
                      list
                        .slice(0, 3)
                        .map((deal) => (
                          <DealCard
                            key={deal.id}
                            deal={deal}
                            onClick={() =>
                              editDeal(deal)
                            }
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

          {/* ==================================
              GRÁFICO ORIGINAL
          ================================== */}

          <div className="panel forecast-panel">
            <div className="panel-heading">
              <SectionTitle
                icon={<TrendingUp size={18} />}
                title="Proyección comercial"
                description="Valores de oportunidades agrupados por fecha estimada de cierre"
              />

              <RevenueLegend />
            </div>

            <ForecastChart height={224} />

            <div className="panel-footnote">
              Los valores son estimaciones basadas en
              oportunidades. Las ventas ganadas no equivalen
              necesariamente a dinero cobrado.
            </div>
          </div>
        </div>

        {/* ====================================
            COLUMNA DERECHA ORIGINAL
        ==================================== */}

        <aside className="dashboard-side">
          {/* RADAR */}

          <div className="panel intelligence-panel">
            <SectionTitle
              icon={<Sparkles size={18} />}
              title="Radar comercial"
              description="Señales para decidir qué hacer ahora"
            />

            <div className="insight-stack">
              {insights.map((insight) => (
                <button
                  key={insight.page}
                  type="button"
                  className="insight-item"
                  onClick={() =>
                    navigate(insight.page)
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

          {/* SALUD COMERCIAL */}

          <div className="panel performance-panel">
            <div className="performance-head">
              <SectionTitle
                icon={<Zap size={18} />}
                title="Salud comercial"
                description="Indicador orientativo de actividad"
              />

              <button
                type="button"
                className="icon-btn small"
                onClick={() =>
                  navigate('insights')
                }
                title="Ver reportes"
                aria-label="Ver reportes"
              >
                <ArrowUpRight size={16} />
              </button>
            </div>

            <PerformanceRing />

            <div className="performance-footer">
              <span>
                <CircleCheck size={15} />
                {metrics.wonCount} ventas ganadas
              </span>

              <span>
                <Clock3 size={15} />
                {pending.length} tareas pendientes
              </span>
            </div>
          </div>

          {/* PRÓXIMAS ACCIONES */}

          <div className="panel next-panel">
            <div className="panel-heading">
              <SectionTitle
                icon={<CalendarDays size={18} />}
                title="Próximas acciones"
              />

              <button
                type="button"
                className="text-action"
                onClick={() =>
                  navigate('tasks')
                }
              >
                Ver todas
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="next-tasks">
              {nextTasks.map((task) => {
                const late = overdue(task.dueDate);
                const today = todayDue(task.dueDate);

                return (
                  <button
                    key={task.id}
                    type="button"
                    className="next-task"
                    onClick={() =>
                      navigate('tasks')
                    }
                  >
                    <span
                      className={`next-icon ${
                        late ? 'late' : ''
                      }`}
                    >
                      {late ? (
                        <CircleAlert size={14} />
                      ) : (
                        <CircleCheck size={14} />
                      )}
                    </span>

                    <span>
                      <strong>{task.title}</strong>

                      <small>
                        {late
                          ? 'Vencida · '
                          : today
                            ? 'Hoy · '
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
                );
              })}

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
              Un buen proceso comercial no solo muestra
              números: deja claro{' '}
              <strong>cuál es el próximo paso.</strong>
            </p>
          </div>
        </aside>
      </div>

      {/* ====================================
          PIE DEL DASHBOARD
      ==================================== */}

      <div className="bottom-strip">
        <span className="strip-icon">
          <BadgeCheck size={16} />
        </span>

        <span>
          <strong>Todo conectado.</strong>
          {' '}
          Cada cambio en oportunidades y tareas
          se refleja en tus métricas.
        </span>

        <Tag tone="green">
          Datos guardados en tu navegador
        </Tag>

        <span className="strip-time">
          Última actividad:{' '}
          {data.activities.length
            ? fmtDateTime(
                data.activities[0].createdAt,
              )
            : 'Sin actividad'}
        </span>
      </div>
    </>
  );
}
