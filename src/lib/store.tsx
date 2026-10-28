
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  CRMData,
  Deal,
  Company,
  Contact,
  Task,
  Settings,
  ActivityType,
} from '../types';

import { createId, seedDemo } from './seed';

import {
  prepareDealAmount,
  validateFinancialData,
} from './currencyExchange';

import {
  readCRMStorage,
  writeCRMStorage,
} from './persistence';

import {
  deleteRecord,
} from './integrity';

import type {
  Collection,
} from './integrity';

import { assertData } from './utils';

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

const StoreContext =
  createContext<Store | null>(null);

const dateNow = () =>
  new Date().toISOString();

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

// ============================================
// PROVIDER
// ============================================

export function CRMProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // ==========================================
  // CARGA INICIAL PROTEGIDA
  // ==========================================

  const [loaded] = useState(readCRMStorage);

  const [data, setData] = useState<CRMData>(
    () => loaded.data ?? seedDemo(),
  );

  const [notification, setNotification] =
    useState('');

  const [canPersist, setCanPersist] = useState(
    loaded.status !== 'invalid',
  );

  const [storageIssue, setStorageIssue] =
    useState(loaded.message ?? '');

  // ==========================================
  // GUARDADO LOCAL PROTEGIDO
  // ==========================================

  useEffect(() => {
    if (!canPersist) return;

    const error = writeCRMStorage(data);

    setStorageIssue(
      (current) =>
        error ?? (current ? '' : current),
    );
  }, [data, canPersist]);

  // ==========================================
  // NOTIFICACIONES
  // ==========================================

  useEffect(() => {
    if (!notification) return;

    const timer = window.setTimeout(
      () => setNotification(''),
      3500,
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [notification]);

  const notify = useCallback(
    (message: string) => {
      setNotification(message);
    },
    [],
  );

  // ==========================================
  // ACTUALIZAR REGISTROS
  // ==========================================

  const update = useCallback(
    (
      collection: Collection,
      entry: Entity,
      description: string,
      type: ActivityType,
    ) => {
      setData((previous) => {
        const current =
          previous[collection] as Entity[];

        const exists = current.some(
          (item) => item.id === entry.id,
        );

        const updated = exists
          ? current.map((item) =>
              item.id === entry.id
                ? entry
                : item,
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

      notify('Cambios aplicados.');
    },
    [notify],
  );

  // ==========================================
  // OPORTUNIDADES — IMPORTE BASE ARS
  // ==========================================

  const upsertDeal = useCallback(
    (value: Deal) => {
      const previous = data.deals.find(
        (deal) => deal.id === value.id,
      );

      // Preparamos el importe antes de guardarlo.
      // No confiamos en amountBaseARS que pueda
      // venir de un formulario modificado.

      const prepared = prepareDealAmount(
        value,
        previous,
        data,
      );

      update(
        'deals',
        prepared,
        prepared.title,
        'deal',
      );
    },
    [data, update],
  );

  // ==========================================
  // CONTACTOS
  // ==========================================

  const upsertContact = useCallback(
    (value: Contact) => {
      update(
        'contacts',
        value,
        value.name,
        'contact',
      );
    },
    [update],
  );

  // ==========================================
  // EMPRESAS
  // ==========================================

  const upsertCompany = useCallback(
    (value: Company) => {
      update(
        'companies',
        value,
        value.name,
        'company',
      );
    },
    [update],
  );

  // ==========================================
  // TAREAS
  // ==========================================

  const upsertTask = useCallback(
    (value: Task) => {
      update(
        'tasks',
        value,
        value.title,
        'task',
      );
    },
    [update],
  );

  // ==========================================
  // ELIMINACIÓN CON INTEGRIDAD
  // ==========================================

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

        if (
          currentResult.status !== 'deleted'
        ) {
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
      removeEntity(
        'deals',
        id,
        'deal',
      );
    },
    [removeEntity],
  );

  const removeContact = useCallback(
    (id: string) => {
      removeEntity(
        'contacts',
        id,
        'contact',
      );
    },
    [removeEntity],
  );

  const removeCompany = useCallback(
    (id: string) => {
      removeEntity(
        'companies',
        id,
        'company',
      );
    },
    [removeEntity],
  );

  const removeTask = useCallback(
    (id: string) => {
      removeEntity(
        'tasks',
        id,
        'task',
      );
    },
    [removeEntity],
  );

  // ==========================================
  // CAMBIAR ETAPA
  // ==========================================

  const changeStage = useCallback(
    (
      id: string,
      stage: Deal['stage'],
    ) => {
      const current = data.deals.find(
        (deal) => deal.id === id,
      );

      if (!current) {
        notify(
          'La oportunidad ya no existe.',
        );

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

        if (
          !old ||
          old.stage === stage
        ) {
          return previous;
        }

        return {
          ...previous,

          deals: previous.deals.map(
            (deal) =>
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

      notify(
        'Etapa de la oportunidad actualizada.',
      );
    },
    [data.deals, notify],
  );

  // ==========================================
  // COMPLETAR O REABRIR TAREA
  // ==========================================

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

        tasks: previous.tasks.map(
          (item) =>
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

  // ==========================================
  // CONFIGURACIÓN
  // ==========================================

  const updateSettings = useCallback(
    (value: Settings) => {
      setData((previous) => ({
        ...previous,
        settings: value,
      }));

      notify(
        'Preferencias actualizadas.',
      );
    },
    [notify],
  );

  // ==========================================
  // RESTAURAR RESPALDO
  // ==========================================

  const restore = useCallback(
    (value: CRMData) => {
      try {
        const validated = assertData(value);

        // También validamos las nuevas
        // referencias monetarias.
        validateFinancialData(validated);

        setData(validated);
        setCanPersist(true);
        setStorageIssue('');

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

  // ==========================================
  // REINICIAR DEMO
  // ==========================================

  const reset = useCallback(() => {
    setData(seedDemo());
    setCanPersist(true);
    setStorageIssue('');

    notify(
      'Datos de demostración restaurados.',
    );
  }, [notify]);

  // ==========================================
  // CONTEXTO
  // ==========================================

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

  // ==========================================
  // AVISO DE FALLO DE ALMACENAMIENTO
  // ==========================================

  return (
    <StoreContext.Provider value={store}>
      {children}

      {storageIssue && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            zIndex: 10000,
            maxWidth: 460,
            padding: '13px 16px',
            background: '#222c46',
            border: '1px solid #d9a476',
            borderRadius: 10,
            color: '#ffdfc5',
            fontSize: 12,
            lineHeight: 1.6,
            boxShadow: '0 10px 30px #0008',
          }}
        >
          <strong
            style={{
              display: 'block',
              marginBottom: 3,
            }}
          >
            Atención: datos no guardados
          </strong>

          {storageIssue}
        </div>
      )}
    </StoreContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useCRM() {
  const store = useContext(StoreContext);

  if (!store) {
    throw new Error(
      'CRMProvider missing',
    );
  }

  return store;
}
