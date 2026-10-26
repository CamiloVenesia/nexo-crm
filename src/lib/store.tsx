
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

import {
  createId,
  initialData,
  seedDemo,
} from './seed';

type Entity = Deal | Company | Contact | Task;

interface Store {
  data: CRMData;

  upsertDeal: (value: Deal) => void;
  removeDeal: (id: string) => void;
  changeStage: (
    id: string,
    stage: Deal['stage'],
  ) => void;

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

  useEffect(() => {
    try {
      localStorage.setItem(
        'nexo-crm-v1',
        JSON.stringify(data),
      );
    } catch {
      /* storage blocked; UI still works in session */
    }
  }, [data]);

  useEffect(() => {
    if (!notification) return;

    const timer = window.setTimeout(
      () => setNotification(''),
      3500,
    );

    return () => window.clearTimeout(timer);
  }, [notification]);

  const notify = useCallback(
    (message: string) => setNotification(message),
    [],
  );

  const update = useCallback(
    (
      collection: 'deals' | 'contacts' | 'companies' | 'tasks',
      entry: Entity,
      description: string,
      type: ActivityType,
    ) => {
      setData((prev) => {
        const old = prev[collection] as Entity[];

        const exists = old.some(
          (item) => item.id === entry.id,
        );

        const next = exists
          ? old.map((item) =>
              item.id === entry.id ? entry : item,
            )
          : [entry, ...old];

        return {
          ...prev,
          [collection]: next,
          activities: [
            historyItem(
              type,
              exists
                ? 'Registro actualizado'
                : 'Nuevo registro',
              description,
            ),
            ...prev.activities,
          ].slice(0, 150),
        };
      });

      notify('Cambios guardados correctamente');
    },
    [notify],
  );

  const upsertDeal = useCallback(
    (value: Deal) =>
      update('deals', value, value.title, 'deal'),
    [update],
  );

  const upsertContact = useCallback(
    (value: Contact) =>
      update('contacts', value, value.name, 'contact'),
    [update],
  );

  const upsertCompany = useCallback(
    (value: Company) =>
      update('companies', value, value.name, 'company'),
    [update],
  );

  const upsertTask = useCallback(
    (value: Task) =>
      update('tasks', value, value.title, 'task'),
    [update],
  );

  const remove = useCallback(
    (
      collection: 'deals' | 'contacts' | 'companies' | 'tasks',
      id: string,
      type: ActivityType,
    ) => {
      setData((prev) => ({
        ...prev,
        [collection]: (
          prev[collection] as Entity[]
        ).filter((item) => item.id !== id),
        activities: [
          historyItem(type, 'Registro eliminado', id),
          ...prev.activities,
        ].slice(0, 150),
      }));

      notify('Registro eliminado');
    },
    [notify],
  );

  const removeDeal = useCallback(
    (id: string) =>
      remove('deals', id, 'deal'),
    [remove],
  );

  const removeContact = useCallback(
    (id: string) =>
      remove('contacts', id, 'contact'),
    [remove],
  );

  const removeCompany = useCallback(
    (id: string) => {
      setData((prev) => {
        if (
          prev.deals.some(
            (item) => item.companyId === id,
          ) ||
          prev.contacts.some(
            (item) => item.companyId === id,
          )
        ) {
          return prev;
        }

        return {
          ...prev,
          companies: prev.companies.filter(
            (item) => item.id !== id,
          ),
          activities: [
            historyItem(
              'company',
              'Empresa eliminada',
              id,
            ),
            ...prev.activities,
          ],
        };
      });

      notify(
        'Si la empresa tiene relaciones, primero desvinculá sus registros.',
      );
    },
    [notify],
  );

  const removeTask = useCallback(
    (id: string) =>
      remove('tasks', id, 'task'),
    [remove],
  );

  const changeStage = useCallback(
    (id: string, stage: Deal['stage']) => {
      setData((prev) => {
        const old = prev.deals.find(
          (deal) => deal.id === id,
        );

        if (!old || old.stage === stage) {
          return prev;
        }

        const probability = {
          prospeccion: 15,
          calificacion: 35,
          propuesta: 60,
          negociacion: 80,
          ganado: 100,
          perdido: 0,
        }[stage];

        return {
          ...prev,
          deals: prev.deals.map((deal) =>
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
            ...prev.activities,
          ].slice(0, 150),
        };
      });

      notify('Oportunidad actualizada');
    },
    [notify],
  );

  const toggleTask = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === id
            ? {
                ...task,
                done: !task.done,
              }
            : task,
        ),
        activities: [
          historyItem(
            'task',
            'Estado de tarea actualizado',
            prev.tasks.find(
              (task) => task.id === id,
            )?.title ?? 'Tarea',
          ),
          ...prev.activities,
        ].slice(0, 150),
      }));
    },
    [],
  );

  const updateSettings = useCallback(
    (value: Settings) => {
      setData((prev) => ({
        ...prev,
        settings: value,
      }));

      notify('Preferencias actualizadas');
    },
    [notify],
  );

  const restore = useCallback(
    (value: CRMData) => {
      setData(value);
      notify('Respaldo restaurado correctamente');
    },
    [notify],
  );

  const reset = useCallback(() => {
    setData(seedDemo());
    notify('Datos de demostración restaurados');
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
