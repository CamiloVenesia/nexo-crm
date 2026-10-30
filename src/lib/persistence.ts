
import type {
  CRMData,
  Settings,
} from '../types';

import { assertData } from './utils';

import {
  validateFinancialData,
} from './currencyExchange';

export const STORAGE_KEY = 'nexo-crm-v1';
export const SETTINGS_STORAGE_PREFIX = 'nexo-crm-settings-v1:';

type StorageReader =
  Pick<Storage, 'getItem'>;

type StorageWriter =
  Pick<Storage, 'setItem'>;

export type LoadResult =
  | {
      status: 'empty';
      data: null;
      message: null;
    }
  | {
      status: 'valid';
      data: CRMData;
      message: null;
    }
  | {
      status: 'invalid';
      data: null;
      message: string;
    }
  | {
      status: 'unavailable';
      data: null;
      message: string;
    };

function browserStorage(): StorageReader & StorageWriter {
  return window.localStorage;
}

// ============================================
// LECTURA SEGURA DE DATOS LOCALES
// ============================================

export function readCRMStorage(
  getStorage: () => StorageReader = browserStorage,
): LoadResult {
  let raw: string | null;

  try {
    raw = getStorage().getItem(STORAGE_KEY);
  } catch {
    return {
      status: 'unavailable',
      data: null,
      message:
        'No se puede leer el almacenamiento del navegador. ' +
        'Los cambios podrían perderse al cerrar esta pestaña.',
    };
  }

  if (raw === null) {
    return {
      status: 'empty',
      data: null,
      message: null,
    };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    const data = assertData(parsed);

    validateFinancialData(data);

    return {
      status: 'valid',
      data,
      message: null,
    };
  } catch {
    return {
      status: 'invalid',
      data: null,
      message:
        'Encontramos datos locales dañados o incompatibles. ' +
        'No los sobrescribiremos automáticamente. ' +
        'Recuperá un respaldo JSON desde Configuración ' +
        'o reiniciá la demo de forma explícita.',
    };
  }
}

// ============================================
// GUARDADO SEGURO DE DATOS LOCALES
// ============================================

export function writeCRMStorage(
  data: CRMData,
  getStorage: () => StorageWriter = browserStorage,
): string | null {
  try {
    const validData = assertData(data);
    validateFinancialData(validData);

    getStorage().setItem(
      STORAGE_KEY,
      JSON.stringify(validData),
    );

    return null;
  } catch {
    return (
      'No se pudieron guardar los cambios en este navegador ' +
      '(almacenamiento bloqueado o sin espacio). ' +
      'Exportá un respaldo JSON antes de cerrar la pestaña.'
    );
  }
}

// ============================================
// PREFERENCIAS LOCALES POR ORGANIZACIÓN
// ============================================

function settingsKey(organizationId: string) {
  return `${SETTINGS_STORAGE_PREFIX}${organizationId}`;
}

function isSettings(value: unknown): value is Settings {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return false;
  }

  const settings = value as Record<string, unknown>;

  if (
    typeof settings.organization !== 'string' ||
    typeof settings.userName !== 'string' ||
    (settings.currency !== 'ARS' &&
      settings.currency !== 'USD')
  ) {
    return false;
  }

  if (
    settings.exchangeRate !== undefined &&
    (typeof settings.exchangeRate !== 'number' ||
      !Number.isFinite(settings.exchangeRate) ||
      settings.exchangeRate <= 0)
  ) {
    return false;
  }

  if (
    settings.exchangeRateSource !== undefined &&
    settings.exchangeRateSource !== 'manual' &&
    settings.exchangeRateSource !== 'oficial'
  ) {
    return false;
  }

  if (
    settings.exchangeRateUpdatedAt !== undefined &&
    typeof settings.exchangeRateUpdatedAt !== 'string'
  ) {
    return false;
  }

  return true;
}

export function readCRMSettings(
  organizationId: string,
  getStorage: () => StorageReader = browserStorage,
): Settings | null {
  try {
    const raw = getStorage().getItem(
      settingsKey(organizationId),
    );

    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    return isSettings(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCRMSettings(
  organizationId: string,
  settings: Settings,
  getStorage: () => StorageWriter = browserStorage,
): string | null {
  try {
    if (!isSettings(settings)) {
      throw new Error('Preferencias inválidas.');
    }

    getStorage().setItem(
      settingsKey(organizationId),
      JSON.stringify(settings),
    );

    return null;
  } catch {
    return (
      'No se pudieron guardar las preferencias en este navegador.'
    );
  }
}
