
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
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
  dealNeedsAttention,
  getDealFollowUp,
  getPriorityItems,
  nextPendingTask,
} from '../lib/commercial';

import {
  fmtDateTime,
  money,
  openDeals,
  overdue,
  pipelineValue,
  weightedValue,
} from '../lib/utils';

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

import './commercial.css';

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

  // ============================================
  // INDICADORES GENERALES
  // ============================================

  const active = openDeals(data.deals);

  const won = data.deals.filter(
    (deal) => deal.stage === 'ganado',
  );

  const closed = data.deals.filter(
    (deal) =>
      deal.stage === 'ganado' ||
      deal.stage === 'perdido',
  );

  const winRate = closed.length
    ? Math.round(
        (won.length / closed.length) * 100,
      )
    : 0;

  const pending = data.tasks
    .filter((task) => !task.done)
    .sort((a, b) =>
      a.dueDate.localeCompare(b.dueDate),
    );

  // ============================================
  // PRIORIDADES COMERCIALES
  // ============================================

  const priorities = getPriorityItems(data);

  const overdueItems = priorities.filter(
    (item) => item.tone === 'overdue',
  );

  const todayItems = priorities.filter(
    (item) => item.tone === 'today',
  );

  const dealsWithoutFollowUp = active.filter(
    (deal) =>
      !nextPendingTask(deal.id, data.tasks),
  );

  const urgentDeals = active.filter((deal) =>
    dealNeedsAttention(
      deal,
      data.tasks,
    ),
  );

  // ============================================
  // RECOMENDACIONES DEL RADAR
  // ============================================

  const insights = [
    {
      title: priorities.length
        ? `${priorities.length} asunto${
            priorities.length !== 1 ? 's' : ''
          } para revisar`
        : 'Todo al día',
      detail: priorities.length
        ? 'Hay tareas pendientes o fechas de cierre que requieren atención.'
        : 'No hay tareas urgentes ni cierres estimados vencidos.',
      tone: priorities.length
        ? 'orange'
        : 'green',
      page: 'tasks' as Page,
    },
    {
      title: dealsWithoutFollowUp.length
        ? `${dealsWithoutFollowUp.length} oportunidad${
            dealsWithoutFollowUp.length !== 1 ? 'es' : ''
          } sin seguimiento`
        : 'Seguimientos organizados',
      detail: dealsWithoutFollowUp.length
        ? 'Estas oportunidades no tienen una tarea pendiente asociada.'
        : 'Todas las oportunidades abiertas tienen al menos una tarea pendiente.',
      tone: dealsWithoutFollowUp.length
        ? 'orange'
        : 'green',
      page: 'deals' as Page,
    },
    {
      title: urgentDeals.length
        ? `${urgentDeals.length} oportunidad${
            urgentDeals.length !== 1 ? 'es' : ''
          } con atención pendiente`
        : 'Pipeline actualizado',
      detail: urgentDeals.length
        ? 'Revisá los cierres estimados y próximos seguimientos.'
        : 'No hay oportunidades abiertas con fechas vencidas o tareas urgentes.',
      tone: 'blue',
      page: 'deals' as Page,
    },
  ];

  // ============================================
  // INTERFAZ
  // ============================================

  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / RESUMEN"
        title="Tu operación, en una sola vista."
        subtitle="Prioridades claras, oportunidades organizadas y decisiones basadas en tus datos."
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
          {/* ====================================
              PRIORIDADES DEL DÍA
          ==================================== */}

          <section
            className="panel workday-panel"
            aria-label="Prioridades comerciales"
          >
            <div className="workday-head">
              <SectionTitle
                icon={<CalendarClock size={18} />}
                title="Lo que requiere tu atención"
                description="Empezá por lo importante antes de revisar los números"
              />

              <span className="workday-counter">
                {priorities.length}
                {' '}
                pendiente
                {priorities.length !== 1
                  ? 's'
                  : ''}
              </span>
            </div>

            {priorities.length ? (
              <div className="workday-list">
                {priorities
                  .slice(0, 3)
                  .map((item) => (
                    <button
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      className={`workday-item workday-${item.tone}`}
                      onClick={() => {
                        if (
                          item.kind === 'task'
                        ) {
                          navigate('tasks');
                          return;
                        }

                        const deal =
                          data.deals.find(
                            (entry) =>
                              entry.id === item.id,
                          );

                        if (deal) {
                          editDeal(deal);
                        }
                      }}
                    >
                      <span className="workday-item-icon">
                        {item.tone ===
                        'overdue' ? (
                          <CircleAlert
                            size={17}
                          />
                        ) : (
                          <Clock3
                            size={17}
                          />
                        )}
                      </span>

                      <span className="workday-item-content">
                        <strong>
                          {item.title}
                        </strong>

                        <small>
                          {item.detail}
                        </small>
                      </span>

                      <ArrowUpRight size={16} />
                    </button>
                  ))}
              </div>
            ) : (
              <div className="workday-empty">
                <CircleCheck size={20} />

                <div>
                  <strong>
                    No hay urgencias registradas.
                  </strong>

                  <p>
                    Las tareas de hoy y los
                    cierres vencidos aparecerán
                    aquí automáticamente.
                  </p>
                </div>
              </div>
            )}

            <div className="workday-footer">
              <span>
                {overdueItems.length}
                {' '}
                vencidos
                {' · '}
                {todayItems.length}
                {' '}
                para hoy
              </span>

              <button
                type="button"
                className="text-action"
                onClick={() =>
                  navigate('tasks')
                }
              >
                Abrir tareas
                <ArrowRight size={15} />
              </button>
            </div>
          </section>

          {/* ====================================
              MÉTRICAS PRINCIPALES
          ==================================== */}

          <div className="kpi-grid">
            <StatTile
              label="Oportunidades activas"
              value={String(
                active.length,
              ).padStart(2, '0')}
              meta={`${data.deals.length} oportunidades registradas`}
              icon={<GitBranch size={16} />}
            />

            <StatTile
              label="Valor del pipeline"
              value={money(
                pipelineValue(data.deals),
                data.settings.currency,
                true,
              )}
              meta="Importe total de oportunidades abiertas"
              icon={<TrendingUp size={16} />}
            />

            <StatTile
              label="Tasa de cierre"
              value={`${winRate}%`}
              meta={`${won.length} ganadas de ${closed.length} cerradas`}
              icon={<BadgeCheck size={16} />}
            />

            <StatTile
              label="Proyección ponderada"
              value={money(
                weightedValue(data.deals),
                data.settings.currency,
                true,
              )}
              meta="Importe abierto multiplicado por probabilidad"
              icon={<Zap size={16} />}
            />
          </div>

          {/* ====================================
              PIPELINE RESUMIDO
          ==================================== */}

          <div className="panel board-panel">
            <div className="panel-heading">
              <SectionTitle
                icon={<GitBranch size={18} />}
                title="Pipeline de ventas"
                description="Oportunidades abiertas y su próximo seguimiento"
              />

              <button
                type="button"
                className="text-action"
                onClick={() =>
                  navigate('deals')
                }
              >
                Ver pipeline completo
                <ArrowRight size={15} />
              </button>
            </div>

            <div className="board-scroll dashboard-board">
              {STAGES.slice(0, 4).map(
                (stage) => {
                  const list = active.filter(
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

                      {list.length ? (
                        list
                          .slice(0, 3)
                          .map((deal) => {
                            const followUp =
                              getDealFollowUp(
                                deal,
                                data.tasks,
                              );

                            return (
                              <div
                                key={deal.id}
                                className="deal-card-stack"
                              >
                                <DealCard
                                  deal={deal}
                                  onClick={() =>
                                    editDeal(
                                      deal,
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
                              </div>
                            );
                          })
                      ) : (
                        <div className="board-empty">
                          Arrastrá una oportunidad aquí
                        </div>
                      )}
                    </div>
                  );
                },
              )}
            </div>

            <div className="commercial-board-note">
              Se muestran hasta tres oportunidades por
              etapa. Abrí el pipeline completo para
              gestionar todas las negociaciones.
            </div>
          </div>

          {/* ====================================
              PROYECCIÓN
          ==================================== */}

          <div className="panel forecast-panel">
            <div className="panel-heading">
              <SectionTitle
                icon={<TrendingUp size={18} />}
                title="Proyección de ingresos"
                description="Estimación orientativa basada en fechas, importes y probabilidades"
              />

              <RevenueLegend />
            </div>

            <ForecastChart height={224} />

            <div className="panel-footnote">
              La proyección no representa dinero
              cobrado ni garantiza futuros ingresos.
              Se calcula con los datos de esta demo.
            </div>
          </div>
        </div>

        {/* ======================================
            COLUMNA DERECHA
        ====================================== */}

        <aside className="dashboard-side">
          {/* RADAR COMERCIAL */}

          <div className="panel intelligence-panel">
            <SectionTitle
              icon={<Sparkles size={18} />}
              title="Radar comercial"
              description="Alertas basadas en tus registros"
            />

            <div className="insight-stack">
              {insights.map((insight) => (
                <button
                  key={insight.title}
                  type="button"
                  className="insight-item"
                  onClick={() =>
                    navigate(
                      insight.page,
                    )
                  }
                >
                  <span
                    className={`signal-dot ${insight.tone}`}
                  />

                  <strong>
                    {insight.title}
                  </strong>

                  <small>
                    {insight.detail}
                  </small>

                  <ArrowUpRight
                    className="insight-arrow"
                    size={15}
                  />
                </button>
              ))}
            </div>

            <div className="tiny-pill">
              <span className="live-dot" />

              Análisis basado en reglas
              {' · '}
              Sin IA externa
            </div>
          </div>

          {/* INDICADOR DE ACTIVIDAD */}

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
                title="Ver métricas"
              >
                <ArrowUpRight size={16} />
              </button>
            </div>

            <PerformanceRing />

            <div className="performance-footer">
              <span>
                <CircleCheck size={15} />
                {won.length}
                {' '}
                ventas ganadas
              </span>

              <span>
                <Clock3 size={15} />
                {pending.length}
                {' '}
                tareas pendientes
              </span>
            </div>
          </div>

          {/* PRÓXIMAS TAREAS */}

          <div className="panel next-panel">
            <div className="panel-heading">
              <SectionTitle
                icon={<CalendarDays size={18} />}
                title="Próximas acciones"
                description="Seguimientos pendientes"
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
              {pending
                .slice(0, 4)
                .map((task) => (
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
                      <strong>
                        {task.title}
                      </strong>

                      <small>
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
              Un buen proceso comercial no
              solo muestra números: deja
              claro{' '}
              <strong>
                cuál es el próximo paso.
              </strong>
            </p>
          </div>
        </aside>
      </div>

      {/* ======================================
          RESUMEN INFERIOR
      ====================================== */}

      <div className="bottom-strip">
        <span className="strip-icon">
          <BadgeCheck size={16} />
        </span>

        <span>
          <strong>Todo conectado.</strong>
          {' '}
          Las oportunidades y tareas
          actualizan automáticamente
          las métricas de NEXO.
        </span>

        <Tag tone="green">
          Datos de demostración
        </Tag>

        <span className="strip-time">
          Última actividad:
          {' '}
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
