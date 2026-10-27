
import type { CRMData, Deal, Task } from '../types';

import {
  fmtDate,
  openDeals,
  toDateInput,
} from './utils';

export type FollowUpTone =
  | 'overdue'
  | 'today'
  | 'scheduled'
  | 'missing'
  | 'closed';

export interface DealFollowUp {
  label: string;
  detail: string;
  tone: FollowUpTone;
  task?: Task;
}

export interface PriorityItem {
  id: string;
  kind: 'task' | 'deal';
  title: string;
  detail: string;
  dueDate: string;
  tone: 'overdue' | 'today';
}

// ============================================
// PRÓXIMO SEGUIMIENTO DE UNA OPORTUNIDAD
// ============================================

export function nextPendingTask(
  dealId: string,
  tasks: Task[],
): Task | undefined {
  return tasks
    .filter(
      (task) =>
        task.dealId === dealId && !task.done,
    )
    .sort((a, b) => {
      const dateA = a.dueDate || '9999-12-31';
      const dateB = b.dueDate || '9999-12-31';

      return dateA.localeCompare(dateB);
    })[0];
}

export function getDealFollowUp(
  deal: Deal,
  tasks: Task[],
  today = toDateInput(new Date()),
): DealFollowUp {
  if (
    deal.stage === 'ganado' ||
    deal.stage === 'perdido'
  ) {
    return {
      label: 'Oportunidad cerrada',
      detail: 'No requiere seguimiento activo',
      tone: 'closed',
    };
  }

  const task = nextPendingTask(deal.id, tasks);

  if (!task) {
    return {
      label: 'Sin próxima tarea',
      detail: 'Programá una acción de seguimiento',
      tone: 'missing',
    };
  }

  if (task.dueDate && task.dueDate < today) {
    return {
      label: task.title,
      detail: `Vencida · ${fmtDate(task.dueDate)}`,
      tone: 'overdue',
      task,
    };
  }

  if (task.dueDate === today) {
    return {
      label: task.title,
      detail: 'Se debe realizar hoy',
      tone: 'today',
      task,
    };
  }

  return {
    label: task.title,
    detail: task.dueDate
      ? `Programada · ${fmtDate(task.dueDate)}`
      : 'Sin fecha establecida',
    tone: 'scheduled',
    task,
  };
}

// ============================================
// OPORTUNIDADES QUE REQUIEREN ATENCIÓN
// ============================================

export function dealNeedsAttention(
  deal: Deal,
  tasks: Task[],
  today = toDateInput(new Date()),
): boolean {
  if (
    deal.stage === 'ganado' ||
    deal.stage === 'perdido'
  ) {
    return false;
  }

  const closingOverdue = Boolean(
    deal.dueDate && deal.dueDate < today,
  );

  const followUp = nextPendingTask(
    deal.id,
    tasks,
  );

  const taskUrgent = Boolean(
    followUp?.dueDate &&
      followUp.dueDate <= today,
  );

  return closingOverdue || taskUrgent;
}

// ============================================
// PRIORIDADES DEL DÍA
// ============================================

export function getPriorityItems(
  data: CRMData,
  today = toDateInput(new Date()),
): PriorityItem[] {
  const urgentTasks: PriorityItem[] = data.tasks
    .filter(
      (task) =>
        !task.done &&
        Boolean(task.dueDate) &&
        task.dueDate <= today,
    )
    .map((task) => ({
      id: task.id,
      kind: 'task',
      title: task.title,
      detail:
        task.dueDate < today
          ? `Tarea vencida · ${fmtDate(task.dueDate)}`
          : 'Tarea para hoy',
      dueDate: task.dueDate,
      tone:
        task.dueDate < today
          ? 'overdue'
          : 'today',
    }));

  const closingDeals: PriorityItem[] = openDeals(
    data.deals,
  )
    .filter(
      (deal) =>
        Boolean(deal.dueDate) &&
        deal.dueDate < today,
    )
    .map((deal) => ({
      id: deal.id,
      kind: 'deal',
      title: deal.title,
      detail: `Cierre estimado vencido · ${fmtDate(
        deal.dueDate,
      )}`,
      dueDate: deal.dueDate,
      tone: 'overdue',
    }));

  return [
    ...urgentTasks,
    ...closingDeals,
  ].sort((a, b) => {
    if (a.tone !== b.tone) {
      return a.tone === 'overdue' ? -1 : 1;
    }

    return a.dueDate.localeCompare(
      b.dueDate,
    );
  });
}
