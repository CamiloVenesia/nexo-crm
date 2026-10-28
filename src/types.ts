
export type Stage =
  | 'prospeccion'
  | 'calificacion'
  | 'propuesta'
  | 'negociacion'
  | 'ganado'
  | 'perdido';

export type LeadStatus = 'nuevo' | 'contactado' | 'calificado';
export type Priority = 'alta' | 'media' | 'baja';

export type ActivityType =
  | 'deal'
  | 'task'
  | 'contact'
  | 'company'
  | 'note'
  | 'system';

export type Page =
  | 'dashboard'
  | 'deals'
  | 'contacts'
  | 'companies'
  | 'tasks'
  | 'activity'
  | 'insights'
  | 'settings';

export interface Deal {
  id: string;
  title: string;
  companyId: string;
  contactId: string;
  amount: number;

  /** Referencia ARS sin redondeo de conversiones. */
  amountBaseARS?: number;

  stage: Stage;
  probability: number;
  owner: string;
  dueDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  companyId: string;
  status: LeadStatus;
  source: string;
  notes: string;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  website: string;
  location: string;
  employees: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: Priority;
  done: boolean;
  dealId: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  createdAt: string;
}

export interface Settings {
  organization: string;
  currency: 'ARS' | 'USD';
  userName: string;
  exchangeRate?: number;
  exchangeRateUpdatedAt?: string;
  exchangeRateSource?: 'manual' | 'oficial';
}

export interface CRMData {
  version: 1;
  deals: Deal[];
  contacts: Contact[];
  companies: Company[];
  tasks: Task[];
  activities: Activity[];
  settings: Settings;
}

export const STAGES: {
  id: Stage;
  label: string;
  short: string;
  probability: number;
  color: string;
}[] = [
  { id: 'prospeccion', label: 'Prospección', short: 'Prospección', probability: 15, color: '#4b9dff' },
  { id: 'calificacion', label: 'Calificación', short: 'Calificación', probability: 35, color: '#6d77fa' },
  { id: 'propuesta', label: 'Propuesta', short: 'Propuesta', probability: 60, color: '#9770f4' },
  { id: 'negociacion', label: 'Negociación', short: 'Negociación', probability: 80, color: '#e29df3' },
  { id: 'ganado', label: 'Ganado', short: 'Ganado', probability: 100, color: '#35d7ad' },
  { id: 'perdido', label: 'Perdido', short: 'Perdido', probability: 0, color: '#ff738d' },
];
