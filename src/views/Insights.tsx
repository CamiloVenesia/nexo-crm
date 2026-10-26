
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  ChartColumn,
  GitBranch,
  Lightbulb,
  Target,
  TrendingUp,
} from 'lucide-react';

import { useCRM } from '../lib/store';

import {
  ForecastChart,
  PerformanceRing,
  RevenueLegend,
  StageBarChart,
} from '../components/Charts';

import { PageHeading, SectionTitle, Tag } from '../components/Shared';

import {
  money,
  openDeals,
  overdue,
  pipelineValue,
  weightedValue,
} from '../lib/utils';

export function Insights() {
  const { data } = useCRM();

  const active = openDeals(data.deals);

  const won = data.deals.filter(
    (d) => d.stage === 'ganado',
  );

  const lost = data.deals.filter(
    (d) => d.stage === 'perdido',
  );

  const allClosed = won.length + lost.length;

  const rate = allClosed
    ? Math.round((won.length / allClosed) * 100)
    : 0;

  const lateTasks = data.tasks.filter(
    (t) => !t.done && overdue(t.dueDate),
  );

  const lateDeals = active.filter(
    (d) => overdue(d.dueDate),
  );

  return (
    <>
      <PageHeading
        eyebrow="INTELIGENCIA / REPORTES"
        title="Analítica comercial"
        subtitle="Convertí los datos de tus ventas en decisiones claras."
      />

      <div className="insight-kpis">
        <div className="metric-card">
          <span>
            <GitBranch size={17} />
            Pipeline abierto
          </span>

          <strong>
            {money(
              pipelineValue(data.deals),
              data.settings.currency,
              true,
            )}
          </strong>

          <small>{active.length} oportunidades activas</small>
        </div>

        <div className="metric-card">
          <span>
            <Target size={17} />
            Proyección ponderada
          </span>

          <strong>
            {money(
              weightedValue(data.deals),
              data.settings.currency,
              true,
            )}
          </strong>

          <small>Importe × probabilidad de cierre</small>
        </div>

        <div className="metric-card">
          <span>
            <BadgeCheck size={17} />
            Tasa de cierre
          </span>

          <strong>{rate}%</strong>

          <small>
            {won.length} ganadas / {allClosed} cerradas
          </small>
        </div>

        <div className="metric-card">
          <span>
            <TrendingUp size={17} />
            Ingreso ganado
          </span>

          <strong>
            {money(
              won.reduce((n, d) => n + d.amount, 0),
              data.settings.currency,
              true,
            )}
          </strong>

          <small>Operaciones marcadas como ganadas</small>
        </div>
      </div>

      <div className="insights-grid">
        <div className="panel">
          <div className="panel-heading">
            <SectionTitle
              icon={<TrendingUp size={18} />}
              title="Ingresos previstos y ganados"
              description="Basado en importes, etapas y fechas de cierre"
            />

            <RevenueLegend />
          </div>

          <ForecastChart height={290} />
        </div>

        <div className="panel">
          <SectionTitle
            icon={<ChartColumn size={18} />}
            title="Valor por etapa"
            description="Distribución del pipeline en todas sus fases"
          />

          <StageBarChart />
        </div>
      </div>

      <div className="insights-grid secondary-insights">
        <div className="panel">
          <SectionTitle
            icon={<Lightbulb size={18} />}
            title="Recomendaciones útiles"
            description="Alertas automáticas basadas en tus propios registros"
          />

          <div className="recommend-list">
            <div className="recommend">
              <span className="recommend-icon orange">
                <AlertCircle size={18} />
              </span>

              <div>
                <strong>
                  {lateTasks.length
                    ? `${lateTasks.length} tarea(s) vencida(s)`
                    : 'Buen ritmo de seguimiento'}
                </strong>

                <p>
                  {lateTasks.length
                    ? 'Conviene contactar primero a estos clientes para no perder oportunidades.'
                    : 'No hay tareas vencidas. Seguí registrando tus próximos pasos.'}
                </p>
              </div>
            </div>

            <div className="recommend">
              <span className="recommend-icon blue">
                <Target size={18} />
              </span>

              <div>
                <strong>
                  {lateDeals.length
                    ? `${lateDeals.length} fecha(s) de cierre superada(s)`
                    : 'Fechas de cierre actualizadas'}
                </strong>

                <p>
                  {lateDeals.length
                    ? 'Revisá la fecha estimada de estas oportunidades y registrá una acción.'
                    : 'Las oportunidades en curso tienen fechas futuras.'}
                </p>
              </div>
            </div>

            <div className="recommend">
              <span className="recommend-icon green">
                <ArrowUpRight size={18} />
              </span>

              <div>
                <strong>Una acción concreta por venta</strong>

                <p>
                  El próximo paso debería estar anotado en cada
                  oportunidad importante.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="panel insight-health">
          <SectionTitle
            icon={<BadgeCheck size={18} />}
            title="Indicador de actividad"
            description="Escala orientativa, no un pronóstico estadístico"
          />

          <PerformanceRing size={200} />

          <div className="health-legend">
            <Tag tone="green">
              {won.length} ganadas
            </Tag>

            <Tag tone="purple">
              {active.length} abiertas
            </Tag>

            <Tag tone="red">
              {lateTasks.length} seguimientos vencidos
            </Tag>
          </div>
        </div>
      </div>

      <div className="hint-row">
        Los informes se recalculan con tus datos de prueba.
        El radar usa reglas transparentes; no está conectado
        a un modelo de inteligencia artificial.
      </div>
    </>
  );
}
