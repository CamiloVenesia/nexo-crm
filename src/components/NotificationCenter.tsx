
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Activity,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  Clock3,
  GitBranch,
  MessageSquare,
  UserRound,
  X,
} from 'lucide-react';

import type { Task } from '../types';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../lib/workspace';

import './notification-center.css';

export type CRMNotificationType =
  | 'message'
  | 'activity'
  | 'event'
  | 'task_due'
  | 'deal_due'
  | 'event_due';

export type CRMNotificationEntity =
  | 'conversation'
  | 'deal'
  | 'task'
  | 'company'
  | 'contact'
  | 'event'
  | 'activity'
  | null;

export interface CRMNotification {
  id: string;
  organization_id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  notification_type: CRMNotificationType;
  title: string;
  body: string;
  entity_type: CRMNotificationEntity;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  dedupe_key: string | null;
  read_at: string | null;
  created_at: string;
}

interface NotificationCenterProps {
  fallbackTasks: Task[];
  onOpen: (notification: CRMNotification) => void;
  onOpenPanel?: () => void;
}

const SELECT_COLUMNS =
  'id, organization_id, recipient_user_id, actor_user_id, notification_type, title, body, entity_type, entity_id, metadata, dedupe_key, read_at, created_at';

function localDateInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function errorText(error: unknown): string {
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
    : 'No se pudieron cargar las notificaciones.';
}

function relativeTime(value: string): string {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) return '';

  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('es-AR', {
    numeric: 'auto',
  });

  if (Math.abs(seconds) < 60) return 'Ahora';

  if (Math.abs(seconds) < 3600) {
    return formatter.format(Math.round(seconds / 60), 'minute');
  }

  if (Math.abs(seconds) < 86400) {
    return formatter.format(Math.round(seconds / 3600), 'hour');
  }

  return formatter.format(Math.round(seconds / 86400), 'day');
}

function notificationIcon(type: CRMNotificationType) {
  switch (type) {
    case 'message':
      return MessageSquare;
    case 'activity':
      return Activity;
    case 'event':
    case 'event_due':
      return CalendarDays;
    case 'task_due':
      return Clock3;
    case 'deal_due':
      return GitBranch;
  }
}

function notificationClass(type: CRMNotificationType): string {
  switch (type) {
    case 'message':
      return 'message';
    case 'activity':
      return 'activity';
    case 'event':
    case 'event_due':
      return 'event';
    case 'task_due':
      return 'task';
    case 'deal_due':
      return 'deal';
  }
}

function localTaskNotification(task: Task): CRMNotification {
  const today = localDateInput(new Date());

  const title = task.dueDate < today
    ? 'Tarea vencida'
    : task.dueDate === today
      ? 'Tarea para hoy'
      : 'Tarea próxima';

  return {
    id: `local-task-${task.id}`,
    organization_id: 'local',
    recipient_user_id: 'local',
    actor_user_id: null,
    notification_type: 'task_due',
    title,
    body: task.title,
    entity_type: 'task',
    entity_id: task.id,
    metadata: { due_date: task.dueDate },
    dedupe_key: null,
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

export function NotificationCenter({
  fallbackTasks,
  onOpen,
  onOpenPanel,
}: NotificationCenterProps) {
  const workspace = useWorkspace();

  const organizationId = workspace?.organizationId ?? '';
  const userId = workspace?.userId ?? '';

  const connected = Boolean(
    supabase && organizationId && userId,
  );

  const [open, setOpen] = useState(false);

  const [notifications, setNotifications] =
    useState<CRMNotification[]>([]);

  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(Boolean(connected));
  const [error, setError] = useState('');

  const [dismissedLocalIds, setDismissedLocalIds] =
    useState<string[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);

  const localNotifications = useMemo(
    () =>
      fallbackTasks
        .map(localTaskNotification)
        .filter(
          (item) => !dismissedLocalIds.includes(item.id),
        ),
    [fallbackTasks, dismissedLocalIds],
  );

  const visibleNotifications = connected
    ? notifications
    : localNotifications;

  const visibleUnreadCount = connected
    ? unreadCount
    : localNotifications.length;

  // ==========================================
  // CARGAR NOTIFICACIONES DESDE SUPABASE
  // ==========================================

  const refreshNotifications = useCallback(
    async (syncDue: boolean) => {
      if (!supabase || !organizationId || !userId) return;

      const client = supabase;

      setLoading(true);

      let syncWarning = '';

      try {
        if (syncDue) {
          const { error: syncError } = await client.rpc(
            'nexo_sync_due_notifications',
            {
              p_organization_id: organizationId,
              p_local_date: localDateInput(new Date()),
            },
          );

          if (syncError) {
            syncWarning =
              'No se pudieron actualizar los recordatorios automáticos. ' +
              'Se muestran las notificaciones ya guardadas.';
          }
        }

        const [rowsResult, unreadResult] = await Promise.all([
          client
            .from('crm_notifications')
            .select(SELECT_COLUMNS)
            .eq('organization_id', organizationId)
            .eq('recipient_user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50),

          client
            .from('crm_notifications')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('recipient_user_id', userId)
            .is('read_at', null),
        ]);

        if (rowsResult.error) throw rowsResult.error;
        if (unreadResult.error) throw unreadResult.error;

        setNotifications(
          (rowsResult.data ?? []) as CRMNotification[],
        );

        setUnreadCount(unreadResult.count ?? 0);
        setError(syncWarning);
      } catch (cause) {
        setError(errorText(cause));
      } finally {
        setLoading(false);
      }
    },
    [organizationId, userId],
  );

  // ==========================================
  // CARGA INICIAL Y REALTIME
  // ==========================================

  useEffect(() => {
    if (!supabase || !organizationId || !userId) {
      setLoading(false);
      setNotifications([]);
      setUnreadCount(0);
      setError('');
      return;
    }

    const client = supabase;

    let active = true;
    let refreshTimeout: number | null = null;

    void refreshNotifications(true);

    const channel = client
      .channel(`nexo-notifications-${organizationId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_notifications',
          filter: `recipient_user_id=eq.${userId}`,
        },
        () => {
          if (!active) return;

          if (refreshTimeout !== null) {
            window.clearTimeout(refreshTimeout);
          }

          refreshTimeout = window.setTimeout(() => {
            refreshTimeout = null;

            if (active) {
              void refreshNotifications(false);
            }
          }, 150);
        },
      )
      .subscribe();

    // Actualizar recordatorios cada cinco minutos.

    const interval = window.setInterval(() => {
      void refreshNotifications(true);
    }, 5 * 60 * 1000);

    // Actualizar al volver a la pestaña.

    const onFocus = () => {
      void refreshNotifications(true);
    };

    window.addEventListener('focus', onFocus);

    return () => {
      active = false;

      window.clearInterval(interval);

      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
      }

      window.removeEventListener('focus', onFocus);

      void client.removeChannel(channel);
    };
  }, [
    organizationId,
    userId,
    refreshNotifications,
  ]);

  // ==========================================
  // CERRAR PANEL
  // ==========================================

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // ==========================================
  // MARCAR UNA NOTIFICACIÓN COMO LEÍDA
  // ==========================================

  const markRead = useCallback(
    async (item: CRMNotification) => {
      if (item.read_at) return;

      if (!connected || !supabase) {
        setDismissedLocalIds((current) =>
          current.includes(item.id)
            ? current
            : [...current, item.id],
        );

        return;
      }

      const readAt = new Date().toISOString();

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? { ...notification, read_at: readAt }
            : notification,
        ),
      );

      setUnreadCount((count) => Math.max(0, count - 1));

      const { error: updateError } = await supabase
        .from('crm_notifications')
        .update({ read_at: readAt })
        .eq('id', item.id)
        .eq('organization_id', organizationId)
        .eq('recipient_user_id', userId)
        .is('read_at', null);

      if (updateError) {
        setError(errorText(updateError));
        void refreshNotifications(false);
      }
    },
    [
      connected,
      organizationId,
      userId,
      refreshNotifications,
    ],
  );

  // ==========================================
  // MARCAR TODAS COMO LEÍDAS
  // ==========================================

  const markAllRead = async () => {
    if (!visibleUnreadCount) return;

    if (!connected || !supabase) {
      setDismissedLocalIds((current) => [
        ...current,
        ...localNotifications.map((item) => item.id),
      ]);

      return;
    }

    const readAt = new Date().toISOString();

    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        read_at: item.read_at ?? readAt,
      })),
    );

    setUnreadCount(0);

    const { error: updateError } = await supabase
      .from('crm_notifications')
      .update({ read_at: readAt })
      .eq('organization_id', organizationId)
      .eq('recipient_user_id', userId)
      .is('read_at', null);

    if (updateError) {
      setError(errorText(updateError));
      void refreshNotifications(false);
    }
  };

  // ==========================================
  // ABRIR NOTIFICACIÓN
  // ==========================================

  const handleOpen = async (item: CRMNotification) => {
    setOpen(false);
    await markRead(item);
    onOpen(item);
  };

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <div
      className="popover-anchor nexo-notification-anchor"
      ref={rootRef}
    >
      <button
        type="button"
        className="tool-icon nexo-notification-trigger"
        aria-label={
          visibleUnreadCount > 0
            ? `Notificaciones: ${visibleUnreadCount} sin leer`
            : 'Notificaciones'
        }
        aria-expanded={open}
        aria-controls="nexo-notification-panel"
        onClick={() => {
          const next = !open;

          setOpen(next);

          if (next) onOpenPanel?.();

          if (next && connected) {
            void refreshNotifications(true);
          }
        }}
      >
        <Bell size={18} />

        {visibleUnreadCount > 0 && (
          <span className="notif-count">
            {visibleUnreadCount > 99
              ? '99+'
              : visibleUnreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          className="nexo-notification-panel"
          id="nexo-notification-panel"
          role="dialog"
          aria-label="Centro de notificaciones"
        >
          <header className="nexo-notification-header">
            <div>
              <span className="nexo-notification-eyebrow">
                CENTRO DE AVISOS
              </span>

              <h2>Notificaciones</h2>

              <p>
                {visibleUnreadCount > 0
                  ? `${visibleUnreadCount} sin leer`
                  : 'Estás al día'}
              </p>
            </div>

            <button
              type="button"
              className="nexo-notification-close"
              aria-label="Cerrar notificaciones"
              onClick={() => setOpen(false)}
            >
              <X size={17} />
            </button>
          </header>

          {visibleUnreadCount > 0 && (
            <div className="nexo-notification-toolbar">
              <button
                type="button"
                onClick={() => void markAllRead()}
              >
                <CheckCheck size={14} />
                Marcar todas como leídas
              </button>
            </div>
          )}

          {error && (
            <div
              className="nexo-notification-error"
              role="status"
            >
              {error}

              {connected && (
                <button
                  type="button"
                  onClick={() => void refreshNotifications(true)}
                >
                  Reintentar
                </button>
              )}
            </div>
          )}

          <div className="nexo-notification-list">
            {loading && visibleNotifications.length === 0 ? (
              <div className="nexo-notification-empty">
                <span className="nexo-notification-spinner" />
                Cargando notificaciones...
              </div>
            ) : visibleNotifications.length > 0 ? (
              visibleNotifications.map((item) => {
                const Icon = notificationIcon(
                  item.notification_type,
                );

                const unread = !item.read_at;

                return (
                  <button
                    type="button"
                    className={`nexo-notification-item ${
                      unread ? 'unread' : ''
                    }`}
                    key={item.id}
                    onClick={() => void handleOpen(item)}
                  >
                    <span
                      className={`nexo-notification-icon ${notificationClass(
                        item.notification_type,
                      )}`}
                    >
                      <Icon size={17} />
                    </span>

                    <span className="nexo-notification-copy">
                      <span className="nexo-notification-item-top">
                        <strong>{item.title}</strong>

                        {unread && (
                          <i aria-label="Sin leer" />
                        )}
                      </span>

                      {item.body && (
                        <span className="nexo-notification-body">
                          {item.body}
                        </span>
                      )}

                      <span className="nexo-notification-time">
                        <Clock3 size={11} />
                        {relativeTime(item.created_at)}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="nexo-notification-empty">
                <span className="nexo-notification-empty-icon">
                  <Check size={22} />
                </span>

                <strong>No tenés notificaciones</strong>

                <p>
                  Cuando recibas un mensaje o haya un movimiento
                  importante, aparecerá acá.
                </p>
              </div>
            )}
          </div>

          <footer className="nexo-notification-footer">
            <span>
              <UserRound size={12} />

              {connected
                ? 'Notificaciones personales'
                : 'Modo demostración local'}
            </span>

            {connected && (
              <button
                type="button"
                onClick={() => void refreshNotifications(true)}
                disabled={loading}
              >
                Actualizar
              </button>
            )}
          </footer>
        </section>
      )}
    </div>
  );
}
