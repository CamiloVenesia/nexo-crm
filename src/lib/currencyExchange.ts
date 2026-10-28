
import type {
  Activity,
  CRMData,
  Deal,
  Settings,
} from '../types';

import { createId } from './seed';

export type Currency = Settings['currency'];
export type ExchangeSource = 'manual' | 'oficial';

export interface DollarQuote {
  rate: number;
  updatedAt: string;
  source: 'DolarApi - dolar oficial vendedor';
}

export const OFFICIAL_DOLLAR_URL =
  'https://dolarapi.com/v1/dolares/oficial';

const REQUEST_TIMEOUT_MS = 9_000;
const MAX_QUOTE_AGE_MS = 10 * 24 * 60 * 60 * 1000;
const MAX_RATE = 1_000_000_000;
const MAX_AMOUNT_ARS = 1_000_000_000_000_000;

const validRate = (rate: number) =>
  Number.isFinite(rate) &&
  rate > 0 &&
  rate <= MAX_RATE;

const validBase = (amount: number) =>
  Number.isFinite(amount) &&
  amount >= 0 &&
  amount <= MAX_AMOUNT_ARS;

function roundCents(amount: number): number {
  if (
    !Number.isFinite(amount) ||
    !Number.isSafeInteger(
      Math.round(amount * 100),
    )
  ) {
    throw new Error(
      'El importe supera el rango seguro de conversión.',
    );
  }

  return (
    Math.round(
      (amount + Number.EPSILON) * 100,
    ) / 100
  );
}

// ============================================
// VALIDACIÓN DE DATOS FINANCIEROS
// ============================================

export function validateFinancialData(
  data: CRMData,
): void {
  const rate = data.settings.exchangeRate;

  if (
    rate !== undefined &&
    (
      typeof rate !== 'number' ||
      !validRate(rate)
    )
  ) {
    throw new Error(
      'Cotización guardada inválida.',
    );
  }

  for (const deal of data.deals) {
    if (
      deal.amountBaseARS !== undefined &&
      (
        typeof deal.amountBaseARS !== 'number' ||
        !validBase(deal.amountBaseARS)
      )
    ) {
      throw new Error(
        `Referencia monetaria inválida en la oportunidad ${deal.title}.`,
      );
    }
  }
}

// ============================================
// COTIZACIÓN OFICIAL
// ============================================

export function parseDollarQuote(
  raw: unknown,
  now = Date.now(),
): DollarQuote {
  if (!raw || typeof raw !== 'object') {
    throw new Error(
      'La fuente no devolvió una cotización válida.',
    );
  }

  const value = raw as Record<string, unknown>;

  const rate = value.venta;
  const updatedAt = value.fechaActualizacion;

  if (
    value.moneda !== 'USD' ||
    value.casa !== 'oficial' ||
    typeof rate !== 'number' ||
    !validRate(rate) ||
    typeof updatedAt !== 'string'
  ) {
    throw new Error(
      'La respuesta de cotización tiene datos inválidos.',
    );
  }

  const publication = Date.parse(updatedAt);

  if (
    !Number.isFinite(publication) ||
    publication > now + 60 * 60 * 1000 ||
    now - publication > MAX_QUOTE_AGE_MS
  ) {
    throw new Error(
      'La cotización no tiene una fecha reciente y válida.',
    );
  }

  return {
    rate,
    updatedAt: new Date(publication).toISOString(),
    source: 'DolarApi - dolar oficial vendedor',
  };
}

export async function fetchDollarQuote(): Promise<DollarQuote> {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      OFFICIAL_DOLLAR_URL,
      {
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
      },
    );

    if (!response.ok) {
      throw new Error(
        `La consulta de cotización falló (HTTP ${response.status}).`,
      );
    }

    return parseDollarQuote(await response.json());
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        'La consulta de cotización tardó demasiado. Volvé a intentarlo.',
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        'No se pudo consultar la cotización. Podés ingresarla manualmente.',
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================
// CONVERSIÓN INDIVIDUAL
// ============================================

export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
  rate: number,
): number {
  if (
    !Number.isFinite(amount) ||
    !validRate(rate)
  ) {
    throw new Error(
      'No se puede convertir un importe o una cotización inválidos.',
    );
  }

  if (from === to) return amount;

  return roundCents(
    from === 'ARS'
      ? amount / rate
      : amount * rate,
  );
}

// ============================================
// COTIZACIÓN HISTÓRICA
// ============================================

export function getAppliedExchangeRate(
  data: CRMData,
): number | null {
  const stored = data.settings.exchangeRate;

  if (
    typeof stored === 'number' &&
    validRate(stored)
  ) {
    return stored;
  }

  // Compatibilidad con respaldos antiguos.
  for (const activity of data.activities) {
    if (
      activity.type !== 'system' ||
      ![
        'Moneda convertida',
        'Cotización actualizada',
      ].includes(activity.title)
    ) {
      continue;
    }

    const match = activity.detail.match(
      /1 USD\s*=\s*(\d+(?:\.\d+)?)\s*ARS/i,
    );

    const historicalRate = match
      ? Number(match[1])
      : Number.NaN;

    if (validRate(historicalRate)) {
      return historicalRate;
    }
  }

  return null;
}

// ============================================
// IMPORTE BASE EN ARS
// ============================================

function baseARS(
  deal: Deal,
  currency: Currency,
  oldRate: number | null,
): number {
  if (deal.amountBaseARS !== undefined) {
    if (!validBase(deal.amountBaseARS)) {
      throw new Error(
        `La referencia de ${deal.title} es inválida.`,
      );
    }

    return deal.amountBaseARS;
  }

  if (currency === 'ARS') {
    return deal.amount;
  }

  if (oldRate === null) {
    throw new Error(
      'Falta la cotización histórica de oportunidades en USD. Restaurá un respaldo en ARS.',
    );
  }

  // Para datos anteriores: reconstrucción aproximada.
  return deal.amount * oldRate;
}

// ============================================
// CREAR O EDITAR UNA OPORTUNIDAD
// ============================================

export function prepareDealAmount(
  next: Deal,
  previous: Deal | undefined,
  data: CRMData,
): Deal {
  validateFinancialData(data);

  const currency = data.settings.currency;
  const rate = getAppliedExchangeRate(data);

  // Si no cambió el importe, conservamos la base.
  if (
    previous &&
    previous.amount === next.amount
  ) {
    const base = baseARS(
      previous,
      currency,
      rate,
    );

    if (!validBase(base)) {
      throw new Error(
        'El importe base no es válido.',
      );
    }

    return {
      ...next,
      amountBaseARS: base,
    };
  }

  if (
    currency === 'USD' &&
    rate === null
  ) {
    throw new Error(
      'Configurá primero la cotización del dólar para guardar una oportunidad en USD.',
    );
  }

  // Si se modificó el importe, esa edición
  // se convierte en la nueva referencia.
  const base =
    currency === 'ARS'
      ? next.amount
      : next.amount * (rate as number);

  if (!validBase(base)) {
    throw new Error(
      'El importe base no es válido.',
    );
  }

  return {
    ...next,
    amountBaseARS: base,
  };
}

// ============================================
// CAMBIAR MONEDA O COTIZACIÓN
// ============================================

export function applyExchangeRate(
  data: CRMData,
  target: Currency,
  newRate: number,
  source: ExchangeSource = 'manual',
  now = new Date().toISOString(),
  quoteUpdatedAt = now,
): CRMData {
  validateFinancialData(data);

  if (!validRate(newRate)) {
    throw new Error(
      'Ingresá una cotización válida mayor que cero.',
    );
  }

  if (
    target !== 'ARS' &&
    target !== 'USD'
  ) {
    throw new Error(
      'La moneda seleccionada no es válida.',
    );
  }

  const original = data.settings.currency;
  const oldRate = getAppliedExchangeRate(data);

  const currencyChanged = original !== target;
  const rateChanged = oldRate !== newRate;

  // Si seguimos en ARS, solo cambiamos la tasa.
  const deals =
    original === 'ARS' && target === 'ARS'
      ? data.deals
      : data.deals.map((deal) => {
          const base = baseARS(
            deal,
            original,
            oldRate,
          );

          if (!validBase(base)) {
            throw new Error(
              `Importe ARS fuera de rango en ${deal.title}.`,
            );
          }

          return {
            ...deal,
            amountBaseARS: base,

            // Siempre recalculamos desde ARS.
            amount:
              target === 'ARS'
                ? base
                : roundCents(base / newRate),
          };
        });

  const details = [
    `${original} → ${target}`,
    `1 USD = ${newRate} ARS`,
    oldRate !== null
      ? `Cotización anterior: ${oldRate} ARS`
      : 'Primera cotización',
    `${deals.length} oportunidades revisadas`,
    source === 'oficial'
      ? 'DolarApi - dólar oficial vendedor'
      : 'Cotización ingresada manualmente',
    `Cotización: ${quoteUpdatedAt}`,
  ].join(' · ');

  const log: Activity = {
    id: createId(),
    type: 'system',
    title: currencyChanged
      ? 'Moneda convertida'
      : 'Cotización actualizada',
    detail: details,
    createdAt: now,
  };

  return {
    ...data,
    deals,

    settings: {
      ...data.settings,
      currency: target,
      exchangeRate: newRate,
      exchangeRateUpdatedAt: quoteUpdatedAt,
      exchangeRateSource: source,
    },

    activities:
      currencyChanged || rateChanged
        ? [log, ...data.activities].slice(0, 150)
        : data.activities,
  };
}

// ============================================
// COMPATIBILIDAD CON CÓDIGO ANTERIOR
// ============================================

export function convertCRMData(
  data: CRMData,
  target: Currency,
  quote: DollarQuote,
  now = new Date().toISOString(),
): CRMData {
  if (data.settings.currency === target) {
    return data;
  }

  return applyExchangeRate(
    data,
    target,
    quote.rate,
    'oficial',
    now,
    quote.updatedAt,
  );
}
