
import {
  CRMData,
  Deal,
  Stage,
  STAGES,
} from '../types';

export const uid = () =>
  typeof crypto !== 'undefined' &&
  'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const toDateInput = (date: Date) =>
  `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const dayOffset = (days: number) => {
  const date = new Date();

  date.setDate(date.getDate() + days);

  return toDateInput(date);
};

export const monthOffset = (months: number) => {
  const date = new Date();

  date.setMonth(date.getMonth() + months);

  return date.toISOString();
};

export function money(
  amount: number,
  currency: 'ARS' | 'USD' = 'ARS',
  compact = false,
) {
  if (!Number.isFinite(amount)) {
    return '—';
  }

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
    compactDisplay: 'short',
  }).format(amount);
}

export const fmtDate = (date: string) => {
  if (!date) {
    return 'Sin fecha';
  }

  const parsedDate = new Date(
    `${date.slice(0, 10)}T12:00:00`,
  );

  return Number.isNaN(parsedDate.getTime())
    ? 'Fecha inválida'
    : parsedDate.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
      });
};

export const fmtDateTime = (date: string) =>
  new Date(date).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export const initials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]?.toUpperCase() ?? '',
    )
    .join('');

export const stageById = (id: Stage) =>
  STAGES.find(
    (stage) => stage.id === id,
  ) ?? STAGES[0];

export const openDeals = (deals: Deal[]) =>
  deals.filter(
    (deal) =>
      !['ganado', 'perdido'].includes(deal.stage),
  );

export const pipelineValue = (deals: Deal[]) =>
  openDeals(deals).reduce(
    (total, deal) => total + deal.amount,
    0,
  );

export const weightedValue = (deals: Deal[]) =>
  openDeals(deals).reduce(
    (total, deal) =>
      total +
      (deal.amount * deal.probability) / 100,
    0,
  );

export const overdue = (dueDate: string) =>
  Boolean(
    dueDate &&
      dueDate < toDateInput(new Date()),
  );

export const todayDue = (dueDate: string) =>
  dueDate === toDateInput(new Date());

export function csvDownload(
  filename: string,
  rows: (string | number)[][],
) {
  const quote = (value: string | number) =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;

  const content =
    '\uFEFF' +
    rows
      .map((row) =>
        row.map(quote).join(';'),
      )
      .join('\r\n');

  const blob = new Blob([content], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  setTimeout(
    () => URL.revokeObjectURL(url),
    500,
  );
}

export function downloadJSON(data: CRMData) {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    {
      type: 'application/json',
    },
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = `nexo-respaldo-${toDateInput(
    new Date(),
  )}.json`;

  anchor.click();

  setTimeout(
    () => URL.revokeObjectURL(url),
    500,
  );
}

export function assertData(value: unknown): CRMData {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    throw new Error(
      'El archivo no contiene datos válidos.',
    );
  }

  const data = value as Record<string, unknown>;

  if (
    data.version !== 1 ||
    !Array.isArray(data.deals) ||
    !Array.isArray(data.contacts) ||
    !Array.isArray(data.companies) ||
    !Array.isArray(data.tasks) ||
    !Array.isArray(data.activities) ||
    !data.settings ||
    typeof data.settings !== 'object'
  ) {
    throw new Error(
      'Formato de respaldo incompatible.',
    );
  }

  const lists: {
    name: string;
    value: unknown[];
    keys: string[];
  }[] = [
    {
      name: 'oportunidades',
      value: data.deals,
      keys: [
        'id',
        'title',
        'stage',
        'amount',
        'companyId',
      ],
    },
    {
      name: 'contactos',
      value: data.contacts,
      keys: [
        'id',
        'name',
        'email',
        'companyId',
      ],
    },
    {
      name: 'empresas',
      value: data.companies,
      keys: [
        'id',
        'name',
      ],
    },
    {
      name: 'tareas',
      value: data.tasks,
      keys: [
        'id',
        'title',
        'done',
        'dueDate',
      ],
    },
    {
      name: 'actividades',
      value: data.activities,
      keys: [
        'id',
        'title',
        'createdAt',
      ],
    },
  ];

  for (const item of lists) {
    for (const entry of item.value) {
      if (
        !entry ||
        typeof entry !== 'object' ||
        !item.keys.every(
          (key) => key in entry,
        )
      ) {
        throw new Error(
          `Hay registros inválidos en ${item.name}.`,
        );
      }
    }
  }

  const settings = data.settings as Record<
    string,
    unknown
  >;

  if (
    typeof settings.organization !== 'string' ||
    typeof settings.userName !== 'string' ||
    !['ARS', 'USD'].includes(
      String(settings.currency),
    )
  ) {
    throw new Error(
      'Configuración inválida.',
    );
  }

  return value as CRMData;
}
