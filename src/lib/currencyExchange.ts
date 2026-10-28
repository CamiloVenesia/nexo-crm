
import type { Activity, CRMData, Settings } from '../types';
import { createId } from './seed';

export type Currency = Settings['currency'];
export type ExchangeSource = 'manual' | 'oficial';

export interface DollarQuote {
  rate: number;
  updatedAt: string;
  source: 'DolarApi - dolar oficial vendedor';
}

export const OFFICIAL_DOLLAR_URL = 'https://dolarapi.com/v1/dolares/oficial';

const REQUEST_TIMEOUT_MS = 9_000;
const MAX_QUOTE_AGE_MS = 10 * 24 * 60 * 60 * 1000;
const CENTS = 100;

function validRate(rate: number): boolean {
  return Number.isFinite(rate) && rate > 0 && rate <= 1_000_000_000;
}

export function parseDollarQuote(raw: unknown, now = Date.now()): DollarQuote {
  if (!raw || typeof raw !== 'object') {
    throw new Error('La fuente no devolvió una cotización válida.');
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
    throw new Error('La respuesta de cotización tiene datos inválidos.');
  }

  const publication = Date.parse(updatedAt);

  if (
    !Number.isFinite(publication) ||
    publication > now + 60 * 60 * 1000 ||
    now - publication > MAX_QUOTE_AGE_MS
  ) {
    throw new Error('La cotización no tiene una fecha reciente y válida.');
  }

  return {
    rate,
    updatedAt: new Date(publication).toISOString(),
    source: 'DolarApi - dolar oficial vendedor',
  };
}

export async function fetchDollarQuote(): Promise<DollarQuote> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OFFICIAL_DOLLAR_URL, {
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
    });

    if (!response.ok) {
      throw new Error(`La consulta de cotización falló (HTTP ${response.status}).`);
    }

    return parseDollarQuote(await response.json());
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('La consulta de cotización tardó demasiado. Volvé a intentarlo.');
    }

    if (error instanceof TypeError) {
      throw new Error('No se pudo consultar la cotización. Podés ingresarla manualmente.');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
  rate: number,
): number {
  if (!Number.isFinite(amount) || !validRate(rate)) {
    throw new Error('No se puede convertir un importe o una cotización inválidos.');
  }

  if (from === to) return amount;

  const value = from === 'ARS' ? amount / rate : amount * rate;

  if (!Number.isSafeInteger(Math.round(value * CENTS))) {
    throw new Error('Uno de los importes supera el rango seguro para la conversión.');
  }

  return Math.round((value + Number.EPSILON) * CENTS) / CENTS;
}

/**
 * Lee la cotización persistida. En respaldos anteriores a esta mejora,
 * recupera la tasa de la última conversión registrada en Actividad.
 */
export function getAppliedExchangeRate(data: CRMData): number | null {
  const stored = data.settings.exchangeRate;

  if (typeof stored === 'number' && validRate(stored)) return stored;

  for (const activity of data.activities) {
    if (
      activity.type !== 'system' ||
      !['Moneda convertida', 'Cotización actualizada'].includes(activity.title)
    ) {
      continue;
    }

    const match = activity.detail.match(/1 USD\s*=\s*(\d+(?:\.\d+)?)\s*ARS/i);
    const historicalRate = match ? Number(match[1]) : Number.NaN;

    if (validRate(historicalRate)) return historicalRate;
  }

  return null;
}

/**
 * El importe almacenado sigue estando en la moneda activa.
 * Si está en USD, recuperamos su referencia ARS con la tasa
 * ANTERIOR y después recalculamos con la nueva cotización.
 *
 * Una conversión antigua puede haber redondeado centavos.
 */
export function applyExchangeRate(
  data: CRMData,
  target: Currency,
  newRate: number,
  source: ExchangeSource = 'manual',
  now = new Date().toISOString(),
  quoteUpdatedAt = now,
): CRMData {
  if (!validRate(newRate)) {
    throw new Error('Ingresá una cotización válida mayor que cero.');
  }

  if (target !== 'ARS' && target !== 'USD') {
    throw new Error('La moneda seleccionada no es válida.');
  }

  const original = data.settings.currency;
  const oldRate = getAppliedExchangeRate(data);

  if (original === 'USD' && oldRate === null && data.deals.length > 0) {
    throw new Error(
      'No se conoce la cotización con la que se guardaron los USD actuales. ' +
      'Restaurá un respaldo en ARS antes de recalcularlos para evitar valores incorrectos.',
    );
  }

  const deals = data.deals.map((deal) => {
    const amountARS = original === 'ARS'
      ? deal.amount
      : deal.amount * (oldRate ?? newRate);

    const nextAmount = target === 'ARS' ? amountARS : amountARS / newRate;

    if (
      !Number.isFinite(nextAmount) ||
      !Number.isSafeInteger(Math.round(nextAmount * CENTS))
    ) {
      throw new Error('Hay un importe que supera el rango seguro de conversión.');
    }

    return {
      ...deal,
      amount: Math.round((nextAmount + Number.EPSILON) * CENTS) / CENTS,
    };
  });

  const rateChanged = oldRate !== newRate;
  const currencyChanged = original !== target;

  const details = [
    `${original} → ${target}`,
    `1 USD = ${newRate} ARS`,
    oldRate !== null ? `Cotización anterior: ${oldRate} ARS` : 'Primera cotización',
    `${deals.length} oportunidades revisadas`,
    source === 'oficial'
      ? 'DolarApi - dólar oficial vendedor'
      : 'Cotización ingresada manualmente',
    `Cotización: ${quoteUpdatedAt}`,
  ].join(' · ');

  const log: Activity = {
    id: createId(),
    type: 'system',
    title: currencyChanged ? 'Moneda convertida' : 'Cotización actualizada',
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

    activities: currencyChanged || rateChanged
      ? [log, ...data.activities].slice(0, 150)
      : data.activities,
  };
}

/** Mantiene compatibilidad con el código y tests del bloque anterior. */
export function convertCRMData(
  data: CRMData,
  target: Currency,
  quote: DollarQuote,
  now = new Date().toISOString(),
): CRMData {
  if (data.settings.currency === target) return data;

  return applyExchangeRate(
    data,
    target,
    quote.rate,
    'oficial',
    now,
    quote.updatedAt,
  );
}
