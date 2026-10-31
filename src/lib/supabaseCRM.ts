
import type {
  Activity,
  CRMData,
  Company,
  Contact,
  Deal,
  Task,
} from '../types';

import { supabase } from './supabase';
import type { WorkspaceRole } from './workspace';

export type CRMCollection =
  | 'companies'
  | 'contacts'
  | 'deals'
  | 'tasks';

export type CRMRecord =
  | Company
  | Contact
  | Deal
  | Task;

type CRMTable =
  | 'crm_companies'
  | 'crm_contacts'
  | 'crm_deals'
  | 'crm_tasks';

const TABLES: Record<CRMCollection, CRMTable> = {
  companies: 'crm_companies',
  contacts: 'crm_contacts',
  deals: 'crm_deals',
  tasks: 'crm_tasks',
};

function requireClient() {
  if (!supabase) {
    throw new Error(
      'Supabase no está configurado en esta instalación.',
    );
  }

  return supabase;
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asOptionalNumber(
  value: unknown,
): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asDateTime(value: unknown): string {
  if (typeof value === 'string' && value) {
    return value;
  }

  return new Date().toISOString();
}

function asDate(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

type OrganizationRow = {
  id: string;
  name: string;
  currency: string | null;
  exchange_rate: number | string | null;
  exchange_rate_source: string | null;
  exchange_rate_updated_at: string | null;
};

function isCurrency(value: unknown): value is 'ARS' | 'USD' {
  return value === 'ARS' || value === 'USD';
}

async function readOrganizationRow(
  organizationId: string,
): Promise<OrganizationRow> {
  const client = requireClient();

  const { data, error } = await client
    .from('organizations')
    .select(
      'id, name, currency, exchange_rate, exchange_rate_source, exchange_rate_updated_at',
    )
    .eq('id', organizationId)
    .single();

  if (error) throw error;

  if (!data) {
    throw new Error(
      'No se encontró la organización activa en Supabase.',
    );
  }

  return data as OrganizationRow;
}

async function loadOrganizationSettings(
  organizationId: string,
  fallback: CRMData['settings'],
  role: WorkspaceRole,
): Promise<CRMData['settings']> {
  const client = requireClient();

  let organization = await readOrganizationRow(organizationId);

  // La migración agrega columnas inicialmente nulas.
  // El primer administrador inicializa una sola vez la configuración
  // usando sus preferencias ya guardadas en este navegador.

  if (organization.currency === null) {
    if (role !== 'admin') {
      throw new Error(
        'La configuración monetaria de este espacio todavía no fue inicializada. ' +
          'Pedile al administrador que ingrese primero a NEXO CRM.',
      );
    }

    const fallbackRate = fallback.exchangeRate ?? null;

    const fallbackUpdatedAt =
      fallback.exchangeRateUpdatedAt &&
      Number.isFinite(Date.parse(fallback.exchangeRateUpdatedAt))
        ? fallback.exchangeRateUpdatedAt
        : new Date().toISOString();

    if (fallback.currency === 'USD' && fallbackRate === null) {
      throw new Error(
        'La organización todavía no tiene una cotización guardada. ' +
          'Ingresá primero una cotización válida desde Configuración.',
      );
    }

    const { error: initializeError } = await client.rpc(
      'nexo_initialize_currency_settings',
      {
        p_organization_id: organizationId,
        p_currency: fallback.currency,
        p_exchange_rate: fallbackRate,
        p_exchange_rate_source:
          fallbackRate === null
            ? null
            : fallback.exchangeRateSource ?? 'manual',
        p_exchange_rate_updated_at:
          fallbackRate === null
            ? null
            : fallbackUpdatedAt,
      },
    );

    if (initializeError) throw initializeError;

    // Volvemos a leer para respetar la configuración que haya quedado
    // persistida si dos sesiones inicializaron al mismo tiempo.

    organization = await readOrganizationRow(organizationId);
  }

  if (!isCurrency(organization.currency)) {
    throw new Error(
      'La moneda guardada para esta organización no es válida.',
    );
  }

  const exchangeRate = asOptionalNumber(
    organization.exchange_rate,
  );

  if (
    organization.currency === 'USD' &&
    (exchangeRate === undefined || exchangeRate <= 0)
  ) {
    throw new Error(
      'La organización está configurada en USD, pero no tiene una cotización válida.',
    );
  }

  const source =
    organization.exchange_rate_source === 'manual' ||
    organization.exchange_rate_source === 'oficial'
      ? organization.exchange_rate_source
      : undefined;

  return {
    organization: String(
      organization.name || fallback.organization,
    ),
    userName: fallback.userName,
    currency: organization.currency,
    ...(exchangeRate !== undefined
      ? { exchangeRate }
      : {}),
    ...(source ? { exchangeRateSource: source } : {}),
    ...(organization.exchange_rate_updated_at
      ? {
          exchangeRateUpdatedAt:
            organization.exchange_rate_updated_at,
        }
      : {}),
  };
}

export async function loadCRMData(
  organizationId: string,
  fallbackSettings: CRMData['settings'],
  role: WorkspaceRole,
): Promise<CRMData> {
  const client = requireClient();

  // Primero cargamos la configuración de la organización.
  // Esto garantiza que la moneda ya esté inicializada antes de leer
  // las oportunidades y evita mostrar importes con preferencias locales.

  const settings = await loadOrganizationSettings(
    organizationId,
    fallbackSettings,
    role,
  );

  const [
    companiesResult,
    contactsResult,
    dealsResult,
    tasksResult,
    activitiesResult,
  ] = await Promise.all([
    client
      .from('crm_companies')
      .select('id, name, industry, website, location, employees, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),

    client
      .from('crm_contacts')
      .select('id, name, email, phone, role, company_id, status, source, notes, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),

    client
      .from('crm_deals')
      .select('id, title, company_id, contact_id, amount, amount_base_ars, stage, probability, owner, due_date, notes, created_at, updated_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),

    client
      .from('crm_tasks')
      .select('id, title, description, due_date, priority, done, deal_id, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),

    client
      .from('crm_activities')
      .select('id, type, title, detail, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(150),
  ]);

  const firstError = [
    companiesResult.error,
    contactsResult.error,
    dealsResult.error,
    tasksResult.error,
    activitiesResult.error,
  ].find(Boolean);

  if (firstError) {
    throw firstError;
  }

  const companies: Company[] = (
    companiesResult.data ?? []
  ).map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    industry: String(row.industry ?? ''),
    website: String(row.website ?? ''),
    location: String(row.location ?? ''),
    employees: String(row.employees ?? ''),
    createdAt: asDateTime(row.created_at),
  }));

  const contacts: Contact[] = (
    contactsResult.data ?? []
  ).map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    role: String(row.role ?? ''),
    companyId: String(row.company_id ?? ''),
    status: row.status,
    source: String(row.source ?? 'Manual'),
    notes: String(row.notes ?? ''),
    createdAt: asDateTime(row.created_at),
  }));

  const deals: Deal[] = (
    dealsResult.data ?? []
  ).map((row: any) => ({
    id: String(row.id),
    title: String(row.title ?? ''),
    companyId: String(row.company_id ?? ''),
    contactId: String(row.contact_id ?? ''),
    amount: asNumber(row.amount),
    amountBaseARS: asOptionalNumber(row.amount_base_ars),
    stage: row.stage,
    probability: asNumber(row.probability),
    owner: String(row.owner ?? ''),
    dueDate: asDate(row.due_date),
    notes: String(row.notes ?? ''),
    createdAt: asDateTime(row.created_at),
    updatedAt: asDateTime(row.updated_at),
  }));

  const tasks: Task[] = (
    tasksResult.data ?? []
  ).map((row: any) => ({
    id: String(row.id),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    dueDate: asDate(row.due_date),
    priority: row.priority,
    done: Boolean(row.done),
    dealId: String(row.deal_id ?? ''),
    createdAt: asDateTime(row.created_at),
  }));

  const activities: Activity[] = (
    activitiesResult.data ?? []
  ).map((row: any) => ({
    id: String(row.id),
    type: row.type,
    title: String(row.title ?? ''),
    detail: String(row.detail ?? ''),
    createdAt: asDateTime(row.created_at),
  }));

  return {
    version: 1,
    companies,
    contacts,
    deals,
    tasks,
    activities,
    settings,
  };
}

// ============================================
// CONFIGURACIÓN MONETARIA COMPARTIDA
// ============================================

export async function applyOrganizationCurrencySettings(
  organizationId: string,
  settings: CRMData['settings'],
  activity?: Activity,
): Promise<void> {
  const client = requireClient();

  if (!isCurrency(settings.currency)) {
    throw new Error('La moneda seleccionada no es válida.');
  }

  const exchangeRate = settings.exchangeRate ?? null;

  if (
    exchangeRate !== null &&
    (
      !Number.isFinite(exchangeRate) ||
      exchangeRate <= 0 ||
      exchangeRate > 1_000_000_000
    )
  ) {
    throw new Error('La cotización ingresada no es válida.');
  }

  if (settings.currency === 'USD' && exchangeRate === null) {
    throw new Error(
      'Para utilizar USD necesitás guardar una cotización válida.',
    );
  }

  const { error } = await client.rpc(
    'nexo_apply_currency_settings',
    {
      p_organization_id: organizationId,
      p_currency: settings.currency,
      p_exchange_rate: exchangeRate,
      p_exchange_rate_source:
        exchangeRate === null
          ? null
          : settings.exchangeRateSource ?? 'manual',
      p_exchange_rate_updated_at:
        settings.exchangeRateUpdatedAt ?? null,
      p_activity_id: activity?.id ?? null,
      p_activity_title: activity?.title ?? null,
      p_activity_detail: activity?.detail ?? null,
      p_activity_created_at: activity?.createdAt ?? null,
    },
  );

  if (error) throw error;
}

function recordPayload(
  collection: CRMCollection,
  record: CRMRecord,
): Record<string, unknown> {
  switch (collection) {
    case 'companies': {
      const value = record as Company;

      return {
        name: value.name,
        industry: value.industry,
        website: value.website,
        location: value.location,
        employees: value.employees,
      };
    }

    case 'contacts': {
      const value = record as Contact;

      return {
        name: value.name,
        email: value.email,
        phone: value.phone,
        role: value.role,
        company_id: value.companyId || null,
        status: value.status,
        source: value.source,
        notes: value.notes,
      };
    }

    case 'deals': {
      const value = record as Deal;

      return {
        title: value.title,
        company_id: value.companyId || null,
        contact_id: value.contactId || null,
        amount: value.amount,
        amount_base_ars: value.amountBaseARS ?? null,
        stage: value.stage,
        probability: value.probability,
        owner: value.owner,
        due_date: value.dueDate || null,
        notes: value.notes,
        updated_at: value.updatedAt,
      };
    }

    case 'tasks': {
      const value = record as Task;

      return {
        title: value.title,
        description: value.description,
        due_date: value.dueDate || null,
        priority: value.priority,
        done: value.done,
        deal_id: value.dealId || null,
      };
    }
  }
}

export async function saveCRMRecord(
  collection: CRMCollection,
  record: CRMRecord,
  organizationId: string,
  exists: boolean,
): Promise<void> {
  const client = requireClient();
  const table = TABLES[collection];
  const payload = recordPayload(collection, record);

  if (exists) {
    const { data, error } = await client
      .from(table)
      .update(payload)
      .eq('organization_id', organizationId)
      .eq('id', record.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error(
        'El registro ya no existe o no tenés permisos para editarlo.',
      );
    }

    return;
  }

  const { error } = await client
    .from(table)
    .insert({
      organization_id: organizationId,
      id: record.id,
      ...payload,
      created_at: record.createdAt,
    });

  if (error) throw error;
}

export async function insertCRMActivity(
  activity: Activity,
  organizationId: string,
): Promise<void> {
  const client = requireClient();

  const { data: existing, error: lookupError } = await client
    .from('crm_activities')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('id', activity.id)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existing) return;

  const { error } = await client
    .from('crm_activities')
    .insert({
      organization_id: organizationId,
      id: activity.id,
      type: activity.type,
      title: activity.title,
      detail: activity.detail,
      created_at: activity.createdAt,
    });

  if (error) throw error;
}

export async function deleteCRMRecord(
  collection: CRMCollection,
  id: string,
  organizationId: string,
): Promise<void> {
  const client = requireClient();

  // Desvincular tareas antes de eliminar una oportunidad.
  if (collection === 'deals') {
    const { error: detachError } = await client
      .from('crm_tasks')
      .update({ deal_id: null })
      .eq('organization_id', organizationId)
      .eq('deal_id', id);

    if (detachError) throw detachError;
  }

  // Desvincular oportunidades antes de eliminar un contacto.
  if (collection === 'contacts') {
    const { error: detachError } = await client
      .from('crm_deals')
      .update({
        contact_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .eq('contact_id', id);

    if (detachError) throw detachError;
  }

  const { data, error } = await client
    .from(TABLES[collection])
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error(
      'No se pudo eliminar el registro. Puede que ya no exista o que no tengas permisos de administrador.',
    );
  }
}

export async function updateOrganizationName(
  organizationId: string,
  name: string,
): Promise<void> {
  const client = requireClient();

  const { data, error } = await client
    .from('organizations')
    .update({ name })
    .eq('id', organizationId)
    .select('id')
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error(
      'No se pudo actualizar el espacio de trabajo. Verificá tus permisos de administrador.',
    );
  }
}

export async function syncCRMBackup(
  current: CRMData,
  next: CRMData,
  organizationId: string,
): Promise<void> {
  const collections: CRMCollection[] = [
    'companies',
    'contacts',
    'deals',
    'tasks',
  ];

  // Primero se crean o actualizan los registros padre.
  for (const collection of collections) {
    const currentRows = current[collection] as CRMRecord[];
    const nextRows = next[collection] as CRMRecord[];

    const currentById = new Map(
      currentRows.map((record) => [record.id, record]),
    );

    for (const record of nextRows) {
      const previous = currentById.get(record.id);
      const exists = Boolean(previous);

      if (
        previous &&
        JSON.stringify(previous) === JSON.stringify(record)
      ) {
        continue;
      }

      await saveCRMRecord(
        collection,
        record,
        organizationId,
        exists,
      );
    }
  }

  // Luego se eliminan en orden inverso a las dependencias.
  const deleteOrder: CRMCollection[] = [
    'tasks',
    'deals',
    'contacts',
    'companies',
  ];

  for (const collection of deleteOrder) {
    const currentRows = current[collection] as CRMRecord[];

    const nextIds = new Set(
      (next[collection] as CRMRecord[]).map(
        (record) => record.id,
      ),
    );

    for (const record of currentRows) {
      if (!nextIds.has(record.id)) {
        await deleteCRMRecord(
          collection,
          record.id,
          organizationId,
        );
      }
    }
  }

  // El historial es de solo inserción.
  // Nunca eliminamos actividades existentes.

  const currentActivityIds = new Set(
    current.activities.map((activity) => activity.id),
  );

  for (const activity of next.activities) {
    if (currentActivityIds.has(activity.id)) continue;

    await insertCRMActivity(activity, organizationId);
  }
}
