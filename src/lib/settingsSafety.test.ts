
import { describe, expect, it } from 'vitest';

import { seedDemo } from './seed';

import {
  MAX_BACKUP_BYTES,
  summarizeCRMData,
  validateBackupFile,
  validatePreferences,
} from './settingsSafety';

describe('NEXO CRM / seguridad de configuración', () => {
  it('recorta espacios al guardar preferencias', () => {
    expect(
      validatePreferences(
        '  NEXO Studio  ',
        '  Alex  ',
        'ARS',
      ),
    ).toEqual({
      ok: true,
      value: {
        organization: 'NEXO Studio',
        userName: 'Alex',
        currency: 'ARS',
      },
    });
  });

  it('rechaza organizaciones vacías', () => {
    expect(
      validatePreferences('   ', 'Alex', 'ARS').ok,
    ).toBe(false);
  });

  it('rechaza nombres vacíos', () => {
    expect(
      validatePreferences('NEXO', '   ', 'ARS').ok,
    ).toBe(false);
  });

  it('rechaza nombres de más de 80 caracteres', () => {
    expect(
      validatePreferences(
        'x'.repeat(81),
        'Alex',
        'ARS',
      ).ok,
    ).toBe(false);

    expect(
      validatePreferences(
        'NEXO',
        'x'.repeat(81),
        'ARS',
      ).ok,
    ).toBe(false);
  });

  it('rechaza saltos de línea y caracteres de control', () => {
    expect(
      validatePreferences(
        'NEXO\nCRM',
        'Alex',
        'ARS',
      ).ok,
    ).toBe(false);

    expect(
      validatePreferences(
        'NEXO',
        'A\u0000lex',
        'ARS',
      ).ok,
    ).toBe(false);
  });

  it('permite las dos monedas configuradas', () => {
    expect(
      validatePreferences('NEXO', 'Alex', 'ARS').ok,
    ).toBe(true);

    expect(
      validatePreferences('NEXO', 'Alex', 'USD').ok,
    ).toBe(true);
  });

  it('rechaza monedas fuera de catálogo en datos externos', () => {
    expect(
      validatePreferences(
        'NEXO',
        'Alex',
        'EUR' as 'ARS',
      ).ok,
    ).toBe(false);
  });

  it('rechaza archivos con extensión incorrecta', () => {
    expect(
      validateBackupFile({
        name: 'datos.txt',
        size: 100,
      }),
    ).not.toBeNull();
  });

  it('rechaza archivos vacíos y mayores a 3 MB', () => {
    expect(
      validateBackupFile({
        name: 'datos.json',
        size: 0,
      }),
    ).not.toBeNull();

    expect(
      validateBackupFile({
        name: 'datos.json',
        size: MAX_BACKUP_BYTES + 1,
      }),
    ).not.toBeNull();
  });

  it('acepta un JSON dentro del límite de tamaño', () => {
    expect(
      validateBackupFile({
        name: 'NEXO.JSON',
        size: 1500,
      }),
    ).toBeNull();
  });

  it('resume la cantidad de registros sin modificar el respaldo', () => {
    const data = seedDemo();

    const before = JSON.stringify(data);
    const summary = summarizeCRMData(data);

    expect(summary.companies).toBe(
      data.companies.length,
    );

    expect(summary.contacts).toBe(
      data.contacts.length,
    );

    expect(summary.deals).toBe(
      data.deals.length,
    );

    expect(summary.tasks).toBe(
      data.tasks.length,
    );

    expect(summary.activities).toBe(
      data.activities.length,
    );

    expect(JSON.stringify(data)).toBe(before);
  });
});
