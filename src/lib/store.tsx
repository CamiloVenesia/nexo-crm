
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
  readCRMSettings,
  writeCRMSettings,
  writeCRMStorage,
} from './persistence';

import {
  deleteRecord,
} from './integrity';

import type {
  Collection,
} from './integrity';

import { assertData } from './utils';

import { supabase } from './supabase';
import { useWorkspace } from './workspace';

import {
  deleteCRMRecord,
  insertCRMActivity,
  loadCRMData,
  saveCRMRecord,
  syncCRMBackup,
  updateOrganizationName,
} from './supabaseCRM';

type Entity = Deal | Company | Contact | Task;

interface Store {
  data: CRMData;

  isLoading: boolean;
  loadError: string;

  localDataAvailable: boolean;
  localDataCount: number;

  retryLoad: () => void;

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

function countLocalRecords(data: CRMData | null) {
  if (!data) return 0;

  return (
    data.companies.length +
    data.contacts.length +
    data.deals.length +
    data.tasks.length +
    data.activities.length
  );
}

function emptyCRMData(settings: Settings): CRMData {
  return {
    version: 1,
    deals: [],
    contacts: [],
    companies: [],
    tasks: [],
    activities: [],
    settings,
  };
}

function errorMessage(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return error instanceof Error
    ? error.message
    : 'Error desconocido.';
}

function hasRemovedRecords(
  current: CRMData,
  next: CRMData,
) {
  const collections: Collection[] = [
    'tasks',
    'deals',
    'contacts',
    'companies',
  ];

  return collections.some((collection) => {
    const nextIds = new Set(
      next[collection].map((record) => record.id),
    );

    return current[collection].some(
      (record) => !nextIds.has(record.id),
    );
  });
}

function mergeActivities(
  current: CRMData['activities'],
  incoming: CRMData['activities'],
) {
  const byId = new Map<
    string,
    CRMData['activities'][number]
  >();

  for (const activity of [...incoming, ...current]) {
    if (!byId.has(activity.id)) {
      byId.set(activity.id, activity);
    }
  }

  return [...byId.values()]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    )
    .slice(0, 150);
}

// ============================================
// PROVIDER
// ============================================

export function CRMProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = useWorkspace();
  const cloudMode = Boolean(workspace && supabase);

  // Leemos la copia local una sola vez.
  // En modo nube se conserva intacta para permitir
  // una migración explícita más adelante.

  const [loaded] = useState(readCRMStorage);

  const [initialSettings] = useState<Settings>(() => {
    if (!workspace) {
      return loaded.data?.settings ?? seedDemo().settings;
    }

    const scopedSettings = readCRMSettings(
      workspace.organizationId,
    );

    const legacySettings = loaded.data?.settings;

    return {
      ...(legacySettings ?? seedDemo().settings),
      ...(scopedSettings ?? {}),

      organization: workspace.organizationName,

      userName:
        scopedSettings?.userName ??
        legacySettings?.userName ??
        workspace.userEmail.split('@')[0] ??
        'Usuario',
    };
  });

  const [data, setData] = useState<CRMData>(() =>
    cloudMode
      ? emptyCRMData(initialSettings)
      : loaded.data ?? seedDemo(),
  );

  const [notification, setNotification] =
    useState('');

  const [canPersist, setCanPersist] = useState(
    loaded.status !== 'invalid',
  );

  const [storageIssue, setStorageIssue] =
    useState(cloudMode ? '' : loaded.message ?? '');

  const [isLoading, setIsLoading] = useState(cloudMode);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  const localDataCount = countLocalRecords(
    loaded.status === 'valid' ? loaded.data : null,
  );

  const localDataAvailable = localDataCount > 0;

  // ==========================================
  // NOTIFICACIONES
  // ==========================================

  useEffect(() => {
    if (!notification) return;

    const timer = window.setTimeout(
      () => setNotification(''),
      4500,
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
  // CARGA DESDE SUPABASE
  // ==========================================

  useEffect(() => {
    if (!cloudMode || !workspace || !supabase) {
      setIsLoading(false);
      return;
    }

    const organizationId = workspace.organizationId;
    let active = true;

    setIsLoading(true);
    setLoadError('');

    async function loadRemoteData() {
      try {
        const remoteData = await loadCRMData(
          organizationId,
          initialSettings,
        );

        if (!active) return;

        setData({
          ...remoteData,
          settings: initialSettings,
        });

        setIsLoading(false);

        if (localDataAvailable) {
          notify(
            `Encontramos ${localDataCount} registros locales. Siguen preservados en este navegador y todavía no se importaron a Supabase.`,
          );
        }
      } catch (error) {
        if (!active) return;

        setLoadError(
          'No se pudieron cargar los datos de Supabase: ' +
            errorMessage(error),
        );

        setIsLoading(false);
      }
    }

    void loadRemoteData();

    return () => {
      active = false;
    };
  }, [
    cloudMode,
    workspace?.organizationId,
    loadAttempt,
    initialSettings,
    localDataAvailable,
    localDataCount,
    notify,
  ]);

  const retryLoad = useCallback(() => {
    setLoadError('');
    setLoadAttempt((value) => value + 1);
  }, []);

  // ==========================================
  // GUARDADO LOCAL SOLO EN MODO DEMOSTRACIÓN
  // ==========================================

  useEffect(() => {
    if (cloudMode || !canPersist) return;

    const error = writeCRMStorage(data);

    setStorageIssue(
      (current) => error ?? (current ? '' : current),
    );
  }, [data, canPersist, cloudMode]);

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
      const current = data[collection] as Entity[];

      const exists = current.some(
        (item) => item.id === entry.id,
      );

      const activity = historyItem(
        type,
        exists ? 'Registro actualizado' : 'Nuevo registro',
        description,
      );

      if (cloudMode && workspace) {
        void (async () => {
          try {
            await saveCRMRecord(
              collection,
              entry,
              workspace.organizationId,
              exists,
            );

            setData((previous) => {
              const rows = previous[collection] as Entity[];

              const alreadyExists = rows.some(
                (item) => item.id === entry.id,
              );

              const updated = alreadyExists
                ? rows.map((item) =>
                    item.id === entry.id ? entry : item,
                  )
                : [entry, ...rows];

              return {
                ...previous,
                [collection]: updated,
              };
            });

            try {
              await insertCRMActivity(
                activity,
                workspace.organizationId,
              );

              setData((previous) => ({
                ...previous,
                activities: [
                  activity,
                  ...previous.activities,
                ].slice(0, 150),
              }));

              notify('Registro guardado en Supabase.');
            } catch (activityError) {
              notify(
                'El registro se guardó, pero no se pudo guardar su actividad: ' +
                  errorMessage(activityError),
              );
            }
          } catch (error) {
            notify(
              'No se pudo guardar el registro en Supabase: ' +
                errorMessage(error),
            );
          }
        })();

        return;
      }

      setData((previous) => {
        const rows = previous[collection] as Entity[];

        const alreadyExists = rows.some(
          (item) => item.id === entry.id,
        );

        const updated = alreadyExists
          ? rows.map((item) =>
              item.id === entry.id ? entry : item,
            )
          : [entry, ...rows];

        return {
          ...previous,
          [collection]: updated,
          activities: [
            activity,
            ...previous.activities,
          ].slice(0, 150),
        };
      });

      notify('Cambios aplicados.');
    },
    [data, cloudMode, workspace, notify],
  );

  // ==========================================
  // OPORTUNIDADES — IMPORTE BASE ARS
  // ==========================================

  const upsertDeal = useCallback(
    (value: Deal) => {
      const previous = data.deals.find(
        (deal) => deal.id === value.id,
      );

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

      if (cloudMode && workspace) {
        if (workspace.role !== 'admin') {
          notify(
            'Solo un administrador puede eliminar registros del espacio de trabajo.',
          );

          return;
        }

        void (async () => {
          try {
            await deleteCRMRecord(
              collection,
              id,
              workspace.organizationId,
            );

            const activity = historyItem(
              type,
              'Registro eliminado',
              result.title,
            );

            setData((previous) => {
              const currentResult = deleteRecord(
                previous,
                collection,
                id,
              );

              if (currentResult.status !== 'deleted') {
                return previous;
              }

              return currentResult.data;
            });

            try {
              await insertCRMActivity(
                activity,
                workspace.organizationId,
              );

              setData((previous) => ({
                ...previous,
                activities: [
                  activity,
                  ...previous.activities,
                ].slice(0, 150),
              }));

              notify(result.message);
            } catch (activityError) {
              notify(
                'El registro se eliminó, pero no se pudo guardar la actividad: ' +
                  errorMessage(activityError),
              );
            }
          } catch (error) {
            notify(
              'No se pudo eliminar el registro: ' +
                errorMessage(error),
            );
          }
        })();

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
    [data, cloudMode, workspace, notify],
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
        notify('La oportunidad ya no existe.');
        return;
      }

      if (current.stage === stage) return;

      const probability = {
        prospeccion: 15,
        calificacion: 35,
        propuesta: 60,
        negociacion: 80,
        ganado: 100,
        perdido: 0,
      }[stage];

      const updatedDeal: Deal = {
        ...current,
        stage,
        probability,
        updatedAt: dateNow(),
      };

      const activity = historyItem(
        'deal',
        stage === 'ganado'
          ? 'Venta ganada'
          : stage === 'perdido'
            ? 'Oportunidad perdida'
            : 'Etapa actualizada',
        current.title,
      );

      if (cloudMode && workspace) {
        void (async () => {
          try {
            await saveCRMRecord(
              'deals',
              updatedDeal,
              workspace.organizationId,
              true,
            );

            setData((previous) => ({
              ...previous,
              deals: previous.deals.map((deal) =>
                deal.id === id ? updatedDeal : deal,
              ),
            }));

            try {
              await insertCRMActivity(
                activity,
                workspace.organizationId,
              );

              setData((previous) => ({
                ...previous,
                activities: [
                  activity,
                  ...previous.activities,
                ].slice(0, 150),
              }));

              notify('Etapa actualizada en Supabase.');
            } catch (activityError) {
              notify(
                'La etapa se actualizó, pero no se pudo guardar la actividad: ' +
                  errorMessage(activityError),
              );
            }
          } catch (error) {
            notify(
              'No se pudo actualizar la oportunidad: ' +
                errorMessage(error),
            );
          }
        })();

        return;
      }

      setData((previous) => ({
        ...previous,
        deals: previous.deals.map((deal) =>
          deal.id === id ? updatedDeal : deal,
        ),
        activities: [
          activity,
          ...previous.activities,
        ].slice(0, 150),
      }));

      notify('Etapa de la oportunidad actualizada.');
    },
    [data.deals, cloudMode, workspace, notify],
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

      const updatedTask: Task = {
        ...task,
        done: !task.done,
      };

      const activity = historyItem(
        'task',
        task.done ? 'Tarea reabierta' : 'Tarea completada',
        task.title,
      );

      if (cloudMode && workspace) {
        void (async () => {
          try {
            await saveCRMRecord(
              'tasks',
              updatedTask,
              workspace.organizationId,
              true,
            );

            setData((previous) => ({
              ...previous,
              tasks: previous.tasks.map((item) =>
                item.id === id ? updatedTask : item,
              ),
            }));

            try {
              await insertCRMActivity(
                activity,
                workspace.organizationId,
              );

              setData((previous) => ({
                ...previous,
                activities: [
                  activity,
                  ...previous.activities,
                ].slice(0, 150),
              }));

              notify(
                updatedTask.done
                  ? 'Tarea completada.'
                  : 'Tarea reabierta.',
              );
            } catch (activityError) {
              notify(
                'La tarea se actualizó, pero no se pudo guardar la actividad: ' +
                  errorMessage(activityError),
              );
            }
          } catch (error) {
            notify(
              'No se pudo actualizar la tarea: ' +
                errorMessage(error),
            );
          }
        })();

        return;
      }

      setData((previous) => ({
        ...previous,
        tasks: previous.tasks.map((item) =>
          item.id === id ? updatedTask : item,
        ),
        activities: [
          activity,
          ...previous.activities,
        ].slice(0, 150),
      }));

      notify(
        updatedTask.done
          ? 'Tarea completada.'
          : 'Tarea reabierta.',
      );
    },
    [data.tasks, cloudMode, workspace, notify],
  );

  // ==========================================
  // CONFIGURACIÓN
  // ==========================================

  const updateSettings = useCallback(
    (value: Settings) => {
      if (cloudMode && workspace) {
        void (async () => {
          try {
            const organizationChanged =
              value.organization.trim() !==
              data.settings.organization;

            if (organizationChanged) {
              if (workspace.role !== 'admin') {
                throw new Error(
                  'Solo un administrador puede cambiar el nombre del espacio de trabajo.',
                );
              }

              await updateOrganizationName(
                workspace.organizationId,
                value.organization.trim(),
              );
            }

            const storageError = writeCRMSettings(
              workspace.organizationId,
              value,
            );

            setData((previous) => ({
              ...previous,
              settings: value,
            }));

            if (storageError) {
              notify(storageError);
            } else {
              notify('Preferencias actualizadas.');
            }
          } catch (error) {
            notify(
              'No se pudieron guardar las preferencias: ' +
                errorMessage(error),
            );
          }
        })();

        return;
      }

      setData((previous) => ({
        ...previous,
        settings: value,
      }));

      notify('Preferencias actualizadas.');
    },
    [cloudMode, workspace, data.settings, notify],
  );

  // ==========================================
  // RESTAURAR RESPALDO O APLICAR CONVERSIÓN
  // ==========================================

  const restore = useCallback(
    (value: CRMData) => {
      try {
        const validated = assertData(value);
        validateFinancialData(validated);

        if (cloudMode && workspace) {
          const removesRecords = hasRemovedRecords(
            data,
            validated,
          );

          const changesOrganization =
            validated.settings.organization.trim() !==
            data.settings.organization;

          if (
            (removesRecords || changesOrganization) &&
            workspace.role !== 'admin'
          ) {
            notify(
              'Esta restauración modifica o elimina registros del espacio de trabajo y requiere permisos de administrador.',
            );

            return;
          }

          const nextData: CRMData = {
            ...validated,
            activities: mergeActivities(
              data.activities,
              validated.activities,
            ),
          };

          void (async () => {
            try {
              if (changesOrganization) {
                await updateOrganizationName(
                  workspace.organizationId,
                  nextData.settings.organization.trim(),
                );
              }

              await syncCRMBackup(
                data,
                nextData,
                workspace.organizationId,
              );

              const storageError = writeCRMSettings(
                workspace.organizationId,
                nextData.settings,
              );

              setData(nextData);

              notify(
                storageError
                  ? 'Los datos se sincronizaron, pero ' + storageError
                  : 'Respaldo y preferencias sincronizados con Supabase.',
              );
            } catch (error) {
              try {
                const refreshed = await loadCRMData(
                  workspace.organizationId,
                  data.settings,
                );

                setData({
                  ...refreshed,
                  settings: data.settings,
                });
              } catch {
                // Conservamos la vista actual si también falla la recarga.
              }

              notify(
                'No se pudo completar la restauración en Supabase: ' +
                  errorMessage(error),
              );
            }
          })();

          return;
        }

        setData(validated);
        setCanPersist(true);
        setStorageIssue('');

        notify('Respaldo restaurado correctamente.');
      } catch {
        notify(
          'No se restauró el respaldo: contiene datos inválidos.',
        );
      }
    },
    [data, cloudMode, workspace, notify],
  );

  // ==========================================
  // REINICIAR DEMO
  // ==========================================

  const reset = useCallback(() => {
    if (cloudMode) {
      notify(
        'El reinicio de datos de demostración está deshabilitado en un espacio conectado a Supabase para evitar borrar información real.',
      );

      return;
    }

    setData(seedDemo());
    setCanPersist(true);
    setStorageIssue('');

    notify('Datos de demostración restaurados.');
  }, [cloudMode, notify]);

  // ==========================================
  // CONTEXTO
  // ==========================================

  const store = useMemo(
    () => ({
      data,

      isLoading,
      loadError,

      localDataAvailable,
      localDataCount,

      retryLoad,

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

      isLoading,
      loadError,

      localDataAvailable,
      localDataCount,

      retryLoad,

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
  // PANTALLAS DE CARGA Y ERROR DE SUPABASE
  // ==========================================

  if (cloudMode && isLoading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#0b1020',
          color: '#f4f6ff',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div
            style={{
              width: 34,
              height: 34,
              margin: '0 auto 18px',
              border: '3px solid #343d5c',
              borderTopColor: '#8b7cff',
              borderRadius: '50%',
              animation: 'nexo-spin 0.8s linear infinite',
            }}
          />

          <h2 style={{ margin: 0, fontSize: 18 }}>
            Conectando con NEXO CRM
          </h2>

          <p style={{ color: '#aab3cc', fontSize: 13 }}>
            Cargando los datos de tu espacio de trabajo…
          </p>

          <style>{
            '@keyframes nexo-spin { to { transform: rotate(360deg); } }'
          }</style>
        </div>
      </main>
    );
  }

  if (cloudMode && loadError) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#0b1020',
          color: '#f4f6ff',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: 24,
        }}
      >
        <div
          style={{
            width: 'min(100%, 480px)',
            padding: 28,
            border: '1px solid #39435f',
            borderRadius: 16,
            background: '#151d33',
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            No se pudieron cargar tus datos
          </h2>

          <p style={{ color: '#bac3d9', lineHeight: 1.6 }}>
            {loadError}
          </p>

          <button
            type="button"
            onClick={retryLoad}
            style={{
              border: 0,
              borderRadius: 9,
              padding: '11px 16px',
              background: '#8274f5',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reintentar conexión
          </button>
        </div>
      </main>
    );
  }

  // ==========================================
  // PROVIDER Y AVISO DE ALMACENAMIENTO LOCAL
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
    throw new Error('CRMProvider missing');
  }

  return store;
}
