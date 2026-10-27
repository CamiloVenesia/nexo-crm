
import {
  describe,
  expect,
  it,
} from 'vitest';

import { seedDemo } from './seed';

import {
  dealNeedsAttention,
  getDealFollowUp,
  getPriorityItems,
  nextPendingTask,
} from './commercial';

describe('NEXO CRM / seguimiento comercial', () => {
  const today = '2026-10-26';

  it('ignora tareas completadas', () => {
    const data = seedDemo();

    const tasks = [
      {
        ...data.tasks[0],
        id: 'test-completada',
        dealId: 'd1',
        dueDate: '2026-10-01',
        done: true,
      },
      {
        ...data.tasks[0],
        id: 'test-pendiente',
        dealId: 'd1',
        dueDate: '2026-10-28',
        done: false,
      },
    ];

    expect(
      nextPendingTask('d1', tasks)?.id,
    ).toBe('test-pendiente');
  });

  it('selecciona la tarea pendiente más próxima', () => {
    const data = seedDemo();

    const tasks = [
      {
        ...data.tasks[0],
        id: 'segunda',
        dueDate: '2026-11-02',
      },
      {
        ...data.tasks[0],
        id: 'primera',
        dueDate: '2026-10-27',
      },
    ];

    expect(
      nextPendingTask('d1', tasks)?.id,
    ).toBe('primera');
  });

  it('identifica una tarea vencida', () => {
    const data = seedDemo();

    const deal = data.deals[0];

    const tasks = [
      {
        ...data.tasks[0],
        dealId: deal.id,
        dueDate: '2026-10-20',
        done: false,
      },
    ];

    expect(
      getDealFollowUp(deal, tasks, today).tone,
    ).toBe('overdue');
  });

  it('identifica las tareas para hoy', () => {
    const data = seedDemo();

    const deal = data.deals[0];

    const tasks = [
      {
        ...data.tasks[0],
        dealId: deal.id,
        dueDate: today,
        done: false,
      },
    ];

    expect(
      getDealFollowUp(deal, tasks, today).tone,
    ).toBe('today');
  });

  it('informa cuando una oportunidad no tiene tareas', () => {
    const data = seedDemo();

    expect(
      getDealFollowUp(
        data.deals[0],
        [],
        today,
      ).tone,
    ).toBe('missing');
  });

  it('no marca oportunidades cerradas como urgentes', () => {
    const data = seedDemo();

    const closed = {
      ...data.deals[0],
      stage: 'ganado' as const,
      dueDate: '2026-01-01',
    };

    expect(
      dealNeedsAttention(
        closed,
        data.tasks,
        today,
      ),
    ).toBe(false);
  });

  it('detecta oportunidades con cierre estimado vencido', () => {
    const data = seedDemo();

    const deal = {
      ...data.deals[0],
      dueDate: '2026-10-01',
    };

    expect(
      dealNeedsAttention(
        deal,
        [],
        today,
      ),
    ).toBe(true);
  });

  it('ordena las prioridades vencidas antes de las de hoy', () => {
    const data = seedDemo();

    data.tasks = [
      {
        ...data.tasks[0],
        id: 'hoy',
        dealId: '',
        dueDate: today,
        done: false,
      },
      {
        ...data.tasks[0],
        id: 'vencida',
        dealId: '',
        dueDate: '2026-10-20',
        done: false,
      },
    ];

    data.deals = [];

    const result = getPriorityItems(
      data,
      today,
    );

    expect(result[0].id).toBe('vencida');
    expect(result[1].id).toBe('hoy');
  });

  it('no modifica el orden original de tareas', () => {
    const data = seedDemo();

    const originalIds = data.tasks.map(
      (task) => task.id,
    );

    getPriorityItems(data, today);

    expect(
      data.tasks.map((task) => task.id),
    ).toEqual(originalIds);
  });
});
