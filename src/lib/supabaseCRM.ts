
import type {
  Activity,
  CRMData,
  Company,
  Contact,
  Deal,
  Task,
} from '../types';

import { supabase } from './supabase';

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

export async function loadCRMData(
  organizationId: string,
  settings: CRMData['settings'],
): Promise<CRMData> {
  const client = requireClient();

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
