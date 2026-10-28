
import { useState } from 'react';

import { useCRM } from '../lib/store';
import { niceChartMaximum } from '../lib/chartScale';
import { money, openDeals } from '../lib/utils';
import { STAGES } from '../types';

type ChartPoint = [number, number];

// ============================================
// DATOS MENSUALES
// ============================================

function useDataChart() {
  const { data } = useCRM();
  const now = new Date();

  return Array.from({ length: 8 }, (_, index) => {
    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth() + index - 5,
      1,
    );

    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();

    const inMonth = (date: string) => {
      if (!date) return false;

      const parsed = new Date(
        `${date.slice(0, 10)}T12:00:00`,
      );

      return (
        Number.isFinite(parsed.getTime()) &&
        parsed.getFullYear() === year &&
        parsed.getMonth() === month
      );
    };

    const monthlyDeals = data.deals.filter(
      (deal) => inMonth(deal.dueDate),
    );

    return {
      label: monthStart.toLocaleDateString(
        'es-AR',
        { month: 'short' },
      ),

      // Proyección: solamente oportunidades abiertas.
      // Se ponderan por su probabilidad.

      forecast: monthlyDeals
        .filter(
          (deal) =>
            deal.stage !== 'ganado' &&
            deal.stage !== 'perdido',
        )
        .reduce(
          (sum, deal) =>
            sum +
            (deal.amount * deal.probability) / 100,
          0,
        ),

      // Valor de oportunidades ganadas.
      // No representa necesariamente dinero cobrado.

      won: monthlyDeals
        .filter(
          (deal) =>
            deal.stage === 'ganado',
        )
        .reduce(
          (sum, deal) =>
            sum + deal.amount,
          0,
        ),
    };
  });
}

// ============================================
// CURVAS SUAVES
// ============================================

function smoothPath(points: ChartPoint[]) {
  if (!points.length) return '';

  return points.reduce(
    (path, point, index) => {
      if (index === 0) {
        return `M ${point[0]} ${point[1]}`;
      }

      const previous = points[index - 1];

      const middle =
        (previous[0] + point[0]) / 2;

      return (
        `${path} C ${middle} ${previous[1]}, ` +
        `${middle} ${point[1]}, ` +
        `${point[0]} ${point[1]}`
      );
    },
    '',
  );
}

// ============================================
// FORMATO MONETARIO DEL EJE VERTICAL
// ============================================

function axisMoney(
  value: number,
  currency: 'ARS' | 'USD',
) {
  if (Math.abs(value) >= 1000) {
    return money(value, currency, true);
  }

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,

    maximumFractionDigits:
      Math.abs(value) < 1 && value !== 0
        ? 2
        : 0,
  }).format(value);
}

// ============================================
// PROYECCIÓN COMERCIAL
// ============================================

export function ForecastChart({
  height = 220,
}: {
  height?: number;
}) {
  const values = useDataChart();
  const { data } = useCRM();

  const [hovered, setHovered] = useState<
    number | null
  >(null);

  const W = 760;
  const H = 215;

  const LEFT = 88;
  const RIGHT = 18;
  const TOP = 18;
  const BOTTOM = 33;

  // ==========================================
  // ESCALA DINÁMICA
  // ==========================================

  const maximum = Math.max(
    0,
    ...values.flatMap(
      (point) => [
        point.won,
        point.forecast,
      ],
    ),
  );

  const scaleMax = niceChartMaximum(
    values.flatMap(
      (point) => [
        point.won,
        point.forecast,
      ],
    ),
  );

  const hasValues = maximum > 0;

  const x = (index: number) =>
    LEFT +
    (index * (W - LEFT - RIGHT)) /
      (values.length - 1);

  const y = (amount: number) =>
    TOP +
    (H - TOP - BOTTOM) *
      (1 - amount / scaleMax);

  // ==========================================
  // PUNTOS DE CADA SERIE
  // ==========================================

  const forecastPoints = values.map(
    (point, index) =>
      [
        x(index),
        y(point.forecast),
      ] as ChartPoint,
  );

  const wonPoints = values.map(
    (point, index) =>
      [
        x(index),
        y(point.won),
      ] as ChartPoint,
  );

  const area = (points: ChartPoint[]) =>
    `${smoothPath(points)} ` +
    `L ${x(values.length - 1)} ${H - BOTTOM} ` +
    `L ${LEFT} ${H - BOTTOM} Z`;

  // ==========================================
  // GRÁFICO
  // ==========================================

  return (
    <div
      className="custom-chart"
      style={{ height }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        role="img"
        aria-label={`Valor ponderado de oportunidades abiertas y valor de oportunidades ganadas por mes, en ${data.settings.currency}, según fecha estimada de cierre`}
        preserveAspectRatio="none"
      >
        {/* DEGRADADOS Y BRILLOS ORIGINALES */}

        <defs>
          <linearGradient
            id="blue-area"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#478bff"
              stopOpacity=".37"
            />

            <stop
              offset="100%"
              stopColor="#478bff"
              stopOpacity="0"
            />
          </linearGradient>

          <linearGradient
            id="violet-area"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#a179ff"
              stopOpacity=".24"
            />

            <stop
              offset="100%"
              stopColor="#a179ff"
              stopOpacity="0"
            />
          </linearGradient>

          <filter
            id="line-glow"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur
              stdDeviation="3"
              result="blur"
            />

            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ====================================
            EJE VERTICAL ADAPTADO A LA MONEDA
        ==================================== */}

        {Array.from(
          { length: 5 },
          (_, index) => {
            const value =
              (scaleMax * (4 - index)) / 4;

            const py = y(value);

            return (
              <g key={index}>
                <line
                  x1={LEFT}
                  x2={W - RIGHT}
                  y1={py}
                  y2={py}
                  stroke="#28395b"
                  strokeDasharray="4 5"
                  strokeWidth="1"
                />

                <text
                  x={LEFT - 10}
                  y={py + 4}
                  textAnchor="end"
                  fill="#8192b3"
                  fontSize="11"
                >
                  {axisMoney(
                    value,
                    data.settings.currency,
                  )}
                </text>
              </g>
            );
          },
        )}

        {/* MESES */}

        {values.map(
          (point, index) => (
            <text
              key={index}
              x={x(index)}
              y={H - 10}
              textAnchor="middle"
              fill="#8192b3"
              fontSize="11"
              style={{
                textTransform: 'capitalize',
              }}
            >
              {point.label}
            </text>
          ),
        )}

        {/* ====================================
            CURVAS
        ==================================== */}

        {hasValues ? (
          <>
            {/* RELLENO AZUL */}

            <path
              d={area(forecastPoints)}
              fill="url(#blue-area)"
            />

            {/* RELLENO VIOLETA */}

            <path
              d={area(wonPoints)}
              fill="url(#violet-area)"
            />

            {/* PROYECCIÓN ABIERTA */}

            <path
              d={smoothPath(forecastPoints)}
              stroke="#579bff"
              strokeWidth="2.4"
              fill="none"
              filter="url(#line-glow)"
            />

            {/* VENTAS GANADAS */}

            <path
              d={smoothPath(wonPoints)}
              stroke="#a27bff"
              strokeWidth="2.2"
              fill="none"
            />
          </>
        ) : (
          <text
            x={W / 2}
            y={H / 2}
            textAnchor="middle"
            fill="#a1b2d2"
            fontSize="12"
          >
            Sin importes con cierre estimado en estos meses
          </text>
        )}

        {/* ====================================
            MARCADOR DEL MES SELECCIONADO
        ==================================== */}

        {hovered !== null && hasValues && (
          <>
            <line
              x1={x(hovered)}
              x2={x(hovered)}
              y1={TOP}
              y2={H - BOTTOM}
              stroke="#b6d3ff"
              opacity=".43"
              strokeDasharray="3 5"
            />

            <circle
              cx={x(hovered)}
              cy={y(
                values[hovered].forecast,
              )}
              r="5"
              fill="#589aff"
              stroke="#dfeaff"
              strokeWidth="2"
            />

            <circle
              cx={x(hovered)}
              cy={y(
                values[hovered].won,
              )}
              r="5"
              fill="#a27bff"
              stroke="#dfeaff"
              strokeWidth="2"
            />
          </>
        )}

        {/* ÁREAS INTERACTIVAS */}

        {values.map(
          (point, index) => (
            <rect
              key={`${point.label}-${index}`}
              x={
                x(index) -
                (W - LEFT - RIGHT) /
                  values.length /
                  2
              }
              y={TOP}
              width={
                (W - LEFT - RIGHT) /
                values.length
              }
              height={H - TOP - BOTTOM}
              fill="transparent"
              onMouseEnter={() =>
                setHovered(index)
              }
              onMouseLeave={() =>
                setHovered(null)
              }
            >
              <title>
                {`${point.label} · Abiertas ponderadas: ${money(
                  point.forecast,
                  data.settings.currency,
                )} · Ganadas: ${money(
                  point.won,
                  data.settings.currency,
                )}`}
              </title>
            </rect>
          ),
        )}
      </svg>

      {/* TOOLTIP ORIGINAL, CON TÍTULOS CLAROS */}

      {hovered !== null && hasValues && (
        <div
          className="chart-hover"
          aria-live="polite"
        >
          <strong>
            {values[hovered].label}
          </strong>

          <span>
            <i className="blue-dot" />

            Abiertas{' '}
            {money(
              values[hovered].forecast,
              data.settings.currency,
            )}
          </span>

          <span>
            <i className="violet-dot" />

            Ganadas{' '}
            {money(
              values[hovered].won,
              data.settings.currency,
            )}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================
// GRÁFICO DE BARRAS POR ETAPA
// ============================================

export function StageBarChart() {
  const { data } = useCRM();

  const bars = STAGES.map(
    (stage) => ({
      name: stage.label,

      value: data.deals
        .filter(
          (deal) =>
            deal.stage === stage.id,
        )
        .reduce(
          (sum, deal) =>
            sum + deal.amount,
          0,
        ),

      color: stage.color,
    }),
  );

  const max = Math.max(
    1,
    ...bars.map((bar) => bar.value),
  );

  return (
    <div
      className="stage-chart"
      role="img"
      aria-label="Importes acumulados por las seis etapas comerciales"
    >
      {bars.map((bar) => (
        <div
          className="stage-chart-row"
          key={bar.name}
        >
          <span>{bar.name}</span>

          <div>
            <div
              style={{
                width: `${Math.max(
                  0,
                  (bar.value / max) * 100,
                )}%`,

                background:
                  `linear-gradient(90deg, ` +
                  `${bar.color}80, ${bar.color})`,
              }}
            />
          </div>

          <strong>
            {money(
              bar.value,
              data.settings.currency,
              true,
            )}
          </strong>
        </div>
      ))}
    </div>
  );
}

// ============================================
// LEYENDA DEL GRÁFICO
// ============================================

export function RevenueLegend() {
  return (
    <div className="chart-legend">
      <span>
        <i className="blue-dot" />
        Abiertas ponderadas
      </span>

      <span>
        <i className="violet-dot" />
        Ganadas
      </span>
    </div>
  );
}

// ============================================
// INDICADOR DE ACTIVIDAD COMERCIAL
// ============================================

export function PerformanceRing({
  size = 178,
}: {
  size?: number;
}) {
  const { data } = useCRM();

  const won = data.deals.filter(
    (deal) =>
      deal.stage === 'ganado',
  ).length;

  const closed = data.deals.filter(
    (deal) =>
      [
        'ganado',
        'perdido',
      ].includes(deal.stage),
  ).length;

  const rate = closed
    ? Math.round(
        (won / closed) * 100,
      )
    : 0;

  const incomplete = data.tasks.filter(
    (task) => !task.done,
  ).length;

  const active = openDeals(
    data.deals,
  ).length;

  const score = Math.min(
    99,
    Math.max(
      0,
      Math.round(
        rate * 0.48 +
          Math.min(active, 12) * 1.8 +
          Math.max(0, 10 - incomplete) * 2.5 +
          18,
      ),
    ),
  );

  return (
    <div
      className="ring-outer"
      style={{
        width: size,
        height: size,
      }}
    >
      <div
        className="ring-circle"
        style={{
          background:
            `conic-gradient(` +
            `#5c91ff 0%, ` +
            `#9a62fb ${score}%, ` +
            `#28365e ${score}%, ` +
            `#28365e 100%)`,
        }}
      >
        <div className="ring-inner">
          <strong>
            {score}
            <small>/100</small>
          </strong>

          <span>
            <i />
            Pulso comercial
          </span>
        </div>
      </div>
    </div>
  );
}
