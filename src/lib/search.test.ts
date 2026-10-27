
import { describe, expect, it } from 'vitest';

import { seedDemo } from './seed';

import {
  normalizeSearch,
  searchCRM,
} from './search';

const data = seedDemo();

describe('NEXO CRM / búsqueda global', () => {
  it('ignora mayúsculas y tildes', () => {
    expect(
      normalizeSearch('  CÓRDOBA  '),
    ).toBe('cordoba');

    expect(
      searchCRM(data, 'cordoba').length,
    ).toBeGreaterThan(0);
  });

  it('busca oportunidades por título', () => {
    expect(
      searchCRM(data, 'Transformación comercial'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'deal',
          id: 'd1',
        }),
      ]),
    );
  });

  it('busca contactos por teléfono', () => {
    expect(
      searchCRM(data, '0101'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'contact',
          id: 'p1',
        }),
      ]),
    );
  });

  it('busca empresas por localidad', () => {
    expect(
      searchCRM(data, 'Mendoza'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'company',
          id: 'c5',
        }),
      ]),
    );
  });

  it('busca tareas por descripción', () => {
    expect(
      searchCRM(data, 'cronograma'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'task',
          id: 't2',
        }),
      ]),
    );
  });

  it('no devuelve resultados para consultas demasiado cortas', () => {
    expect(searchCRM(data, 'a')).toEqual([]);
  });

  it('respeta el límite máximo de resultados', () => {
    const results = searchCRM(
      data,
      'Rosario',
      2,
    );

    expect(results).toHaveLength(2);
  });
});
