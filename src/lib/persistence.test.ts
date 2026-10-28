
import { describe, expect, it } from 'vitest';
import { seedDemo } from './seed';

import {
  readCRMStorage,
  STORAGE_KEY,
  writeCRMStorage,
} from './persistence';

function createMemoryStorage(
  initial: string | null = null,
) {
  let value = initial;

  return {
    getItem: (key: string) =>
      key === STORAGE_KEY ? value : null,

    setItem: (key: string, next: string) => {
      if (key === STORAGE_KEY) {
        value = next;
      }
    },

    current: () => value,
  };
}

describe('NEXO CRM / persistencia local segura', () => {
  it('distingue la primera visita de datos dañados', () => {
    const storage = createMemoryStorage();

    expect(
      readCRMStorage(() => storage).status,
    ).toBe('empty');
  });

  it('lee una copia válida', () => {
    const data = seedDemo();

    const storage = createMemoryStorage(
      JSON.stringify(data),
    );

    const result = readCRMStorage(() => storage);

    expect(result.status).toBe('valid');

    if (result.status === 'valid') {
      expect(result.data.deals).toHaveLength(
        data.deals.length,
      );
    }
  });

  it('rechaza JSON corrupto sin modificar su contenido', () => {
    const storage = createMemoryStorage('{no-json');

    expect(
      readCRMStorage(() => storage).status,
    ).toBe('invalid');

    expect(storage.current()).toBe('{no-json');
  });

  it('rechaza archivos con referencias comerciales inválidas', () => {
    const data = seedDemo();

    data.deals[0].companyId = 'empresa-inexistente';

    const storage = createMemoryStorage(
      JSON.stringify(data),
    );

    expect(
      readCRMStorage(() => storage).status,
    ).toBe('invalid');
  });

  it('rechaza cotizaciones corruptas', () => {
    const data = seedDemo();

    data.settings.exchangeRate = -100;

    const storage = createMemoryStorage(
      JSON.stringify(data),
    );

    expect(
      readCRMStorage(() => storage).status,
    ).toBe('invalid');
  });

  it('informa si el navegador bloquea lectura de datos', () => {
    const result = readCRMStorage(() => {
      throw new Error('SecurityError');
    });

    expect(result.status).toBe('unavailable');

    expect(result.message).toContain('almacenamiento');
  });

  it('guarda una copia válida y la puede recuperar', () => {
    const storage = createMemoryStorage();

    const result = writeCRMStorage(
      seedDemo(),
      () => storage,
    );

    expect(result).toBeNull();

    expect(
      readCRMStorage(() => storage).status,
    ).toBe('valid');
  });

  it('detecta falta de espacio sin ocultar el error', () => {
    const result = writeCRMStorage(
      seedDemo(),
      () => ({
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      }),
    );

    expect(result).toContain(
      'No se pudieron guardar',
    );
  });

  it('no reemplaza una copia válida por datos inválidos', () => {
    const data = seedDemo();

    const storage = createMemoryStorage(
      JSON.stringify(data),
    );

    const before = storage.current();

    const invalid = structuredClone(data);

    invalid.deals[0].amount = -20;

    expect(
      writeCRMStorage(
        invalid,
        () => storage,
      ),
    ).not.toBeNull();

    expect(storage.current()).toBe(before);
  });
});
