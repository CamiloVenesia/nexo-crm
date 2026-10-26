
import { describe, expect, it } from 'vitest';

import {
  assertData,
  overdue,
  pipelineValue,
  weightedValue,
  openDeals,
  stageById,
  money,
} from './utils';

import { seedDemo } from './seed';

describe('NEXO CRM / cálculos', () => {
  const data = seedDemo();

  it('solo considera oportunidades abiertas en el pipeline', () => {
    const deals = openDeals(data.deals);

    expect(
      deals.every(
        (deal) =>
          deal.stage !== 'ganado' &&
          deal.stage !== 'perdido',
      ),
    ).toBe(true);

    expect(pipelineValue(data.deals)).toBe(
      deals.reduce(
        (total, deal) => total + deal.amount,
        0,
      ),
    );
  });

  it('la proyección ponderada usa probabilidad por importe', () => {
    expect(weightedValue(data.deals)).toBeCloseTo(
      openDeals(data.deals).reduce(
        (total, deal) =>
          total +
          (deal.amount * deal.probability) / 100,
        0,
      ),
    );
  });

  it('la etapa ganada tiene 100% de probabilidad por defecto', () => {
    expect(stageById('ganado').probability).toBe(100);
  });

  it('detecta vencimiento de fechas pasadas', () => {
    expect(overdue('2020-01-01')).toBe(true);
    expect(overdue('2999-01-01')).toBe(false);
  });

  it('da formato de dinero argentino', () => {
    expect(money(15500, 'ARS')).toContain('15.500');
  });

  it('permite restaurar los datos de la aplicación', () => {
    expect(assertData(data).deals).toHaveLength(
      data.deals.length,
    );
  });

  it('rechaza respaldos que no son de NEXO', () => {
    expect(() =>
      assertData({
        version: 2,
        deals: [],
      }),
    ).toThrow();
  });
});
