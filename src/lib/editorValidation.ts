
import type {
  CRMData,
  Company,
  Contact,
  Deal,
  Task,
} from '../types';

export type EditorKind =
  | 'deal'
  | 'contact'
  | 'company'
  | 'task';

export type EditorEntity =
  | Deal
  | Contact
  | Company
  | Task;

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase('es-AR');

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validateEditor(
  kind: EditorKind,
  form: EditorEntity,
  data: CRMData,
): string | null {
  switch (kind) {
    case 'deal': {
      const deal = form as Deal;

      if (!deal.title.trim()) {
        return 'Ingresá el nombre de la oportunidad.';
      }

      if (deal.title.trim().length > 110) {
        return 'El nombre de la oportunidad es demasiado largo.';
      }

      if (
        !Number.isFinite(deal.amount) ||
        deal.amount < 0 ||
        deal.amount > 1_000_000_000_000_000
      ) {
        return 'El importe debe ser un número válido y mayor o igual que cero.';
      }

      if (
        !Number.isFinite(deal.probability) ||
        deal.probability < 0 ||
        deal.probability > 100
      ) {
        return 'La probabilidad debe estar entre 0 y 100.';
      }

      if (!deal.owner.trim()) {
        return 'Indicá un responsable para la oportunidad.';
      }

      if (deal.dueDate && !validDate(deal.dueDate)) {
        return 'Ingresá una fecha de cierre válida.';
      }

      if (
        deal.companyId &&
        !data.companies.some(
          (company) => company.id === deal.companyId,
        )
      ) {
        return 'La empresa seleccionada ya no existe.';
      }

      if (deal.contactId) {
        const contact = data.contacts.find(
          (item) => item.id === deal.contactId,
        );

        if (!contact) {
          return 'El contacto seleccionado ya no existe.';
        }

        if (
          deal.companyId &&
          contact.companyId &&
          deal.companyId !== contact.companyId
        ) {
          return 'El contacto pertenece a otra empresa. Seleccioná uno de la empresa elegida.';
        }
      }

      return null;
    }

    case 'contact': {
      const contact = form as Contact;

      if (!contact.name.trim()) {
        return 'Ingresá el nombre del contacto.';
      }

      if (contact.name.trim().length > 100) {
        return 'El nombre del contacto es demasiado largo.';
      }

      const email = normalize(contact.email);

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return 'Ingresá un correo electrónico válido.';
      }

      if (
        email &&
        data.contacts.some(
          (item) =>
            item.id !== contact.id &&
            normalize(item.email) === email,
        )
      ) {
        return 'Ya existe otro contacto con ese correo electrónico.';
      }

      if (
        contact.companyId &&
        !data.companies.some(
          (company) => company.id === contact.companyId,
        )
      ) {
        return 'La empresa seleccionada ya no existe.';
      }

      const incompatibleDeal = data.deals.some(
        (deal) =>
          deal.contactId === contact.id &&
          deal.companyId !== '' &&
          contact.companyId !== '' &&
          deal.companyId !== contact.companyId,
      );

      if (incompatibleDeal) {
        return 'Este contacto tiene oportunidades asociadas a otra empresa. Actualizá primero esas oportunidades.';
      }

      return null;
    }

    case 'company': {
      const company = form as Company;

      if (!company.name.trim()) {
        return 'Ingresá el nombre de la empresa.';
      }

      if (company.name.trim().length > 110) {
        return 'El nombre de la empresa es demasiado largo.';
      }

      const duplicate = data.companies.some(
        (item) =>
          item.id !== company.id &&
          normalize(item.name) === normalize(company.name),
      );

      if (duplicate) {
        return 'Ya existe una empresa con ese nombre.';
      }

      return null;
    }

    case 'task': {
      const task = form as Task;

      if (!task.title.trim()) {
        return 'Ingresá el título de la tarea.';
      }

      if (task.title.trim().length > 150) {
        return 'El título de la tarea es demasiado largo.';
      }

      if (!validDate(task.dueDate)) {
        return 'Seleccioná una fecha de vencimiento válida.';
      }

      if (
        task.dealId &&
        !data.deals.some(
          (deal) => deal.id === task.dealId,
        )
      ) {
        return 'La oportunidad vinculada ya no existe.';
      }

      const duplicate = data.tasks.some(
        (item) =>
          item.id !== task.id &&
          !item.done &&
          !task.done &&
          normalize(item.title) === normalize(task.title) &&
          item.dealId === task.dealId &&
          item.dueDate === task.dueDate,
      );

      if (duplicate) {
        return 'Ya existe una tarea pendiente con ese título, oportunidad y fecha.';
      }

      return null;
    }
  }
}
