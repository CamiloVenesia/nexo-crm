
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  niceChartMaximum,
} from './chartScale';

describe('NEXO CRM / escala de gráficos', () => {
  it('no fuerza una escala de millones para valores en USD', () => {
    expect(
      niceChartMaximum([
        1763,
        3500,
        12000,
      ]),
    ).toBe(20000);
  });

  it('se adapta a valores grandes en ARS', () => {
    expect(
      niceChartMaximum([
        2_000_000,
        17_000_000,
      ]),
    ).toBe(20_000_000);
  });

  it('admite importes inferiores a mil', () => {
    expect(
      niceChartMaximum([
        35,
        230,
      ]),
    ).toBe(400);
  });

  it('maneja valores pequeños con decimales', () => {
    expect(
      niceChartMaximum([
        0.12,
        0.35,
      ]),
    ).toBe(0.4);
  });

  it('usa un valor seguro si no hay datos', () => {
    expect(
      niceChartMaximum([]),
    ).toBe(1);

    expect(
      niceChartMaximum([0, 0]),
    ).toBe(1);
  });

  it('ignora entradas no finitas y negativas', () => {
    expect(
      niceChartMaximum([
        NaN,
        Infinity,
        -100,
        900,
      ]),
    ).toBe(1000);
  });

  it('no altera los valores recibidos', () => {
    const values = [
      200,
      1500,
      400,
    ];

    const snapshot = [...values];

    niceChartMaximum(values);

    expect(values).toEqual(snapshot);
  });
});
