
import type { CRMData, Settings } from '../types';

export const MAX_BACKUP_BYTES = 3_000_000;
export const MAX_PREFERENCE_LENGTH = 80;

export type PreferencesResult =
  | { ok: true; value: Settings }
  | { ok: false; error: string };

const containsControlCharacters = (value: string) =>
  /[\u0000-\u001f\u007f]/.test(value);

export function validatePreferences(
  organization: string,
  userName: string,
  currency: Settings['currency'],
): PreferencesResult {
  const org = organization.trim();
  const name = userName.trim();

  if (!org) {
    return {
      ok: false,
      error: 'Ingresá un nombre para el espacio de trabajo.',
    };
  }

  if (!name) {
    return {
      ok: false,
      error: 'Ingresá tu nombre.',
    };
  }

  if (
    org.length > MAX_PREFERENCE_LENGTH ||
    name.length > MAX_PREFERENCE_LENGTH
  ) {
    return {
      ok: false,
      error:
        'El espacio de trabajo y tu nombre deben tener hasta 80 caracteres.',
    };
  }

  if (
    containsControlCharacters(org) ||
    containsControlCharacters(name)
  ) {
    return {
      ok: false,
      error:
        'Los nombres no pueden contener saltos de línea ni caracteres de control.',
    };
  }

  if (currency !== 'ARS' && currency !== 'USD') {
    return {
      ok: false,
      error: 'Seleccioná una moneda válida.',
    };
  }

  return {
    ok: true,
    value: {
      organization: org,
      userName: name,
      currency,
    },
  };
}

export function validateBackupFile(
  file: Pick<File, 'name' | 'size'>,
): string | null {
  if (!file.name.toLowerCase().endsWith('.json')) {
    return 'Seleccioná un archivo .json generado por NEXO CRM.';
  }

  if (file.size === 0) {
    return 'El archivo está vacío.';
  }

  if (
    !Number.isFinite(file.size) ||
    file.size > MAX_BACKUP_BYTES
  ) {
    return 'El archivo supera el límite de 3 MB.';
  }

  return null;
}

export function summarizeCRMData(data: CRMData) {
  return {
    companies: data.companies.length,
    contacts: data.contacts.length,
    deals: data.deals.length,
    tasks: data.tasks.length,
    activities: data.activities.length,
  };
}
