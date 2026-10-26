
import { describe, expect, it } from 'vitest';

import {
  assertData,
  money,
  openDeals,
  overdue,
  pipelineValue,
  stageById,
  weightedValue,
} from './utils';

import { seedDemo } from './seed';
import { deleteRecord } from './integrity';
import { CRMData } from '../types';

const cloneData = (): CRMData =>
  JSON.parse(
    JSON.stringify(seedDemo()),
  ) as CRMData;

// ==================================================
// CÁLCULOS COMERCIALES
// ==================================================

describe('NEXO CRM / cálculos', () => {
  const data = seedDemo();

  it('solo considera oportunidades abiertas', () => {
    const deals = openDeals(data.deals);

    expect(
      deals.every(
        (deal) =>
          deal.stage !== 'ganado' &&
          deal.stage !== 'perdido',
      ),
    ).toBe(true);

    expect(pipelineValue(data.deals)).toBe(
      deals.reduce(
        (total, deal) => total + deal.amount,
        0,
      ),
    );
  });

  it('calcula la proyección ponderada', () => {
    const expected = openDeals(data.deals).reduce(
      (total, deal) =>
        total +
        (deal.amount * deal.probability) / 100,
      0,
    );

    expect(
      weightedValue(data.deals),
    ).toBeCloseTo(expected);
  });

  it('asigna 100 % a la etapa ganada', () => {
    expect(
      stageById('ganado').probability,
    ).toBe(100);
  });

  it('detecta fechas vencidas', () => {
    expect(overdue('2020-01-01')).toBe(true);
    expect(overdue('2999-01-01')).toBe(false);
  });

  it('da formato a importes argentinos', () => {
    expect(
      money(15500, 'ARS'),
    ).toContain('15.500');
  });
});

// ==================================================
// VALIDACIÓN DE RESPALDOS
// ==================================================

describe('NEXO CRM / respaldos', () => {
  it('acepta los datos originales de la demo', () => {
    const data = cloneData();

    expect(assertData(data).deals).toHaveLength(
      data.deals.length,
    );
  });

  it('rechaza versiones incompatibles', () => {
    expect(() =>
      assertData({
        version: 2,
        deals: [],
      }),
    ).toThrow();
  });

  it('rechaza oportunidades con importes negativos', () => {
    const data = cloneData();

    data.deals[0].amount = -100;

    expect(() => assertData(data)).toThrow();
  });

  it('rechaza probabilidades mayores al 100 %', () => {
    const data = cloneData();

    data.deals[0].probability = 150;

    expect(() => assertData(data)).toThrow();
  });

  it('rechaza referencias a empresas inexistentes', () => {
    const data = cloneData();

    data.deals[0].companyId = 'empresa-inexistente';

    expect(() => assertData(data)).toThrow();
  });

  it('rechaza referencias a contactos inexistentes', () => {
    const data = cloneData();

    data.deals[0].contactId = 'contacto-inexistente';

    expect(() => assertData(data)).toThrow();
  });

  it('rechaza tareas con oportunidades inexistentes', () => {
    const data = cloneData();

    data.tasks[0].dealId = 'oportunidad-inexistente';

    expect(() => assertData(data)).toThrow();
  });

  it('rechaza identificadores duplicados', () => {
    const data = cloneData();

    data.tasks.push({
      ...data.tasks[0],
    });

    expect(() => assertData(data)).toThrow();
  });

  it('rechaza fechas de vencimiento imposibles', () => {
    const data = cloneData();

    data.tasks[0].dueDate = '2026-02-30';

    expect(() => assertData(data)).toThrow();
  });

  it('rechaza estados de tarea que no sean booleanos', () => {
    const data = cloneData();

    (data.tasks[0] as unknown as { done: unknown }).done =
      'false';

    expect(() => assertData(data)).toThrow();
  });
});

// ==================================================
// INTEGRIDAD DE ELIMINACIONES
// ==================================================

describe('NEXO CRM / integridad referencial', () => {
  it('elimina oportunidades sin borrar sus tareas', () => {
    const data = cloneData();

    const originalTasks = data.tasks.length;

    const result = deleteRecord(
      data,
      'deals',
      'd1',
    );

    expect(result.status).toBe('deleted');

    expect(
      result.data.deals.some(
        (deal) => deal.id === 'd1',
      ),
    ).toBe(false);

    expect(result.data.tasks).toHaveLength(
      originalTasks,
    );

    expect(
      result.data.tasks.some(
        (task) => task.dealId === 'd1',
      ),
    ).toBe(false);

    expect(() =>
      assertData(result.data),
    ).not.toThrow();
  });

  it('elimina contactos sin borrar oportunidades', () => {
    const data = cloneData();

    const originalDeals = data.deals.length;

    const result = deleteRecord(
      data,
      'contacts',
      'p1',
    );

    expect(result.status).toBe('deleted');

    expect(result.data.deals).toHaveLength(
      originalDeals,
    );

    expect(
      result.data.deals.some(
        (deal) => deal.contactId === 'p1',
      ),
    ).toBe(false);

    expect(() =>
      assertData(result.data),
    ).not.toThrow();
  });

  it('impide eliminar empresas con contactos u oportunidades', () => {
    const data = cloneData();

    const result = deleteRecord(
      data,
      'companies',
      'c1',
    );

    expect(result.status).toBe('blocked');

    expect(result.data).toBe(data);

    expect(
      result.data.companies.some(
        (company) => company.id === 'c1',
      ),
    ).toBe(true);
  });

  it('permite eliminar empresas sin relaciones', () => {
    const data = cloneData();

    data.companies.push({
      ...data.companies[0],
      id: 'c999',
      name: 'Empresa sin relaciones',
    });

    const result = deleteRecord(
      data,
      'companies',
      'c999',
    );

    expect(result.status).toBe('deleted');

    expect(
      result.data.companies.some(
        (company) => company.id === 'c999',
      ),
    ).toBe(false);

    expect(() =>
      assertData(result.data),
    ).not.toThrow();
  });

  it('elimina tareas sin afectar oportunidades', () => {
    const data = cloneData();

    const originalDeals = data.deals.length;

    const result = deleteRecord(
      data,
      'tasks',
      't1',
    );

    expect(result.status).toBe('deleted');

    expect(result.data.deals).toHaveLength(
      originalDeals,
    );

    expect(
      result.data.tasks.some(
        (task) => task.id === 't1',
      ),
    ).toBe(false);
  });

  it('no elimina registros inexistentes', () => {
    const data = cloneData();

    const result = deleteRecord(
      data,
      'deals',
      'id-inexistente',
    );

    expect(result.status).toBe('not-found');

    expect(result.data).toBe(data);
  });
});
