
import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  ChartColumn,
  Download,
  GitBranch,
  Lightbulb,
  Search,
  Target,
  TrendingUp,
} from 'lucide-react';

import { useCRM } from '../lib/store';
import { calculateReportMetrics, getStageBreakdown } from '../lib/reporting';
import {
  csvDownload,
  fmtDate,
  money,
  overdue,
} from '../lib/utils';
import type { Stage } from '../types';
import { STAGES } from '../types';
import {
  ForecastChart,
  PerformanceRing,
  RevenueLegend,
  StageBarChart,
} from '../components/Charts';
import {
  PageHeading,
  SectionTitle,
  StageBadge,
  Tag,
} from '../components/Shared';

import './insights-detail.css';

type StageFilter = 'all' | Stage;
const PAGE_SIZE = 8;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR')
    .trim();
}

export function Insights() {
  const { data, notify } = useCRM();
  const currency = data.settings.currency;

  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const metrics = useMemo(
    () => calculateReportMetrics(data.deals),
    [data.deals],
  );

  const breakdown = useMemo(
    () => getStageBreakdown(data.deals),
    [data.deals],
  );

  const lateTasks = data.tasks.filter(
    (task) => !task.done && overdue(task.dueDate),
  );

  const lateDeals = data.deals.filter(
    (deal) =>
      deal.stage !== 'ganado' &&
      deal.stage !== 'perdido' &&
      overdue(deal.dueDate),
  );

  // La tabla verifica las cifras sin alterar los datos originales.
  const filteredDeals = useMemo(() => {
    const query = normalize(search);

    return data.deals
      .filter((deal) => {
        if (stageFilter !== 'all' && deal.stage !== stageFilter) {
          return false;
        }

        const company = data.companies.find(
          (item) => item.id === deal.companyId,
        )?.name ?? '';

        return normalize(
          `${deal.title} ${deal.owner} ${company}`,
        ).includes(query);
      })
      .sort((a, b) => {
        const aDate = a.dueDate || '9999-12-31';
        const bDate = b.dueDate || '9999-12-31';
        return aDate.localeCompare(bDate) || a.title.localeCompare(b.title, 'es-AR');
      });
  }, [data.deals, data.companies, stageFilter, search]);

  const shown = filteredDeals.slice(0, visibleCount);
  const filteredValue = filteredDeals.reduce(
    (sum, deal) => sum + deal.amount,
    0,
  );

  const changeStageFilter = (next: StageFilter) => {
    setStageFilter(next);
    setVisibleCount(PAGE_SIZE);
  };

  const exportCsv = () => {
    csvDownload('nexo-reporte-oportunidades.csv', [
      [
        'Oportunidad',
        'Empresa',
        'Etapa',
        'Importe',
        'Moneda',
        'Probabilidad (%)',
        'Proyección abierta',
        'Responsable',
        'Cierre estimado',
      ],
      ...filteredDeals.map((deal) => {
        const company = data.companies.find(
          (item) => item.id === deal.companyId,
        )?.name ?? '';

        const isOpen = deal.stage !== 'ganado' && deal.stage !== 'perdido';

        return [
          deal.title,
          company,
          STAGES.find((stage) => stage.id === deal.stage)?.label ?? deal.stage,
          deal.amount,
          currency,
          deal.probability,
          isOpen ? deal.amount * deal.probability / 100 : 0,
          deal.owner,
          deal.dueDate,
        ];
      }),
    ]);

    notify('Reporte exportado a CSV');
  };

  return (
    <>
      <PageHeading
        eyebrow="INTELIGENCIA / REPORTES"
        title="Analítica comercial"
        subtitle="Indicadores claros, oportunidades verificables y reportes basados en tus registros."
      />

      {/* Conservamos las cuatro tarjetas del diseño original. */}
      <div className="insight-kpis">
        <div className="metric-card">
          <span>
            <GitBranch size={17} />
            Pipeline abierto
          </span>
          <strong>{money(metrics.openValue, currency, true)}</strong>
          <small>{metrics.openCount} oportunidades abiertas · {currency}</small>
        </div>

        <div className="metric-card">
          <span>
            <Target size={17} />
            Proyección ponderada
          </span>
          <strong>{money(metrics.weightedOpenValue, currency, true)}</strong>
          <small>Importe abierto × probabilidad · {currency}</small>
        </div>

        <div className="metric-card">
          <span>
            <BadgeCheck size={17} />
            Tasa de cierre
          </span>
          <strong>
            {metrics.closeRate === null ? '—' : `${metrics.closeRate}%`}
          </strong>
          <small>
            {metrics.wonCount} ganadas de {metrics.closedCount} cerradas
          </small>
        </div>

        <div className="metric-card">
          <span>
            <TrendingUp size={17} />
            Valor de ventas ganadas
          </span>
          <strong>{money(metrics.wonValue, currency, true)}</strong>
          <small>Oportunidades ganadas; no equivale a cobros</small>
        </div>
      </div>

      {/* Los gráficos existentes mantienen su diseño y funcionamiento. */}
      <div className="insights-grid">
        <div className="panel">
          <div className="panel-heading">
            <SectionTitle
              icon={<TrendingUp size={18} />}
              title="Evolución por fecha estimada"
              description="Valores esperados y oportunidades ganadas, agrupados por mes"
            />
            <RevenueLegend />
          </div>
          <ForecastChart height={290} />
          <p className="report-chart-note">
            El gráfico utiliza fechas estimadas de cierre, incluso para ventas
            ganadas. No registra fechas efectivas de cobro.
          </p>
        </div>

        <div className="panel">
          <SectionTitle
            icon={<ChartColumn size={18} />}
            title="Valor por etapa"
            description="Distribución de importes por fase comercial"
          />
          <StageBarChart />
        </div>
      </div>

      <div className="insights-grid secondary-insights">
        <div className="panel">
          <SectionTitle
            icon={<Lightbulb size={18} />}
            title="Recomendaciones útiles"
            description="Alertas basadas en tareas y fechas de cierre"
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
                    : 'Seguimientos al día'}
                </strong>
                <p>
                  {lateTasks.length
                    ? 'Revisá las tareas pendientes para evitar seguimientos olvidados.'
                    : 'No hay tareas vencidas registradas.'}
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
                    ? `${lateDeals.length} cierre(s) estimado(s) vencido(s)`
                    : 'Fechas de cierre actualizadas'}
                </strong>
                <p>
                  {lateDeals.length
                    ? 'Revisá las oportunidades abiertas que superaron su fecha prevista.'
                    : 'No hay oportunidades abiertas con fecha estimada vencida.'}
                </p>
              </div>
            </div>
            <div className="recommend">
              <span className="recommend-icon green">
                <ArrowUpRight size={18} />
              </span>
              <div>
                <strong>Una acción concreta por oportunidad</strong>
                <p>
                  Vinculá tareas a las negociaciones importantes para conservar
                  el contexto del próximo paso.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="panel insight-health">
          <SectionTitle
            icon={<BadgeCheck size={18} />}
            title="Indicador de actividad"
            description="Puntuación orientativa basada en reglas, no un pronóstico"
          />
          <PerformanceRing size={200} />
          <div className="health-legend">
            <Tag tone="green">{metrics.wonCount} ganadas</Tag>
            <Tag tone="purple">{metrics.openCount} abiertas</Tag>
            <Tag tone="red">{lateTasks.length} tareas vencidas</Tag>
          </div>
        </div>
      </div>

      {/* NUEVO: desglose auditables de las cifras del CRM. */}
      <section className="panel report-detail-panel" aria-label="Desglose comercial">
        <div className="report-detail-header">
          <SectionTitle
            icon={<GitBranch size={18} />}
            title="Desglose de oportunidades"
            description="Consultá los registros detrás de los importes y exportá el resultado"
          />
          <button
            type="button"
            className="btn btn-outline"
            onClick={exportCsv}
          >
            <Download size={15} />
            Exportar CSV
          </button>
        </div>

        <div className="report-stage-filters" aria-label="Filtrar oportunidades por etapa">
          <button
            type="button"
            className={`report-stage-button ${stageFilter === 'all' ? 'active' : ''}`}
            aria-pressed={stageFilter === 'all'}
            onClick={() => changeStageFilter('all')}
          >
            Todas <span>{data.deals.length}</span>
          </button>
          {breakdown.map((stage) => (
            <button
              key={stage.stage}
              type="button"
              className={`report-stage-button ${stageFilter === stage.stage ? 'active' : ''}`}
              aria-pressed={stageFilter === stage.stage}
              onClick={() => changeStageFilter(stage.stage)}
              title={`${stage.label}: ${money(stage.value, currency)}`}
            >
              <i style={{ background: stage.color }} aria-hidden="true" />
              {stage.label}
              <span>{stage.count}</span>
            </button>
          ))}
        </div>

        <div className="report-detail-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              type="search"
              aria-label="Buscar oportunidades en reportes"
              placeholder="Buscar por oportunidad, empresa o responsable..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
            />
          </div>
          <div className="report-detail-summary">
            <strong>{filteredDeals.length}</strong> registros ·{' '}
            <strong>{money(filteredValue, currency, true)}</strong> en importes
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table report-detail-table">
            <thead>
              <tr>
                <th>Oportunidad</th>
                <th>Empresa</th>
                <th>Etapa</th>
                <th>Importe</th>
                <th>Probabilidad</th>
                <th>Cierre estimado</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((deal) => (
                <tr key={deal.id}>
                  <td>
                    <strong>{deal.title}</strong>
                    <small>{deal.owner}</small>
                  </td>
                  <td>
                    {data.companies.find((item) => item.id === deal.companyId)?.name ?? '—'}
                  </td>
                  <td><StageBadge stage={deal.stage} /></td>
                  <td className="money-cell">{money(deal.amount, currency)}</td>
                  <td>{deal.probability}%</td>
                  <td>{fmtDate(deal.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filteredDeals.length && (
          <p className="report-detail-empty">
            No hay oportunidades con estos filtros.
          </p>
        )}

        {shown.length < filteredDeals.length && (
          <div className="report-detail-more">
            <span>Mostrando {shown.length} de {filteredDeals.length}</span>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            >
              Mostrar más
            </button>
          </div>
        )}

        <p className="report-detail-footnote">
          El importe total filtrado suma oportunidades de todas las etapas, incluidas
          ganadas y perdidas; no representa ingresos ni dinero cobrado.
          El gráfico superior puede representar un subconjunto de las etapas,
          mientras que este desglose incluye las seis.
        </p>
      </section>

      <div className="hint-row">
        <Target size={15} />
        Los reportes se calculan con los datos guardados en el navegador.
        Cambiar ARS por USD en Configuración no convierte importes.
        Las proyecciones son orientativas y no deben interpretarse como cobros confirmados.
      </div>
    </>
  );
}
