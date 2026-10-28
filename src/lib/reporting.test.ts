
import { describe, expect, it } from 'vitest';
import type { Deal, Stage } from '../types';
import { calculateReportMetrics, getStageBreakdown } from './reporting';

function deal(id: string, stage: Stage, amount: number, probability: number): Deal {
  return {
    id,
    title: `Oportunidad ${id}`,
    companyId: '',
    contactId: '',
    amount,
    stage,
    probability,
    owner: 'Equipo',
    dueDate: '2026-12-01',
    notes: '',
    createdAt: '2026-10-01T12:00:00Z',
    updatedAt: '2026-10-01T12:00:00Z',
  };
}

const deals = [
  deal('a', 'prospeccion', 1000, 20),
  deal('b', 'propuesta', 2000, 60),
  deal('c', 'ganado', 3000, 100),
  deal('d', 'perdido', 4000, 0),
];

describe('NEXO CRM / métricas de reportes', () => {
  it('cuenta únicamente oportunidades abiertas en el pipeline', () => {
    const summary = calculateReportMetrics(deals);
    expect(summary.openCount).toBe(2);
    expect(summary.openValue).toBe(3000);
  });

  it('pondera únicamente las oportunidades abiertas', () => {
    expect(calculateReportMetrics(deals).weightedOpenValue).toBe(1400);
  });

  it('distingue ventas ganadas de importe cobrado', () => {
    const summary = calculateReportMetrics(deals);
    expect(summary.wonCount).toBe(1);
    expect(summary.wonValue).toBe(3000);
  });

  it('calcula la tasa sobre oportunidades cerradas', () => {
    expect(calculateReportMetrics(deals).closeRate).toBe(50);
  });

  it('no inventa una tasa si no existen oportunidades cerradas', () => {
    expect(calculateReportMetrics(deals.slice(0, 2)).closeRate).toBeNull();
  });

  it('conserva las seis etapas incluso cuando no tienen movimientos', () => {
    const rows = getStageBreakdown([]);
    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row.count === 0 && row.value === 0)).toBe(true);
  });

  it('no incluye etapas cerradas en la proyección', () => {
    const rows = getStageBreakdown(deals);
    expect(rows.find((row) => row.stage === 'ganado')?.weightedOpenValue).toBe(0);
    expect(rows.find((row) => row.stage === 'perdido')?.weightedOpenValue).toBe(0);
  });

  it('mantiene el orden original de los registros', () => {
    const ids = deals.map((item) => item.id);
    calculateReportMetrics(deals);
    getStageBreakdown(deals);
    expect(deals.map((item) => item.id)).toEqual(ids);
  });
});
