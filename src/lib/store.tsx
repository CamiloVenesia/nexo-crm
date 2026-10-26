
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CRMData,
  Deal,
  Company,
  Contact,
  Task,
  Settings,
  ActivityType,
} from '../types';

import { createId, initialData, seedDemo } from './seed';

import {
  Collection,
  deleteRecord,
} from './integrity';

import { assertData } from './utils';

type Entity = Deal | Company | Contact | Task;

interface Store {
  data: CRMData;

  upsertDeal: (value: Deal) => void;
  removeDeal: (id: string) => void;
  changeStage: (id: string, stage: Deal['stage']) => void;

  upsertContact: (value: Contact) => void;
  removeContact: (id: string) => void;

  upsertCompany: (value: Company) => void;
  removeCompany: (id: string) => void;

  upsertTask: (value: Task) => void;
  removeTask: (id: string) => void;
  toggleTask: (id: string) => void;

  updateSettings: (value: Settings) => void;

  restore: (value: CRMData) => void;
  reset: () => void;

  notification: string;
  notify: (message: string) => void;
}

const StoreContext = createContext<Store | null>(null);

const dateNow = () => new Date().toISOString();

const historyItem = (
  type: ActivityType,
  title: string,
  detail: string,
) => ({
  id: createId(),
  type,
  title,
  detail,
  createdAt: dateNow(),
});

export function CRMProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [data, setData] = useState<CRMData>(initialData);
  const [notification, setNotification] = useState('');

  // Guardado de la demo en el navegador.
  useEffect(() => {
    try {
      localStorage.setItem(
        'nexo-crm-v1',
        JSON.stringify(data),
      );
    } catch {
      // Si el navegador bloquea el almacenamiento,
      // el CRM sigue funcionando durante la sesión.
    }
  }, [data]);

  // Ocultar notificaciones después de 3,5 segundos.
  useEffect(() => {
    if (!notification) return;

    const timer = window.setTimeout(() => {
      setNotification('');
    }, 3500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notification]);

  const notify = useCallback((message: string) => {
    setNotification(message);
  }, []);

  // Crear o actualizar registros.
  const update = useCallback(
    (
      collection: Collection,
      entry: Entity,
      description: string,
      type: ActivityType,
    ) => {
      setData((previous) => {
        const current = previous[collection] as Entity[];

        const exists = current.some(
          (item) => item.id === entry.id,
        );

        const updated = exists
          ? current.map((item) =>
              item.id === entry.id ? entry : item,
            )
          : [entry, ...current];

        return {
          ...previous,
          [collection]: updated,
          activities: [
            historyItem(
              type,
              exists
                ? 'Registro actualizado'
                : 'Nuevo registro',
              description,
            ),
            ...previous.activities,
          ].slice(0, 150),
        };
      });

      notify('Cambios guardados correctamente.');
    },
    [notify],
  );

  const upsertDeal = useCallback(
    (value: Deal) => {
      update('deals', value, value.title, 'deal');
    },
    [update],
  );

  const upsertContact = useCallback(
    (value: Contact) => {
      update('contacts', value, value.name, 'contact');
    },
    [update],
  );

  const upsertCompany = useCallback(
    (value: Company) => {
      update('companies', value, value.name, 'company');
    },
    [update],
  );

  const upsertTask = useCallback(
    (value: Task) => {
      update('tasks', value, value.title, 'task');
    },
    [update],
  );

  // Eliminar registros respetando sus relaciones.
  const removeEntity = useCallback(
    (
      collection: Collection,
      id: string,
      type: ActivityType,
    ) => {
      const result = deleteRecord(
        data,
        collection,
        id,
      );

      if (result.status !== 'deleted') {
        notify(result.message);
        return;
      }

      setData((previous) => {
        const currentResult = deleteRecord(
          previous,
          collection,
          id,
        );

        if (currentResult.status !== 'deleted') {
          return previous;
        }

        return {
          ...currentResult.data,
          activities: [
            historyItem(
              type,
              'Registro eliminado',
              currentResult.title,
            ),
            ...currentResult.data.activities,
          ].slice(0, 150),
        };
      });

      notify(result.message);
    },
    [data, notify],
  );

  const removeDeal = useCallback(
    (id: string) => {
      removeEntity('deals', id, 'deal');
    },
    [removeEntity],
  );

  const removeContact = useCallback(
    (id: string) => {
      removeEntity('contacts', id, 'contact');
    },
    [removeEntity],
  );

  const removeCompany = useCallback(
    (id: string) => {
      removeEntity('companies', id, 'company');
    },
    [removeEntity],
  );

  const removeTask = useCallback(
    (id: string) => {
      removeEntity('tasks', id, 'task');
    },
    [removeEntity],
  );

  // Cambiar la etapa de una oportunidad.
  const changeStage = useCallback(
    (id: string, stage: Deal['stage']) => {
      const current = data.deals.find(
        (deal) => deal.id === id,
      );

      if (!current) {
        notify('La oportunidad ya no existe.');
        return;
      }

      if (current.stage === stage) {
        return;
      }

      const probability = {
        prospeccion: 15,
        calificacion: 35,
        propuesta: 60,
        negociacion: 80,
        ganado: 100,
        perdido: 0,
      }[stage];

      setData((previous) => {
        const old = previous.deals.find(
          (deal) => deal.id === id,
        );

        if (!old || old.stage === stage) {
          return previous;
        }

        return {
          ...previous,
          deals: previous.deals.map((deal) =>
            deal.id === id
              ? {
                  ...deal,
                  stage,
                  probability,
                  updatedAt: dateNow(),
                }
              : deal,
          ),
          activities: [
            historyItem(
              'deal',
              stage === 'ganado'
                ? 'Venta ganada'
                : stage === 'perdido'
                  ? 'Oportunidad perdida'
                  : 'Etapa actualizada',
              old.title,
            ),
            ...previous.activities,
          ].slice(0, 150),
        };
      });

      notify('Etapa de la oportunidad actualizada.');
    },
    [data.deals, notify],
  );

  // Completar o reabrir una tarea.
  const toggleTask = useCallback(
    (id: string) => {
      const task = data.tasks.find(
        (item) => item.id === id,
      );

      if (!task) {
        notify('La tarea ya no existe.');
        return;
      }

      setData((previous) => ({
        ...previous,
        tasks: previous.tasks.map((item) =>
          item.id === id
            ? {
                ...item,
                done: !item.done,
              }
            : item,
        ),
        activities: [
          historyItem(
            'task',
            task.done
              ? 'Tarea reabierta'
              : 'Tarea completada',
            task.title,
          ),
          ...previous.activities,
        ].slice(0, 150),
      }));
    },
    [data.tasks, notify],
  );

  // Preferencias generales.
  const updateSettings = useCallback(
    (value: Settings) => {
      setData((previous) => ({
        ...previous,
        settings: value,
      }));

      notify('Preferencias actualizadas.');
    },
    [notify],
  );

  // Restaurar un respaldo validado.
  const restore = useCallback(
    (value: CRMData) => {
      try {
        const validated = assertData(value);

        setData(validated);

        notify(
          'Respaldo restaurado correctamente.',
        );
      } catch {
        notify(
          'No se restauró el respaldo: contiene datos inválidos.',
        );
      }
    },
    [notify],
  );

  // Restablecer los datos ficticios iniciales.
  const reset = useCallback(() => {
    setData(seedDemo());

    notify('Datos de demostración restaurados.');
  }, [notify]);

  const store = useMemo(
    () => ({
      data,

      upsertDeal,
      removeDeal,
      changeStage,

      upsertContact,
      removeContact,

      upsertCompany,
      removeCompany,

      upsertTask,
      removeTask,
      toggleTask,

      updateSettings,

      restore,
      reset,

      notification,
      notify,
    }),
    [
      data,
      upsertDeal,
      removeDeal,
      changeStage,
      upsertContact,
      removeContact,
      upsertCompany,
      removeCompany,
      upsertTask,
      removeTask,
      toggleTask,
      updateSettings,
      restore,
      reset,
      notification,
      notify,
    ],
  );

  return (
    <StoreContext.Provider value={store}>
      {children}
    </StoreContext.Provider>
  );
}

export function useCRM() {
  const store = useContext(StoreContext);

  if (!store) {
    throw new Error('CRMProvider missing');
  }

  return store;
}
