
import { describe, expect, it } from 'vitest';
import { seedDemo } from './seed';

import {
  applyExchangeRate,
  convertAmount,
  convertCRMData,
  getAppliedExchangeRate,
  parseDollarQuote,
} from './currencyExchange';

const now = '2026-10-27T20:00:00.000Z';
const published = '2026-10-27T15:00:00.000Z';

const quote = {
  rate: 1560,
  updatedAt: published,
  source: 'DolarApi - dolar oficial vendedor' as const,
};

describe('NEXO CRM / cotización editable', () => {
  it('convierte ARS a USD', () => {
    expect(
      convertAmount(1_560_000, 'ARS', 'USD', 1560),
    ).toBe(1000);
  });

  it('convierte USD a ARS', () => {
    expect(
      convertAmount(1000, 'USD', 'ARS', 1560),
    ).toBe(1_560_000);
  });

  it('conserva centavos y no convierte la misma moneda', () => {
    expect(
      convertAmount(10_000, 'ARS', 'USD', 1560),
    ).toBe(6.41);

    expect(
      convertAmount(125.123, 'USD', 'USD', 1560),
    ).toBe(125.123);
  });

  it('rechaza cotizaciones inválidas', () => {
    expect(() =>
      convertAmount(100, 'ARS', 'USD', 0),
    ).toThrow();

    expect(() =>
      convertAmount(100, 'ARS', 'USD', NaN),
    ).toThrow();
  });

  it('valida la respuesta de la API oficial', () => {
    expect(
      parseDollarQuote({
        moneda: 'USD',
        casa: 'oficial',
        venta: 1560,
        fechaActualizacion: published,
      }, Date.parse(now)),
    ).toEqual(quote);
  });

  it('rechaza fuentes o fechas incorrectas', () => {
    expect(() =>
      parseDollarQuote({
        moneda: 'USD',
        casa: 'blue',
        venta: 1560,
        fechaActualizacion: published,
      }, Date.parse(now)),
    ).toThrow();

    expect(() =>
      parseDollarQuote({
        moneda: 'USD',
        casa: 'oficial',
        venta: 1560,
        fechaActualizacion:
          '2026-09-01T00:00:00Z',
      }, Date.parse(now)),
    ).toThrow();
  });

  it('guarda una cotización manual aunque siga en ARS', () => {
    const data = seedDemo();

    const updated = applyExchangeRate(
      data,
      'ARS',
      1560,
      'manual',
      now,
    );

    expect(updated.settings.currency).toBe('ARS');
    expect(updated.settings.exchangeRate).toBe(1560);
    expect(updated.deals).toEqual(data.deals);

    expect(updated.activities[0].title).toBe(
      'Cotización actualizada',
    );
  });

  it('convierte una vez las oportunidades de ARS a USD', () => {
    const data = seedDemo();

    const usd = applyExchangeRate(
      data,
      'USD',
      1560,
      'manual',
      now,
    );

    expect(usd.settings.currency).toBe('USD');

    expect(usd.deals[0].amount).toBe(
      convertAmount(
        data.deals[0].amount,
        'ARS',
        'USD',
        1560,
      ),
    );

    expect(usd.activities[0].title).toBe(
      'Moneda convertida',
    );
  });

  it('recalcula USD al subir la cotización sin duplicar la conversión', () => {
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

    const value =
      original.deals[0].amount / 1600;

    expect(repriced.deals[0].amount).toBe(
      Math.round(value * 100) / 100,
    );

    expect(repriced.settings.exchangeRate).toBe(1600);
  });

  it('recalcula USD al bajar la cotización', () => {
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
      1500,
      'manual',
      now,
    );

    expect(repriced.deals[0].amount).toBe(
      Math.round(
        usd.deals[0].amount * 1560 / 1500 * 100,
      ) / 100,
    );
  });

  it('vuelve a ARS usando la referencia previa de los USD', () => {
    const original = seedDemo();

    const usd = applyExchangeRate(
      original,
      'USD',
      1560,
      'manual',
      now,
    );

    const ars = applyExchangeRate(
      usd,
      'ARS',
      1600,
      'manual',
      now,
    );

    expect(ars.settings.currency).toBe('ARS');

    expect(
      Math.abs(
        ars.deals[0].amount -
        original.deals[0].amount,
      ),
    ).toBeLessThan(10);
  });

  it('conserva los importes de oportunidades nuevas al recalcular en USD', () => {
    const original = seedDemo();

    const usd = applyExchangeRate(
      original,
      'USD',
      1560,
      'manual',
      now,
    );

    const newDeal = {
      ...usd.deals[0],
      id: 'new',
      amount: 1000,
    };

    const repriced = applyExchangeRate(
      {
        ...usd,
        deals: [...usd.deals, newDeal],
      },
      'USD',
      1600,
      'manual',
      now,
    );

    expect(
      repriced.deals.find(
        (deal) => deal.id === 'new',
      )?.amount,
    ).toBe(975);
  });

  it('respalda también la cotización', () => {
    const updated = applyExchangeRate(
      seedDemo(),
      'USD',
      1560,
      'manual',
      now,
    );

    const restored = JSON.parse(
      JSON.stringify(updated),
    );

    expect(
      restored.settings.exchangeRate,
    ).toBe(1560);

    expect(
      restored.settings.exchangeRateSource,
    ).toBe('manual');
  });

  it('recupera la tasa registrada por la versión anterior del CRM', () => {
    const legacy = convertCRMData(
      seedDemo(),
      'USD',
      quote,
      now,
    );

    const withoutFields = {
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
      getAppliedExchangeRate(withoutFields),
    ).toBe(1560);

    expect(
      applyExchangeRate(
        withoutFields,
        'USD',
        1600,
      ).settings.exchangeRate,
    ).toBe(1600);
  });

  it('bloquea recálculos de USD sin conocer la cotización anterior', () => {
    const data = seedDemo();

    expect(() =>
      applyExchangeRate({
        ...data,

        settings: {
          ...data.settings,
          currency: 'USD',
        },

        activities: [],
      }, 'USD', 1600),
    ).toThrow();
  });

  it('preserva contactos, empresas, tareas y el objeto original', () => {
    const original = seedDemo();
    const snapshot = JSON.stringify(original);

    const result = applyExchangeRate(
      original,
      'USD',
      1560,
    );

    expect(result.contacts).toEqual(
      original.contacts,
    );

    expect(result.companies).toEqual(
      original.companies,
    );

    expect(result.tasks).toEqual(
      original.tasks,
    );

    expect(JSON.stringify(original)).toBe(
      snapshot,
    );
  });

  it('mantiene el método anterior de conversión con la API', () => {
    const original = seedDemo();

    const usd = convertCRMData(
      original,
      'USD',
      quote,
      now,
    );

    expect(usd.settings.currency).toBe('USD');
    expect(usd.settings.exchangeRateSource).toBe('oficial');

    expect(usd.activities[0].detail).toContain(
      published,
    );

    expect(
      convertCRMData(usd, 'USD', quote, now),
    ).toBe(usd);
  });
});
