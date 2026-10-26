
import {
  CRMData,
  Deal,
  Stage,
  STAGES,
} from '../types';

// ==================================================
// IDENTIFICADORES Y FECHAS
// ==================================================

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

export const fmtDate = (date: string) => {
  if (!date) return 'Sin fecha';

  const parsed = new Date(
    `${date.slice(0, 10)}T12:00:00`,
  );

  if (Number.isNaN(parsed.getTime())) {
    return 'Fecha inválida';
  }

  return parsed.toLocaleDateString('es-AR', {
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

// ==================================================
// FORMATO DE DATOS
// ==================================================

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

export const initials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

// ==================================================
// PIPELINE COMERCIAL
// ==================================================

export const stageById = (id: Stage) =>
  STAGES.find((stage) => stage.id === id) ??
  STAGES[0];

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

// ==================================================
// EXPORTACIONES
// ==================================================

export function csvDownload(
  filename: string,
  rows: (string | number)[][],
) {
  const quote = (value: string | number) => {
    let text = String(value ?? '');

    // Evita que un valor de texto se ejecute como
    // fórmula al abrir el CSV en una planilla.
    if (
      typeof value === 'string' &&
      /^[\s]*[=+\-@]/.test(text)
    ) {
      text = `'${text}`;
    }

    return `"${text.replace(/"/g, '""')}"`;
  };

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

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 500);
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

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 500);
}

// ==================================================
// VALIDACIÓN DE RESPALDOS
// ==================================================

type DataObject = Record<string, unknown>;

const MAX_RECORDS = 10_000;
const MAX_TEXT_LENGTH = 10_000;

const VALID_STAGES = new Set([
  'prospeccion',
  'calificacion',
  'propuesta',
  'negociacion',
  'ganado',
  'perdido',
]);

const VALID_STATUSES = new Set([
  'nuevo',
  'contactado',
  'calificado',
]);

const VALID_PRIORITIES = new Set([
  'alta',
  'media',
  'baja',
]);

const VALID_ACTIVITIES = new Set([
  'deal',
  'task',
  'contact',
  'company',
  'note',
  'system',
]);

function objectValue(
  value: unknown,
  description: string,
): DataObject {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${description} debe ser un objeto válido.`,
    );
  }

  return value as DataObject;
}

function stringValue(
  object: DataObject,
  field: string,
  description: string,
  required = false,
): string {
  const value = object[field];

  if (
    typeof value !== 'string' ||
    value.length > MAX_TEXT_LENGTH ||
    (required && !value.trim())
  ) {
    throw new Error(
      `Campo inválido: ${description}.`,
    );
  }

  return value;
}

function numberValue(
  object: DataObject,
  field: string,
  description: string,
  minimum: number,
  maximum: number,
): number {
  const value = object[field];

  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `Valor numérico inválido: ${description}.`,
    );
  }

  return value;
}

function enumValue(
  object: DataObject,
  field: string,
  allowed: Set<string>,
  description: string,
) {
  const value = stringValue(
    object,
    field,
    description,
    true,
  );

  if (!allowed.has(value)) {
    throw new Error(
      `Valor no permitido: ${description}.`,
    );
  }
}

function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const [year, month, day] = date
    .split('-')
    .map(Number);

  const parsed = new Date(
    Date.UTC(year, month - 1, day),
  );

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function dateValue(
  object: DataObject,
  field: string,
  description: string,
  optional = false,
) {
  const value = stringValue(
    object,
    field,
    description,
    !optional,
  );

  if (optional && !value) return;

  if (!validDate(value)) {
    throw new Error(
      `Fecha inválida: ${description}.`,
    );
  }
}

function timestampValue(
  object: DataObject,
  field: string,
  description: string,
) {
  const value = stringValue(
    object,
    field,
    description,
    true,
  );

  if (Number.isNaN(Date.parse(value))) {
    throw new Error(
      `Fecha de registro inválida: ${description}.`,
    );
  }
}

function arrayValue(
  object: DataObject,
  field: string,
): DataObject[] {
  const value = object[field];

  if (
    !Array.isArray(value) ||
    value.length > MAX_RECORDS
  ) {
    throw new Error(
      `La colección ${field} es inválida.`,
    );
  }

  return value.map((item, index) =>
    objectValue(item, `${field}[${index}]`),
  );
}

function checkUniqueIds(
  records: DataObject[],
  collection: string,
) {
  const ids = new Set<string>();

  for (const record of records) {
    const id = stringValue(
      record,
      'id',
      `${collection}.id`,
      true,
    );

    if (ids.has(id)) {
      throw new Error(
        `Hay identificadores duplicados en ${collection}.`,
      );
    }

    ids.add(id);
  }
}

// ==================================================
// VALIDACIÓN PRINCIPAL
// ==================================================

export function assertData(value: unknown): CRMData {
  const root = objectValue(
    value,
    'El respaldo',
  );

  if (root.version !== 1) {
    throw new Error(
      'Versión de respaldo incompatible.',
    );
  }

  const companies = arrayValue(
    root,
    'companies',
  );

  const contacts = arrayValue(
    root,
    'contacts',
  );

  const deals = arrayValue(
    root,
    'deals',
  );

  const tasks = arrayValue(
    root,
    'tasks',
  );

  const activities = arrayValue(
    root,
    'activities',
  );

  const collections = [
    { name: 'empresas', records: companies },
    { name: 'contactos', records: contacts },
    { name: 'oportunidades', records: deals },
    { name: 'tareas', records: tasks },
    { name: 'actividad', records: activities },
  ];

  for (const collection of collections) {
    checkUniqueIds(
      collection.records,
      collection.name,
    );
  }

  // ------------------------------------------------
  // EMPRESAS
  // ------------------------------------------------

  for (const company of companies) {
    stringValue(company, 'name', 'Empresa.nombre', true);
    stringValue(company, 'industry', 'Empresa.sector');
    stringValue(company, 'website', 'Empresa.sitio');
    stringValue(company, 'location', 'Empresa.ubicación');
    stringValue(company, 'employees', 'Empresa.empleados');

    timestampValue(
      company,
      'createdAt',
      'Empresa.creación',
    );
  }

  // ------------------------------------------------
  // CONTACTOS
  // ------------------------------------------------

  for (const contact of contacts) {
    stringValue(contact, 'name', 'Contacto.nombre', true);
    stringValue(contact, 'email', 'Contacto.correo');
    stringValue(contact, 'phone', 'Contacto.teléfono');
    stringValue(contact, 'role', 'Contacto.cargo');
    stringValue(contact, 'companyId', 'Contacto.empresa');
    stringValue(contact, 'source', 'Contacto.origen');
    stringValue(contact, 'notes', 'Contacto.notas');

    enumValue(
      contact,
      'status',
      VALID_STATUSES,
      'Contacto.estado',
    );

    timestampValue(
      contact,
      'createdAt',
      'Contacto.creación',
    );
  }

  // ------------------------------------------------
  // OPORTUNIDADES
  // ------------------------------------------------

  for (const deal of deals) {
    stringValue(deal, 'title', 'Oportunidad.título', true);
    stringValue(deal, 'companyId', 'Oportunidad.empresa');
    stringValue(deal, 'contactId', 'Oportunidad.contacto');
    stringValue(deal, 'owner', 'Oportunidad.responsable', true);
    stringValue(deal, 'notes', 'Oportunidad.notas');

    numberValue(
      deal,
      'amount',
      'Oportunidad.importe',
      0,
      1_000_000_000_000_000,
    );

    numberValue(
      deal,
      'probability',
      'Oportunidad.probabilidad',
      0,
      100,
    );

    enumValue(
      deal,
      'stage',
      VALID_STAGES,
      'Oportunidad.etapa',
    );

    dateValue(
      deal,
      'dueDate',
      'Oportunidad.cierre',
      true,
    );

    timestampValue(
      deal,
      'createdAt',
      'Oportunidad.creación',
    );

    timestampValue(
      deal,
      'updatedAt',
      'Oportunidad.actualización',
    );
  }

  // ------------------------------------------------
  // TAREAS
  // ------------------------------------------------

  for (const task of tasks) {
    stringValue(task, 'title', 'Tarea.título', true);
    stringValue(task, 'description', 'Tarea.descripción');
    stringValue(task, 'dealId', 'Tarea.oportunidad');

    dateValue(
      task,
      'dueDate',
      'Tarea.vencimiento',
      true,
    );

    enumValue(
      task,
      'priority',
      VALID_PRIORITIES,
      'Tarea.prioridad',
    );

    if (typeof task.done !== 'boolean') {
      throw new Error(
        'El estado de una tarea es inválido.',
      );
    }

    timestampValue(
      task,
      'createdAt',
      'Tarea.creación',
    );
  }

  // ------------------------------------------------
  // ACTIVIDAD
  // ------------------------------------------------

  for (const activity of activities) {
    stringValue(
      activity,
      'title',
      'Actividad.título',
      true,
    );

    stringValue(
      activity,
      'detail',
      'Actividad.detalle',
    );

    enumValue(
      activity,
      'type',
      VALID_ACTIVITIES,
      'Actividad.tipo',
    );

    timestampValue(
      activity,
      'createdAt',
      'Actividad.creación',
    );
  }

  // ------------------------------------------------
  // CONFIGURACIÓN
  // ------------------------------------------------

  const settings = objectValue(
    root.settings,
    'La configuración',
  );

  stringValue(
    settings,
    'organization',
    'Organización',
    true,
  );

  stringValue(
    settings,
    'userName',
    'Nombre de usuario',
    true,
  );

  enumValue(
    settings,
    'currency',
    new Set(['ARS', 'USD']),
    'Moneda',
  );

  // ------------------------------------------------
  // INTEGRIDAD REFERENCIAL
  // ------------------------------------------------

  const companyIds = new Set(
    companies.map((company) => company.id),
  );

  const contactIds = new Set(
    contacts.map((contact) => contact.id),
  );

  const dealIds = new Set(
    deals.map((deal) => deal.id),
  );

  for (const contact of contacts) {
    if (
      contact.companyId &&
      !companyIds.has(contact.companyId as string)
    ) {
      throw new Error(
        'Hay un contacto vinculado a una empresa inexistente.',
      );
    }
  }

  for (const deal of deals) {
    if (
      deal.companyId &&
      !companyIds.has(deal.companyId as string)
    ) {
      throw new Error(
        'Hay una oportunidad vinculada a una empresa inexistente.',
      );
    }

    if (
      deal.contactId &&
      !contactIds.has(deal.contactId as string)
    ) {
      throw new Error(
        'Hay una oportunidad vinculada a un contacto inexistente.',
      );
    }
  }

  for (const task of tasks) {
    if (
      task.dealId &&
      !dealIds.has(task.dealId as string)
    ) {
      throw new Error(
        'Hay una tarea vinculada a una oportunidad inexistente.',
      );
    }
  }

  return value as CRMData;
}
