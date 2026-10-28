
import type { Deal, Stage } from '../types';
import { STAGES } from '../types';

export interface ReportMetrics {
  openCount: number;
  closedCount: number;
  wonCount: number;
  lostCount: number;
  openValue: number;
  weightedOpenValue: number;
  wonValue: number;
  closeRate: number | null;
}

export interface StageBreakdown {
  stage: Stage;
  label: string;
  color: string;
  count: number;
  value: number;
  weightedOpenValue: number;
  closed: boolean;
}

const isOpen = (deal: Deal) =>
  deal.stage !== 'ganado' && deal.stage !== 'perdido';

/** Los importes son valores de oportunidades, nunca cobros confirmados. */
export function calculateReportMetrics(deals: Deal[]): ReportMetrics {
  const open = deals.filter(isOpen);
  const won = deals.filter((deal) => deal.stage === 'ganado');
  const lost = deals.filter((deal) => deal.stage === 'perdido');
  const closedCount = won.length + lost.length;

  return {
    openCount: open.length,
    closedCount,
    wonCount: won.length,
    lostCount: lost.length,
    openValue: open.reduce((sum, deal) => sum + deal.amount, 0),
    weightedOpenValue: open.reduce(
      (sum, deal) => sum + deal.amount * deal.probability / 100,
      0,
    ),
    wonValue: won.reduce((sum, deal) => sum + deal.amount, 0),
    closeRate: closedCount
      ? Math.round((won.length / closedCount) * 100)
      : null,
  };
}

export function getStageBreakdown(deals: Deal[]): StageBreakdown[] {
  return STAGES.map((stage) => {
    const items = deals.filter((deal) => deal.stage === stage.id);
    const closed = stage.id === 'ganado' || stage.id === 'perdido';

    return {
      stage: stage.id,
      label: stage.label,
      color: stage.color,
      count: items.length,
      value: items.reduce((sum, deal) => sum + deal.amount, 0),
      weightedOpenValue: closed
        ? 0
        : items.reduce(
            (sum, deal) => sum + deal.amount * deal.probability / 100,
            0,
          ),
      closed,
    };
  });
}
