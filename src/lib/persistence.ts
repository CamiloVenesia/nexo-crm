
import type { CRMData } from '../types';

import { assertData } from './utils';

import {
  validateFinancialData,
} from './currencyExchange';

export const STORAGE_KEY = 'nexo-crm-v1';

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

// ============================================
// LECTURA SEGURA
// ============================================

export function readCRMStorage(
  getStorage: () => StorageReader =
    () => window.localStorage,
): LoadResult {
  let raw: string | null;

  try {
    raw = getStorage().getItem(
      STORAGE_KEY,
    );
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
    const parsed: unknown =
      JSON.parse(raw);

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
// GUARDADO SEGURO
// ============================================

export function writeCRMStorage(
  data: CRMData,
  getStorage: () => StorageWriter =
    () => window.localStorage,
): string | null {
  try {
    const validData = assertData(data);

    validateFinancialData(validData);

    const serialized =
      JSON.stringify(validData);

    getStorage().setItem(
      STORAGE_KEY,
      serialized,
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
