
import type { ReactNode } from 'react';
import {
  Activity as ActivityIcon,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  GitBranch,
  Plus,
  TrendingUp,
} from 'lucide-react';

import {
  PageHeading,
  SectionTitle,
  StageBadge,
} from '../components/Shared';
import {
  ForecastChart,
  RevenueLegend,
} from '../components/Charts';
import { useCRM } from '../lib/store';
import { calculateReportMetrics } from '../lib/reporting';
import {
  fmtDate,
  fmtDateTime,
  money,
  overdue,
  todayDue,
  toDateInput,
} from '../lib/utils';
import type { Deal, Page, Task } from '../types';
import { STAGES } from '../types';

import './dashboard-home.css';

type DashboardProps = {
  navigate: (page: Page) => void;
  newDeal: () => void;
  editDeal: (deal: Deal) => void;
};

function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="stat-tile nexo-home-metric">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-number" title={value}>
        {value}
      </div>
      <p>{detail}</p>
    </div>
  );
}

function taskOrder(task: Task, today: string): number {
  if (task.dueDate && task.dueDate < today) return 0;
  if (task.dueDate === today) return 1;
  return 2;
}

export function Dashboard({
  navigate,
  newDeal,
  editDeal,
}: DashboardProps) {
  const { data, toggleTask } = useCRM();
  const currency = data.settings.currency;
  const today = toDateInput(new Date());
  const metrics = calculateReportMetrics(data.deals);

  const openDeals = data.deals.filter(
    (deal) =>
      deal.stage !== 'ganado' &&
      deal.stage !== 'perdido',
  );

  const pending = data.tasks.filter((task) => !task.done);
  const late = pending.filter((task) => overdue(task.dueDate));
  const dueToday = pending.filter((task) => todayDue(task.dueDate));
  const pendingAttention = late.length + dueToday.length;

  const importantTasks = [...pending]
    .sort(
      (a, b) =>
        taskOrder(a, today) - taskOrder(b, today) ||
        (a.dueDate || '9999-12-31').localeCompare(
          b.dueDate || '9999-12-31',
        ) ||
        (
          { alta: 0, media: 1, baja: 2 }[a.priority] -
          { alta: 0, media: 1, baja: 2 }[b.priority]
        ),
    )
    .slice(0, 5);

  const relevantDeals = [...openDeals]
    .sort((a, b) =>
      (a.dueDate || '9999-12-31').localeCompare(
        b.dueDate || '9999-12-31',
      ),
    )
    .slice(0, 4);

  return (
    <div className="nexo-home">
      <PageHeading
        eyebrow="WORKSPACE / INICIO"
        title="Tu negocio, al día."
        subtitle="Lo importante para hoy, sin perder de vista tus clientes y oportunidades."
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={newDeal}
          >
            <Plus size={16} />
            Nueva oportunidad
          </button>
        }
      />

      <section
        className="nexo-home-focus"
        aria-label="Resumen de prioridades"
      >
        <div className="nexo-home-focus-icon">
          <CalendarClock size={22} />
        </div>

        <div className="nexo-home-focus-copy">
          <span className="nexo-home-eyebrow">
            TU PRIORIDAD DE HOY
          </span>

          <h2>
            {pendingAttention
              ? `${pendingAttention} tarea${
                  pendingAttention === 1 ? '' : 's'
                } necesita${
                  pendingAttention === 1 ? '' : 'n'
                } atención`
              : 'Todo al día por ahora'}
          </h2>

          <p>
            {late.length} vencidas · {dueToday.length} para hoy
            {' · '}
            {openDeals.length} oportunidades abiertas
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline"
          onClick={() => navigate('tasks')}
        >
          Ver tareas
          <ArrowRight size={15} />
        </button>
      </section>

      <section
        className="kpi-grid nexo-home-stats"
        aria-label="Indicadores principales"
      >
        <Metric
          label="Clientes"
          value={String(data.companies.length)}
          detail="Empresas registradas"
          icon={<Building2 size={17} />}
        />

        <Metric
          label="Negocios en curso"
          value={String(metrics.openCount)}
          detail="Oportunidades abiertas"
          icon={<GitBranch size={17} />}
        />

        <Metric
          label="Valor del pipeline"
          value={money(metrics.openValue, currency, true)}
          detail="Importe potencial, no cobrado"
          icon={<TrendingUp size={17} />}
        />

        <Metric
          label="Ventas ganadas"
          value={String(metrics.wonCount)}
          detail={`${money(
            metrics.wonValue,
            currency,
            true,
          )} en negocios ganados`}
          icon={<BadgeCheck size={17} />}
        />
      </section>

      <div className="dashboard-layout nexo-home-columns">
        <div className="dashboard-main">
          <section className="panel nexo-home-panel">
            <div className="panel-heading">
              <SectionTitle
                icon={<CalendarClock size={18} />}
                title="Qué tenés que hacer"
                description="Las próximas tareas, ordenadas por urgencia"
              />

              <button
                type="button"
                className="text-action"
                onClick={() => navigate('tasks')}
              >
                Todas las tareas
                <ArrowRight size={15} />
              </button>
            </div>

            {importantTasks.length === 0 ? (
              <div className="nexo-home-empty">
                <CheckCircle2 size={20} />
                No tenés tareas pendientes.
              </div>
            ) : (
              <div className="nexo-home-task-list">
                {importantTasks.map((task) => {
                  const deal = data.deals.find(
                    (item) => item.id === task.dealId,
                  );

                  const company = data.companies.find(
                    (item) => item.id === deal?.companyId,
                  );

                  const isLate = overdue(task.dueDate);
                  const isToday = todayDue(task.dueDate);

                  return (
                    <div
                      className="nexo-home-task"
                      key={task.id}
                    >
                      <button
                        type="button"
                        className="nexo-home-check"
                        aria-label={`Completar tarea: ${task.title}`}
                        title="Marcar como completada"
                        onClick={() => toggleTask(task.id)}
                      >
                        <CheckCircle2 size={19} />
                      </button>

                      <div className="nexo-home-task-text">
                        <strong>{task.title}</strong>
                        <small>
                          {company?.name ||
                            deal?.title ||
                            'Tarea general'}
                        </small>
                      </div>

                      <span
                        className={`nexo-home-date ${
                          isLate
                            ? 'is-late'
                            : isToday
                              ? 'is-today'
                              : ''
                        }`}
                      >
                        {isLate ? (
                          <CircleAlert size={13} />
                        ) : (
                          <Clock3 size={13} />
                        )}

                        {isLate
                          ? 'Vencida'
                          : isToday
                            ? 'Hoy'
                            : task.dueDate
                              ? fmtDate(task.dueDate)
                              : 'Sin fecha'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel nexo-home-panel">
            <div className="panel-heading">
              <SectionTitle
                icon={<GitBranch size={18} />}
                title="Negocios que estás trabajando"
                description="Oportunidades abiertas con fecha de cierre más próxima"
              />

              <button
                type="button"
                className="text-action"
                onClick={() => navigate('deals')}
              >
                Ver Pipeline
                <ArrowRight size={15} />
              </button>
            </div>

            {relevantDeals.length === 0 ? (
              <div className="nexo-home-empty">
                Todavía no hay oportunidades abiertas.
              </div>
            ) : (
              <div className="nexo-home-deals">
                {relevantDeals.map((deal) => {
                  const company = data.companies.find(
                    (item) => item.id === deal.companyId,
                  );

                  return (
                    <button
                      className="nexo-home-deal"
                      type="button"
                      key={deal.id}
                      onClick={() => editDeal(deal)}
                    >
                      <span className="nexo-home-deal-main">
                        <strong>{deal.title}</strong>
                        <small>
                          {company?.name ||
                            'Sin empresa vinculada'}
                        </small>
                      </span>

                      <StageBadge stage={deal.stage} />

                      <strong className="nexo-home-deal-amount">
                        {money(deal.amount, currency, true)}
                      </strong>

                      <ArrowRight
                        size={15}
                        className="nexo-home-deal-arrow"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel forecast-panel nexo-home-panel">
            <div className="panel-heading">
              <SectionTitle
                icon={<TrendingUp size={18} />}
                title="Proyección comercial"
                description="Estimaciones según fechas previstas de cierre"
              />

              <RevenueLegend />
            </div>

            <ForecastChart height={180} />

            <p className="nexo-home-chart-note">
              Los importes representan oportunidades;
              no necesariamente pagos recibidos.
            </p>
          </section>
        </div>

        <aside className="dashboard-side">
          <section className="panel nexo-home-panel">
            <div className="panel-heading">
              <SectionTitle
                icon={<GitBranch size={18} />}
                title="Pipeline, de un vistazo"
                description="En qué etapa están tus negocios"
              />
            </div>

            <div className="nexo-home-stages">
              {STAGES.filter(
                (stage) =>
                  stage.id !== 'ganado' &&
                  stage.id !== 'perdido',
              ).map((stage) => {
                const count = openDeals.filter(
                  (deal) => deal.stage === stage.id,
                ).length;

                const percent = openDeals.length
                  ? Math.round(
                      (count / openDeals.length) * 100,
                    )
                  : 0;

                return (
                  <div
                    className="nexo-home-stage"
                    key={stage.id}
                  >
                    <div>
                      <span>{stage.label}</span>
                      <strong>{count}</strong>
                    </div>

                    <div className="nexo-home-stage-track">
                      <span
                        style={{
                          background: stage.color,
                          width: `${percent}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              className="nexo-home-panel-link"
              type="button"
              onClick={() => navigate('deals')}
            >
              Abrir el tablero de ventas
              <ArrowRight size={15} />
            </button>
          </section>

          <section className="panel nexo-home-panel">
            <div className="panel-heading">
              <SectionTitle
                icon={<ActivityIcon size={18} />}
                title="Últimos movimientos"
                description="Qué cambió recientemente en NEXO"
              />
            </div>

            {data.activities.length === 0 ? (
              <div className="nexo-home-empty">
                Todavía no hay movimientos registrados.
              </div>
            ) : (
              <div className="nexo-home-activity-list">
                {[...data.activities]
                  .sort((a, b) =>
                    b.createdAt.localeCompare(a.createdAt),
                  )
                  .slice(0, 5)
                  .map((item) => (
                    <div
                      className="nexo-home-activity"
                      key={item.id}
                    >
                      <span className="nexo-home-activity-dot" />

                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                        <span>
                          {fmtDateTime(item.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <button
              className="nexo-home-panel-link"
              type="button"
              onClick={() => navigate('activity')}
            >
              Ver todo el historial
              <ArrowRight size={15} />
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
