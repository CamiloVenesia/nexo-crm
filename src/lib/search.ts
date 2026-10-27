
import type { CRMData, Page } from '../types';

export interface SearchResult {
  id: string;
  kind: 'deal' | 'contact' | 'company' | 'task';
  page: Page;
  title: string;
  detail: string;
}

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR')
    .trim();
}

export function searchCRM(
  data: CRMData,
  query: string,
  limit = 8,
): SearchResult[] {
  const normalized = normalizeSearch(query);

  if (normalized.length < 2 || limit <= 0) {
    return [];
  }

  const companyNames = new Map(
    data.companies.map((company) => [
      company.id,
      company.name,
    ]),
  );

  const contactNames = new Map(
    data.contacts.map((contact) => [
      contact.id,
      contact.name,
    ]),
  );

  const matches = (text: string) =>
    normalizeSearch(text).includes(normalized);

  const opportunities: SearchResult[] = data.deals
    .filter((deal) =>
      matches(
        [
          deal.title,
          deal.owner,
          deal.notes,
          companyNames.get(deal.companyId) ?? '',
          contactNames.get(deal.contactId) ?? '',
        ].join(' '),
      ),
    )
    .map((deal): SearchResult => ({
      id: deal.id,
      kind: 'deal',
      page: 'deals',
      title: deal.title,
      detail: `Oportunidad · ${
        companyNames.get(deal.companyId) ?? 'Sin empresa'
      }`,
    }));

  const contacts: SearchResult[] = data.contacts
    .filter((contact) =>
      matches(
        [
          contact.name,
          contact.email,
          contact.phone,
          contact.role,
          companyNames.get(contact.companyId) ?? '',
        ].join(' '),
      ),
    )
    .map((contact): SearchResult => ({
      id: contact.id,
      kind: 'contact',
      page: 'contacts',
      title: contact.name,
      detail: `Contacto · ${
        companyNames.get(contact.companyId) ?? 'Sin empresa'
      }`,
    }));

  const companies: SearchResult[] = data.companies
    .filter((company) =>
      matches(
        [
          company.name,
          company.industry,
          company.location,
        ].join(' '),
      ),
    )
    .map((company): SearchResult => ({
      id: company.id,
      kind: 'company',
      page: 'companies',
      title: company.name,
      detail: `Empresa · ${
        company.industry || 'Sin sector'
      }`,
    }));

  const tasks: SearchResult[] = data.tasks
    .filter((task) =>
      matches(
        [
          task.title,
          task.description,
          data.deals.find(
            (deal) => deal.id === task.dealId,
          )?.title ?? '',
        ].join(' '),
      ),
    )
    .map((task): SearchResult => ({
      id: task.id,
      kind: 'task',
      page: 'tasks',
      title: task.title,
      detail: `Tarea · ${
        task.done ? 'Completada' : 'Pendiente'
      }`,
    }));

  return [
    ...opportunities,
    ...contacts,
    ...companies,
    ...tasks,
  ].slice(0, limit);
}
