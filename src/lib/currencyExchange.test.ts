
import {
  describe,
  expect,
  it,
} from 'vitest';

import { seedDemo } from './seed';

import type {
  Deal,
} from '../types';

import {
  applyExchangeRate,
  convertAmount,
  convertCRMData,
  getAppliedExchangeRate,
  parseDollarQuote,
  prepareDealAmount,
  validateFinancialData,
} from './currencyExchange';

const now =
  '2026-10-27T20:00:00.000Z';

const published =
  '2026-10-27T15:00:00.000Z';

const quote = {
  rate: 1560,
  updatedAt: published,
  source: 'DolarApi - dolar oficial vendedor' as const,
};

function exampleDeal(
  amount: number,
): Deal {
  const deal = seedDemo().deals[0];

  return {
    ...deal,
    amount,
  };
}

describe('NEXO CRM / precisión financiera', () => {
  it('convierte ambos sentidos y conserva centavos', () => {
    expect(
      convertAmount(
        1_560_000,
        'ARS',
        'USD',
        1560,
      ),
    ).toBe(1000);

    expect(
      convertAmount(
        1000,
        'USD',
        'ARS',
        1560,
      ),
    ).toBe(1_560_000);

    expect(
      convertAmount(
        10_000,
        'ARS',
        'USD',
        1560,
      ),
    ).toBe(6.41);

    expect(
      convertAmount(
        6.412,
        'USD',
        'USD',
        1560,
      ),
    ).toBe(6.412);
  });

  it('rechaza cotizaciones inválidas', () => {
    expect(() =>
      convertAmount(
        100,
        'ARS',
        'USD',
        0,
      ),
    ).toThrow();

    expect(() =>
      convertAmount(
        100,
        'ARS',
        'USD',
        NaN,
      ),
    ).toThrow();
  });

  it('valida origen y fecha de la API oficial', () => {
    expect(
      parseDollarQuote(
        {
          moneda: 'USD',
          casa: 'oficial',
          venta: 1560,
          fechaActualizacion: published,
        },
        Date.parse(now),
      ),
    ).toEqual(quote);

    expect(() =>
      parseDollarQuote(
        {
          moneda: 'USD',
          casa: 'blue',
          venta: 1560,
          fechaActualizacion: published,
        },
        Date.parse(now),
      ),
    ).toThrow();

    expect(() =>
      parseDollarQuote(
        {
          moneda: 'USD',
          casa: 'oficial',
          venta: 1560,
          fechaActualizacion:
            '2026-09-01T00:00:00Z',
        },
        Date.parse(now),
      ),
    ).toThrow();
  });

  it('actualiza la cotización en ARS sin modificar importes', () => {
    const original = seedDemo();

    const result = applyExchangeRate(
      original,
      'ARS',
      1560,
      'manual',
      now,
    );

    expect(
      result.settings.exchangeRate,
    ).toBe(1560);

    expect(result.deals).toEqual(
      original.deals,
    );

    expect(
      result.activities[0].title,
    ).toBe('Cotización actualizada');
  });

  it('guarda el importe original antes de convertir a USD', () => {
    const original = seedDemo();

    const usd = applyExchangeRate(
      original,
      'USD',
      1560,
      'manual',
      now,
    );

    expect(
      usd.settings.currency,
    ).toBe('USD');

    usd.deals.forEach((deal, index) => {
      expect(
        deal.amountBaseARS,
      ).toBe(
        original.deals[index].amount,
      );

      expect(deal.amount).toBe(
        convertAmount(
          original.deals[index].amount,
          'ARS',
          'USD',
          1560,
        ),
      );
    });

    expect(
      usd.activities[0].title,
    ).toBe('Moneda convertida');
  });

  it('evita redondeos acumulados al modificar la cotización', () => {
    const original = seedDemo();

    const usd = applyExchangeRate(
      original,
      'USD',
      1560,
      'manual',
      now,
    );

    const repriced = applyExchangeRate(
      usd,
      'USD',
      1600,
      'manual',
      now,
    );

    const repricedAgain =
      applyExchangeRate(
        repriced,
        'USD',
        1500,
        'manual',
        now,
      );

    const restored = applyExchangeRate(
      repricedAgain,
      'ARS',
      1490,
      'manual',
      now,
    );

    original.deals.forEach(
      (deal, index) => {
        expect(
          repriced.deals[index].amount,
        ).toBe(
          Math.round(
            (deal.amount / 1600 +
              Number.EPSILON) * 100,
          ) / 100,
        );

        expect(
          repricedAgain.deals[index].amount,
        ).toBe(
          Math.round(
            (deal.amount / 1500 +
              Number.EPSILON) * 100,
          ) / 100,
        );

        expect(
          restored.deals[index].amount,
        ).toBe(deal.amount);

        expect(
          restored.deals[index].amountBaseARS,
        ).toBe(deal.amount);
      },
    );
  });

  it('conserva valores pequeños aunque USD redondee a cero', () => {
    const original = seedDemo();

    const data = {
      ...original,
      deals: [
        exampleDeal(7),
      ],
    };

    const usd = applyExchangeRate(
      data,
      'USD',
      1560,
    );

    expect(
      usd.deals[0].amount,
    ).toBe(0);

    expect(
      usd.deals[0].amountBaseARS,
    ).toBe(7);

    expect(
      applyExchangeRate(
        usd,
        'ARS',
        2000,
      ).deals[0].amount,
    ).toBe(7);
  });

  it('conserva la base si solo se editan campos no monetarios', () => {
    const usd = applyExchangeRate(
      seedDemo(),
      'USD',
      1560,
    );

    const deal = usd.deals[0];

    const edited = prepareDealAmount(
      {
        ...deal,
        title: 'Nombre nuevo',
      },
      deal,
      usd,
    );

    expect(
      edited.amountBaseARS,
    ).toBe(deal.amountBaseARS);
  });

  it('recalcula la base cuando se edita el importe USD', () => {
    const usd = applyExchangeRate(
      seedDemo(),
      'USD',
      1560,
    );

    const previous = usd.deals[0];

    const edited = prepareDealAmount(
      {
        ...previous,
        amount: 1000,
      },
      previous,
      usd,
    );

    expect(
      edited.amountBaseARS,
    ).toBe(1_560_000);

    const next = applyExchangeRate(
      {
        ...usd,
        deals: [edited],
      },
      'USD',
      1600,
    );

    expect(
      next.deals[0].amount,
    ).toBe(975);
  });

  it('crea oportunidades nuevas en USD con su propia base ARS', () => {
    const usd = applyExchangeRate(
      seedDemo(),
      'USD',
      1560,
    );

    const newDeal = {
      ...exampleDeal(1000),
      id: 'new',
    };

    const added = prepareDealAmount(
      newDeal,
      undefined,
      usd,
    );

    expect(
      added.amountBaseARS,
    ).toBe(1_560_000);

    const next = applyExchangeRate(
      {
        ...usd,
        deals: [added],
      },
      'USD',
      1600,
    );

    expect(
      next.deals[0].amount,
    ).toBe(975);
  });

  it('migra respaldos antiguos usando la cotización histórica', () => {
    const original = seedDemo();

    const legacy = {
      ...original,

      settings: {
        ...original.settings,
        currency: 'USD' as const,
        exchangeRate: 1560,
      },

      deals: original.deals.map(
        (deal) => ({
          ...deal,

          amount: convertAmount(
            deal.amount,
            'ARS',
            'USD',
            1560,
          ),
        }),
      ),
    };

    const changed = applyExchangeRate(
      legacy,
      'USD',
      1600,
    );

    expect(
      changed.deals[0].amountBaseARS,
    ).toBeCloseTo(
      legacy.deals[0].amount * 1560,
      5,
    );

    const back = applyExchangeRate(
      changed,
      'ARS',
      1800,
    );

    expect(
      back.deals[0].amount,
    ).toBe(
      changed.deals[0].amountBaseARS,
    );
  });

  it('lee la cotización histórica desde Actividad', () => {
    const legacy = convertCRMData(
      seedDemo(),
      'USD',
      quote,
      now,
    );

    const data = {
      ...legacy,

      settings: {
        organization:
          legacy.settings.organization,
        userName:
          legacy.settings.userName,
        currency:
          legacy.settings.currency,
      },
    };

    expect(
      getAppliedExchangeRate(data),
    ).toBe(1560);
  });

  it('no inventa una base si se desconoce la cotización USD', () => {
    const data = seedDemo();

    const legacy = {
      ...data,

      settings: {
        ...data.settings,
        currency: 'USD' as const,
      },

      activities: [],
    };

    expect(() =>
      applyExchangeRate(
        legacy,
        'USD',
        1600,
      ),
    ).toThrow();

    expect(() =>
      prepareDealAmount(
        {
          ...legacy.deals[0],
          title: 'X',
        },
        legacy.deals[0],
        legacy,
      ),
    ).toThrow();
  });

  it('rechaza importes base inválidos', () => {
    const data = seedDemo();

    data.deals[0].amountBaseARS = NaN;

    expect(() =>
      validateFinancialData(data),
    ).toThrow();

    expect(() =>
      applyExchangeRate(
        data,
        'USD',
        1560,
      ),
    ).toThrow();
  });

  it('no modifica contactos, empresas, tareas ni los datos originales', () => {
    const original = seedDemo();

    const snapshot =
      JSON.stringify(original);

    const updated = applyExchangeRate(
      original,
      'USD',
      1560,
    );

    expect(
      updated.contacts,
    ).toEqual(original.contacts);

    expect(
      updated.companies,
    ).toEqual(original.companies);

    expect(
      updated.tasks,
    ).toEqual(original.tasks);

    expect(
      JSON.stringify(original),
    ).toBe(snapshot);
  });

  it('mantiene la compatibilidad con la API anterior', () => {
    const original = seedDemo();

    const usd = convertCRMData(
      original,
      'USD',
      quote,
      now,
    );

    expect(
      usd.settings.exchangeRateSource,
    ).toBe('oficial');

    expect(
      usd.activities[0].detail,
    ).toContain(published);

    expect(
      convertCRMData(
        usd,
        'USD',
        quote,
        now,
      ),
    ).toBe(usd);
  });
});
