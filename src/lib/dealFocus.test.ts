
import {
  describe,
  expect,
  it,
} from 'vitest';

import { seedDemo } from './seed';

import type {
  Deal,
  Task,
} from '../types';

import {
  filterDeals,
  getDealFocusCounts,
  getDealFollowUp,
  normalizeDealSearch,
} from './dealFocus';

const today = '2026-10-28';

const data = seedDemo();

const deal = {
  ...data.deals[0],
  id: 'oportunidad-demo',
  stage: 'prospeccion' as const,
  dueDate: '2026-11-20',
};

const task = (
  id: string,
  dueDate: string,
  done = false,
): Task => ({
  ...data.tasks[0],
  id,
  dealId: deal.id,
  dueDate,
  done,
});

const makeData = (
  deals: Deal[],
  tasks: Task[] = [],
) => ({
  ...data,
  deals,
  tasks,
});

describe('NEXO CRM / filtros de oportunidades', () => {
  it('normaliza tildes y mayúsculas', () => {
    expect(
      normalizeDealSearch('  CÓRDOBA  '),
    ).toBe('cordoba');
  });

  it('encuentra oportunidades por nombre sin importar tildes', () => {
    const custom = {
      ...deal,
      title: 'Integración Córdoba',
    };

    const result = filterDeals(
      makeData([custom]),
      {
        search: 'cordoba',
        showClosed: false,
        focus: 'todos',
      },
      today,
    );

    expect(
      result.map((item) => item.id),
    ).toEqual([deal.id]);
  });

  it('busca por nombre del contacto y responsable', () => {
    const contact = data.contacts[0];

    const custom = {
      ...deal,
      contactId: contact.id,
      owner: 'Responsable Especial',
    };

    const subject = makeData([custom]);

    expect(
      filterDeals(
        subject,
        {
          search: contact.name,
          showClosed: false,
          focus: 'todos',
        },
        today,
      ),
    ).toHaveLength(1);

    expect(
      filterDeals(
        subject,
        {
          search: 'responsable especial',
          showClosed: false,
          focus: 'todos',
        },
        today,
      ),
    ).toHaveLength(1);
  });

  it('ignora tareas completadas al encontrar el próximo seguimiento', () => {
    const result = getDealFollowUp(
      deal,
      [
        task('hecha', '2026-10-01', true),
        task('pendiente', '2026-10-29'),
      ],
      today,
    );

    expect(result.task?.id).toBe(
      'pendiente',
    );

    expect(result.state).toBe(
      'upcoming',
    );
  });

  it('prioriza tareas pendientes con fecha y deja sin fecha al final', () => {
    const result = getDealFollowUp(
      deal,
      [
        task('sin-fecha', ''),
        task('segunda', '2026-11-01'),
        task('primera', '2026-10-27'),
      ],
      today,
    );

    expect(result.task?.id).toBe(
      'primera',
    );

    expect(result.state).toBe(
      'overdue',
    );
  });

  it('identifica tareas para hoy y seguimientos ausentes', () => {
    expect(
      getDealFollowUp(
        deal,
        [task('hoy', today)],
        today,
      ).state,
    ).toBe('today');

    expect(
      getDealFollowUp(
        deal,
        [],
        today,
      ).state,
    ).toBe('missing');
  });

  it('no asigna seguimientos activos a oportunidades cerradas', () => {
    const closed = {
      ...deal,
      stage: 'ganado' as const,
    };

    expect(
      getDealFollowUp(
        closed,
        [task('hoy', today)],
        today,
      ).state,
    ).toBe('closed');
  });

  it('filtra por tareas vencidas sin contar tareas de hoy', () => {
    const subject = makeData(
      [deal],
      [task('t1', '2026-10-27')],
    );

    expect(
      filterDeals(
        subject,
        {
          search: '',
          showClosed: false,
          focus: 'seguimiento-vencido',
        },
        today,
      ),
    ).toHaveLength(1);

    expect(
      filterDeals(
        subject,
        {
          search: '',
          showClosed: false,
          focus: 'seguimiento-hoy',
        },
        today,
      ),
    ).toHaveLength(0);
  });

  it('diferencia falta de tarea de tarea sin fecha', () => {
    const noTasks = makeData([deal]);

    const undated = makeData(
      [deal],
      [task('sin-fecha', '')],
    );

    const options = {
      search: '',
      showClosed: false,
      focus: 'sin-seguimiento' as const,
    };

    expect(
      filterDeals(
        noTasks,
        options,
        today,
      ),
    ).toHaveLength(1);

    expect(
      filterDeals(
        undated,
        options,
        today,
      ),
    ).toHaveLength(0);
  });

  it('identifica cierres estimados vencidos independientemente de las tareas', () => {
    const subject = makeData([
      {
        ...deal,
        dueDate: '2026-10-20',
      },
    ]);

    expect(
      filterDeals(
        subject,
        {
          search: '',
          showClosed: false,
          focus: 'cierre-vencido',
        },
        today,
      ),
    ).toHaveLength(1);
  });

  it('excluye oportunidades cerradas de filtros de atención incluso si se muestran', () => {
    const closed = {
      ...deal,
      stage: 'perdido' as const,
    };

    const subject = makeData([closed]);

    expect(
      filterDeals(
        subject,
        {
          search: '',
          showClosed: true,
          focus: 'todos',
        },
        today,
      ),
    ).toHaveLength(1);

    expect(
      filterDeals(
        subject,
        {
          search: '',
          showClosed: true,
          focus: 'sin-seguimiento',
        },
        today,
      ),
    ).toHaveLength(0);
  });

  it('cuenta oportunidades, no cada tarea vencida', () => {
    const subject = makeData(
      [
        {
          ...deal,
          dueDate: '2026-10-21',
        },
      ],
      [
        task('t1', '2026-10-20'),
        task('t2', '2026-10-21'),
      ],
    );

    expect(
      getDealFocusCounts(
        subject,
        today,
      ),
    ).toEqual({
      overdueFollowUps: 1,
      todayFollowUps: 0,
      withoutFollowUp: 0,
      overdueClosings: 1,
    });
  });

  it('no modifica el orden original de tareas ni oportunidades', () => {
    const subject = makeData(
      [deal],
      [
        task('later', '2026-11-20'),
        task('earlier', '2026-10-21'),
      ],
    );

    const original = JSON.stringify(
      subject,
    );

    getDealFocusCounts(
      subject,
      today,
    );

    filterDeals(
      subject,
      {
        search: '',
        showClosed: false,
        focus: 'todos',
      },
      today,
    );

    expect(
      JSON.stringify(subject),
    ).toBe(original);
  });
});
