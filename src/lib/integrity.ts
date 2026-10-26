
import { CRMData } from '../types';

export type Collection =
  | 'deals'
  | 'contacts'
  | 'companies'
  | 'tasks';

export interface DeleteResult {
  status: 'deleted' | 'blocked' | 'not-found';
  data: CRMData;
  message: string;
  title: string;
}

export function deleteRecord(
  data: CRMData,
  collection: Collection,
  id: string,
): DeleteResult {
  const record = data[collection].find(
    (item) => item.id === id,
  );

  if (!record) {
    return {
      status: 'not-found',
      data,
      message: 'El registro ya no existe.',
      title: id,
    };
  }

  const title =
    'title' in record
      ? record.title
      : 'name' in record
        ? record.name
        : id;

  switch (collection) {
    case 'deals': {
      const linkedTasks = data.tasks.filter(
        (task) => task.dealId === id,
      ).length;

      return {
        status: 'deleted',
        data: {
          ...data,
          deals: data.deals.filter(
            (deal) => deal.id !== id,
          ),
          tasks: data.tasks.map((task) =>
            task.dealId === id
              ? { ...task, dealId: '' }
              : task,
          ),
        },
        title,
        message: linkedTasks
          ? 'Oportunidad eliminada. Las tareas relacionadas se conservaron sin vinculación.'
          : 'Oportunidad eliminada correctamente.',
      };
    }

    case 'contacts': {
      const linkedDeals = data.deals.filter(
        (deal) => deal.contactId === id,
      ).length;

      return {
        status: 'deleted',
        data: {
          ...data,
          contacts: data.contacts.filter(
            (contact) => contact.id !== id,
          ),
          deals: data.deals.map((deal) =>
            deal.contactId === id
              ? {
                  ...deal,
                  contactId: '',
                  updatedAt: new Date().toISOString(),
                }
              : deal,
          ),
        },
        title,
        message: linkedDeals
          ? 'Contacto eliminado. Las oportunidades relacionadas conservaron sus datos.'
          : 'Contacto eliminado correctamente.',
      };
    }

    case 'companies': {
      const hasContacts = data.contacts.some(
        (contact) => contact.companyId === id,
      );

      const hasDeals = data.deals.some(
        (deal) => deal.companyId === id,
      );

      if (hasContacts || hasDeals) {
        return {
          status: 'blocked',
          data,
          title,
          message:
            'No se puede eliminar esta empresa porque tiene contactos u oportunidades asociados. Desvinculalos primero.',
        };
      }

      return {
        status: 'deleted',
        data: {
          ...data,
          companies: data.companies.filter(
            (company) => company.id !== id,
          ),
        },
        title,
        message: 'Empresa eliminada correctamente.',
      };
    }

    case 'tasks': {
      return {
        status: 'deleted',
        data: {
          ...data,
          tasks: data.tasks.filter(
            (task) => task.id !== id,
          ),
        },
        title,
        message: 'Tarea eliminada correctamente.',
      };
    }
  }
}
