
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowRight,
  Building2,
  LockKeyhole,
  LogOut,
  Mail,
  ShieldCheck,
} from 'lucide-react';

import App from '../App';
import { supabase } from '../lib/supabase';
import { WorkspaceProvider } from '../lib/workspace';
import './auth-gate.css';

type Mode = 'login' | 'register' | 'forgot' | 'change-password';
type Access = 'loading' | 'guest' | 'no-workspace' | 'ready' | 'error';
type Role = 'admin' | 'member';

function withTimeout<T>(
  request: PromiseLike<T>,
  milliseconds = 12000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(
        'Supabase no respondió a tiempo. Revisá la conexión y reintentá.',
      ));
    }, milliseconds);

    Promise.resolve(request).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        window.clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

function getError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Se produjo un error inesperado.';
}

export function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<Access>(
    supabase ? 'loading' : 'ready',
  );
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organization, setOrganization] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const activeUserId = useRef<string | null>(null);

  // ==========================================
  // SESIÓN DE SUPABASE
  // ==========================================

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    let initialized = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;

      initialized = true;

      if (event === 'PASSWORD_RECOVERY') {
        setMode('change-password');
      }

      const nextId = next?.user.id ?? null;
      const userChanged = activeUserId.current !== nextId;

      activeUserId.current = nextId;
      setSession(next);

      if (!nextId) {
        setOrganizationId('');
        setOrganizationName('');
        setRole(null);
        setAccess('guest');
      } else if (userChanged) {
        setAccess('loading');
      }
    });

    const timer = window.setTimeout(() => {
      if (!active || initialized) return;

      setError(
        'No se pudo comprobar la sesión con Supabase.',
      );
      setAccess('error');
    }, 12000);

    return () => {
      active = false;
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  // ==========================================
  // ORGANIZACIÓN ACTIVA
  // ==========================================

  useEffect(() => {
    if (!supabase || !session?.user.id) return;

    const client = supabase;
    const userId = session.user.id;
    let active = true;

    setAccess('loading');
    setError('');
    setRole(null);
    setOrganizationId('');
    setOrganizationName('');

    async function loadMembership() {
      try {
        const {
          data: membership,
          error: membershipError,
        } = await withTimeout(
          client
            .from('organization_members')
            .select('organization_id, role, joined_at')
            .eq('user_id', userId)
            .order('joined_at', { ascending: true })
            .limit(1)
            .maybeSingle(),
        );

        if (!active) return;

        if (membershipError) throw membershipError;

        if (!membership) {
          setAccess('no-workspace');
          return;
        }

        const {
          data: org,
          error: orgError,
        } = await withTimeout(
          client
            .from('organizations')
            .select('id, name')
            .eq('id', membership.organization_id)
            .maybeSingle(),
        );

        if (!active) return;

        if (orgError) throw orgError;

        if (!org) {
          throw new Error(
            'No se encontró tu espacio de trabajo.',
          );
        }

        setOrganizationId(org.id);
        setOrganizationName(org.name);
        setRole(
          membership.role === 'admin'
            ? 'admin'
            : 'member',
        );
        setAccess('ready');
      } catch (cause) {
        if (!active) return;

        setError(
          `No se pudo consultar tu equipo: ${getError(cause)}`,
        );
        setAccess('error');
      }
    }

    void loadMembership();

    return () => {
      active = false;
    };
  }, [session?.user.id, retry]);

  if (!supabase) return <App />;

  const client = supabase;
  const returnUrl =
    window.location.origin + window.location.pathname;

  // ==========================================
  // AUTENTICACIÓN
  // ==========================================

  async function submitAuth(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'login') {
        const { error: authError } =
          await client.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (authError) throw authError;
      } else if (mode === 'register') {
        const { data, error: authError } =
          await client.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo: returnUrl,
            },
          });

        if (authError) throw authError;

        if (!data.session) {
          setMessage(
            'Revisá tu correo para confirmar la cuenta. Después iniciá sesión.',
          );
        }
      } else if (mode === 'forgot') {
        const { error: authError } =
          await client.auth.resetPasswordForEmail(
            email.trim(),
            { redirectTo: returnUrl },
          );

        if (authError) throw authError;

        setMessage(
          'Si el correo está registrado, recibirás un enlace de recuperación.',
        );
      } else {
        if (password.length < 8) {
          throw new Error(
            'Usá al menos 8 caracteres.',
          );
        }

        const { error: authError } =
          await client.auth.updateUser({ password });

        if (authError) throw authError;

        await client.auth.signOut();

        setMode('login');
        setPassword('');
        setMessage(
          'Contraseña actualizada. Iniciá sesión nuevamente.',
        );
      }
    } catch (cause) {
      setError(getError(cause));
    } finally {
      setBusy(false);
    }
  }

  // ==========================================
  // CREAR ORGANIZACIÓN
  // ==========================================

  async function createOrganization(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError('');

    try {
      const { data: id, error: rpcError } =
        await client.rpc(
          'create_nexo_organization',
          { p_name: organization.trim() },
        );

      if (rpcError) throw rpcError;

      if (typeof id !== 'string' || !id) {
        throw new Error(
          'No se recibió el ID de la organización. Volvé a iniciar sesión.',
        );
      }

      setOrganizationId(id);
      setOrganizationName(organization.trim());
      setRole('admin');
      setAccess('ready');
    } catch (cause) {
      setError(getError(cause));
    } finally {
      setBusy(false);
    }
  }

  // ==========================================
  // CERRAR SESIÓN
  // ==========================================

  async function signOut() {
    setError('');

    const { error: authError } =
      await client.auth.signOut();

    if (authError) {
      setError(authError.message);
    } else {
      activeUserId.current = null;
      setSession(null);
      setRole(null);
      setOrganizationId('');
      setOrganizationName('');
      setAccess('guest');
    }
  }

  // ==========================================
  // USUARIO AUTENTICADO
  // ==========================================

  if (
    mode !== 'change-password' &&
    access === 'ready'
  ) {
    if (!session?.user.id || !organizationId || !role) {
      return (
        <main className="nexo-auth-page">
          <div className="nexo-auth-card">
            <h1>No se pudo identificar tu espacio</h1>
            <p>
              Volvé a comprobar los permisos de tu cuenta.
            </p>
            <button
              className="nexo-auth-submit"
              type="button"
              onClick={() =>
                setRetry(value => value + 1)
              }
            >
              Reintentar
            </button>
          </div>
        </main>
      );
    }

    return (
      <>
        <WorkspaceProvider
          value={{
            organizationId,
            organizationName,
            userId: session.user.id,
            userEmail: session.user.email ?? '',
            role,
          }}
        >
          <App />
        </WorkspaceProvider>

        <div
          className="nexo-session-chip"
          aria-label="Sesión conectada"
        >
          <ShieldCheck size={14} />

          <span>
            {session.user.email}
            {' · '}
            {role === 'admin'
              ? 'Administrador'
              : 'Miembro'}
          </span>

          <button
            type="button"
            onClick={() => void signOut()}
            title="Cerrar sesión"
          >
            <LogOut size={14} />
            Salir
          </button>

          {error && (
            <span role="alert">{error}</span>
          )}
        </div>
      </>
    );
  }

  // ==========================================
  // PANTALLAS DE ACCESO
  // ==========================================

  return (
    <main className="nexo-auth-page">
      <div className="nexo-auth-card">
        <div className="nexo-auth-symbol">
          N
        </div>

        <span className="nexo-auth-eyebrow">
          NEXO CRM · ACCESO SEGURO
        </span>

        {access === 'loading' &&
        mode !== 'change-password' ? (
          <p role="status">
            Comprobando tu sesión…
          </p>
        ) : access === 'error' &&
          mode !== 'change-password' ? (
          <>
            <h1>No se pudo conectar</h1>

            <p>
              La sesión o los permisos de tu equipo
              no pudieron verificarse.
            </p>

            <button
              className="nexo-auth-submit"
              type="button"
              onClick={() => {
                setError('');

                if (session?.user.id) {
                  setRetry(value => value + 1);
                } else {
                  window.location.reload();
                }
              }}
            >
              Reintentar
            </button>

            <button
              className="nexo-auth-link"
              type="button"
              onClick={() => void signOut()}
            >
              Cerrar sesión
            </button>
          </>
        ) : access === 'no-workspace' &&
          mode !== 'change-password' ? (
          <>
            <Building2
              size={26}
              className="nexo-auth-feature-icon"
            />

            <h1>
              Creá tu espacio de trabajo
            </h1>

            <p>
              Esta empresa tendrá sus propios
              datos y usuarios autorizados.
            </p>

            <form
              onSubmit={event =>
                void createOrganization(event)
              }
            >
              <label htmlFor="nexo-org">
                Nombre de la empresa
              </label>

              <input
                id="nexo-org"
                value={organization}
                maxLength={80}
                minLength={2}
                required
                onChange={event =>
                  setOrganization(event.target.value)
                }
                placeholder="Ej. Estudio Aurora"
              />

              <button
                className="nexo-auth-submit"
                type="submit"
                disabled={busy}
              >
                {busy
                  ? 'Creando…'
                  : 'Crear empresa'}

                <ArrowRight size={16} />
              </button>
            </form>

            <button
              className="nexo-auth-link"
              type="button"
              onClick={() => void signOut()}
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <LockKeyhole
              size={26}
              className="nexo-auth-feature-icon"
            />

            <h1>
              {mode === 'login'
                ? 'Bienvenido a NEXO'
                : mode === 'register'
                  ? 'Creá tu cuenta'
                  : mode === 'forgot'
                    ? 'Recuperar acceso'
                    : 'Nueva contraseña'}
            </h1>

            <p>
              {mode === 'change-password'
                ? 'Elegí una contraseña segura para tu cuenta.'
                : 'Tu equipo y tus clientes, en un mismo espacio.'}
            </p>

            <form
              onSubmit={event =>
                void submitAuth(event)
              }
            >
              {mode !== 'change-password' && (
                <>
                  <label htmlFor="nexo-email">
                    <Mail size={14} />
                    Correo electrónico
                  </label>

                  <input
                    id="nexo-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={event =>
                      setEmail(event.target.value)
                    }
                    placeholder="vos@empresa.com"
                  />
                </>
              )}

              {mode !== 'forgot' && (
                <>
                  <label htmlFor="nexo-password">
                    <LockKeyhole size={14} />
                    {mode === 'change-password'
                      ? 'Nueva contraseña'
                      : 'Contraseña'}
                  </label>

                  <input
                    id="nexo-password"
                    type="password"
                    minLength={8}
                    required
                    autoComplete={
                      mode === 'login'
                        ? 'current-password'
                        : 'new-password'
                    }
                    value={password}
                    onChange={event =>
                      setPassword(event.target.value)
                    }
                  />
                </>
              )}

              <button
                className="nexo-auth-submit"
                type="submit"
                disabled={busy}
              >
                {busy
                  ? 'Procesando…'
                  : mode === 'login'
                    ? 'Iniciar sesión'
                    : mode === 'register'
                      ? 'Crear cuenta'
                      : mode === 'forgot'
                        ? 'Enviar enlace'
                        : 'Actualizar contraseña'}

                <ArrowRight size={16} />
              </button>
            </form>

            {mode !== 'change-password' && (
              <div className="nexo-auth-links">
                <button
                  type="button"
                  onClick={() => {
                    setMode(
                      mode === 'login'
                        ? 'register'
                        : 'login',
                    );
                    setError('');
                    setMessage('');
                  }}
                >
                  {mode === 'login'
                    ? 'Crear cuenta'
                    : 'Ya tengo cuenta'}
                </button>

                {mode !== 'forgot' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setMessage('');
                    }}
                  >
                    Olvidé mi contraseña
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {error && (
          <p
            className="nexo-auth-error"
            role="alert"
          >
            {error}
          </p>
        )}

        {message && (
          <p
            className="nexo-auth-success"
            role="status"
          >
            {message}
          </p>
        )}

        <small className="nexo-auth-footnote">
          NEXO CRM · Acceso protegido con Supabase Auth
        </small>
      </div>
    </main>
  );
}
