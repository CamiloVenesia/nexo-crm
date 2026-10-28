
/**
 * NEXO CRM — Escala dinámica de gráficos.
 *
 * Redondea los intervalos a cantidades legibles:
 * 1, 2, 2.5, 5 o 10 multiplicados por una potencia de 10.
 *
 * Funciona con pesos, dólares y valores decimales.
 */

export function niceChartMaximum(
  values: number[],
  divisions = 4,
): number {
  const maximum = Math.max(
    0,
    ...values.filter(
      (value) =>
        Number.isFinite(value) &&
        value > 0,
    ),
  );

  if (maximum === 0) {
    return 1;
  }

  const rawStep = maximum / divisions;

  const magnitude =
    10 ** Math.floor(Math.log10(rawStep));

  const normalizedStep = rawStep / magnitude;

  const multiplier =
    [1, 2, 2.5, 5, 10].find(
      (candidate) =>
        candidate >= normalizedStep - 1e-12,
    ) ?? 10;

  return Number(
    (
      multiplier *
      magnitude *
      divisions
    ).toPrecision(12),
  );
}
