
import type { CRMData, Deal, Task } from '../types';
import { toDateInput } from './utils';

export type DealFocusFilter =
  | 'todos'
  | 'seguimiento-vencido'
  | 'seguimiento-hoy'
  | 'sin-seguimiento'
  | 'cierre-vencido';

export interface DealFocusOptions {
  search: string;
  showClosed: boolean;
  focus: DealFocusFilter;
}

export interface DealFocusCounts {
  overdueFollowUps: number;
  todayFollowUps: number;
  withoutFollowUp: number;
  overdueClosings: number;
}

export type DealFollowUp =
  | { state: 'closed'; task: null }
  | { state: 'missing'; task: null }
  | {
      state:
        | 'undated'
        | 'overdue'
        | 'today'
        | 'upcoming';
      task: Task;
    };

const isClosed = (deal: Deal) =>
  deal.stage === 'ganado' ||
  deal.stage === 'perdido';

// ============================================
// NORMALIZAR BÚSQUEDA
// ============================================

export function normalizeDealSearch(
  value: string,
): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR')
    .trim();
}

// ============================================
// PRÓXIMO SEGUIMIENTO
// ============================================

export function getDealFollowUp(
  deal: Deal,
  tasks: Task[],
  today = toDateInput(new Date()),
): DealFollowUp {
  if (isClosed(deal)) {
    return {
      state: 'closed',
      task: null,
    };
  }

  const pending = tasks
    .filter(
      (task) =>
        task.dealId === deal.id &&
        !task.done,
    )
    .sort((a, b) =>
      (a.dueDate || '9999-12-31')
        .localeCompare(
          b.dueDate || '9999-12-31',
        ),
    );

  const task = pending[0];

  if (!task) {
    return {
      state: 'missing',
      task: null,
    };
  }

  if (!task.dueDate) {
    return {
      state: 'undated',
      task,
    };
  }

  if (task.dueDate < today) {
    return {
      state: 'overdue',
      task,
    };
  }

  if (task.dueDate === today) {
    return {
      state: 'today',
      task,
    };
  }

  return {
    state: 'upcoming',
    task,
  };
}

// ============================================
// FILTRAR OPORTUNIDADES
// ============================================

export function filterDeals(
  data: CRMData,
  options: DealFocusOptions,
  today = toDateInput(new Date()),
): Deal[] {
  const query = normalizeDealSearch(
    options.search,
  );

  const companies = new Map(
    data.companies.map(
      (company) => [
        company.id,
        company.name,
      ],
    ),
  );

  const contacts = new Map(
    data.contacts.map(
      (contact) => [
        contact.id,
        contact.name,
      ],
    ),
  );

  return data.deals.filter((deal) => {
    const closed = isClosed(deal);

    // Las oportunidades cerradas solo participan
    // del filtro general cuando se muestran.

    if (
      closed &&
      (!options.showClosed ||
        options.focus !== 'todos')
    ) {
      return false;
    }

    // BÚSQUEDA

    if (query) {
      const searchable = normalizeDealSearch(
        [
          deal.title,
          deal.owner,
          deal.notes,
          companies.get(deal.companyId) ?? '',
          contacts.get(deal.contactId) ?? '',
        ].join(' '),
      );

      if (!searchable.includes(query)) {
        return false;
      }
    }

    if (options.focus === 'todos') {
      return true;
    }

    const followUp = getDealFollowUp(
      deal,
      data.tasks,
      today,
    );

    // FILTROS COMERCIALES

    switch (options.focus) {
      case 'seguimiento-vencido':
        return followUp.state === 'overdue';

      case 'seguimiento-hoy':
        return followUp.state === 'today';

      case 'sin-seguimiento':
        return followUp.state === 'missing';

      case 'cierre-vencido':
        return Boolean(
          deal.dueDate &&
          deal.dueDate < today,
        );

      default:
        return true;
    }
  });
}

// ============================================
// CONTADORES PARA LOS FILTROS
// ============================================

export function getDealFocusCounts(
  data: CRMData,
  today = toDateInput(new Date()),
): DealFocusCounts {
  const counts: DealFocusCounts = {
    overdueFollowUps: 0,
    todayFollowUps: 0,
    withoutFollowUp: 0,
    overdueClosings: 0,
  };

  for (const deal of data.deals) {
    if (isClosed(deal)) continue;

    const followUp = getDealFollowUp(
      deal,
      data.tasks,
      today,
    );

    if (followUp.state === 'overdue') {
      counts.overdueFollowUps++;
    }

    if (followUp.state === 'today') {
      counts.todayFollowUps++;
    }

    if (followUp.state === 'missing') {
      counts.withoutFollowUp++;
    }

    if (
      deal.dueDate &&
      deal.dueDate < today
    ) {
      counts.overdueClosings++;
    }
  }

  return counts;
}
