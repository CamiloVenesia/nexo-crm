
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import {
  ArrowRight,
  Building2,
  LockKeyhole,
  LogOut,
  Mail,
  ShieldCheck,
} from 'lucide-react';

import type { Session } from '@supabase/supabase-js';

import App from '../App';
import { supabase } from '../lib/supabase';

import './auth-gate.css';

type Mode =
  | 'login'
  | 'register'
  | 'forgot'
  | 'change-password';

type Access =
  | 'loading'
  | 'guest'
  | 'no-workspace'
  | 'ready'
  | 'error';

export function AuthGate() {
  const [session, setSession] =
    useState<Session | null>(null);

  const [access, setAccess] = useState<Access>(
    supabase ? 'loading' : 'ready',
  );

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organization, setOrganization] = useState('');

  const [role, setRole] =
    useState<'admin' | 'member' | null>(null);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  // ==========================================
  // SESIÓN
  // ==========================================

  useEffect(() => {
    if (!supabase) return;

    const client = supabase;
    let mounted = true;

    client.auth
      .getSession()
      .then(({ data, error: authError }) => {
        if (!mounted) return;

        if (authError) {
          setError(authError.message);
          setAccess('guest');
        } else {
          setSession(data.session);

          if (!data.session) {
            setAccess('guest');
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setError(
            'No se pudo comprobar la sesión. Revisá la conexión.',
          );
          setAccess('guest');
        }
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!mounted) return;

        if (event === 'PASSWORD_RECOVERY') {
          setMode('change-password');
        }

        setSession(nextSession);

        if (!nextSession) {
          setRole(null);
          setAccess('guest');
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ==========================================
  // COMPROBAR MEMBRESÍA
  // ==========================================

  useEffect(() => {
    if (!supabase || !session?.user.id) return;

    const client = supabase;
    let active = true;

    setAccess('loading');

    client
      .from('organization_members')
      .select('organization_id, role')
      .limit(1)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return;

        if (queryError) {
          setError(
            'No se pudo consultar tu equipo: ' +
              queryError.message,
          );

          setAccess('error');
        } else if (!data) {
          setAccess('no-workspace');
        } else {
          setRole(
            data.role === 'admin'
              ? 'admin'
              : 'member',
          );

          setAccess('ready');
        }
      });

    return () => {
      active = false;
    };
  }, [session?.user.id, retry]);

  // Sin credenciales, mantiene la demo local.
  if (!supabase) {
    return <App />;
  }

  const client = supabase;

  const returnUrl =
    window.location.origin + window.location.pathname;

  // ==========================================
  // REGISTRO / LOGIN / CONTRASEÑA
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
            {
              redirectTo: returnUrl,
            },
          );

        if (authError) throw authError;

        setMessage(
          'Si el correo está registrado, recibirás un enlace para recuperar la contraseña.',
        );
      } else {
        if (password.length < 8) {
          throw new Error(
            'Usá al menos 8 caracteres.',
          );
        }

        const { error: authError } =
          await client.auth.updateUser({
            password,
          });

        if (authError) throw authError;

        await client.auth.signOut();

        setMode('login');
        setPassword('');
        setMessage(
          'Contraseña actualizada. Iniciá sesión nuevamente.',
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No se pudo completar la operación.',
      );
    } finally {
      setBusy(false);
    }
  }

  // ==========================================
  // CREACIÓN DE EMPRESA
  // ==========================================

  async function createOrganization(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError('');

    try {
      const { error: rpcError } = await client.rpc(
        'create_nexo_organization',
        {
          p_name: organization.trim(),
        },
      );

      if (rpcError) throw rpcError;

      setRole('admin');
      setAccess('ready');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No se pudo crear la empresa.',
      );
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
      setRole(null);
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
    return (
      <>
        <App />

        <div
          className="nexo-session-chip"
          aria-label="Sesión conectada"
        >
          <ShieldCheck size={14} />

          <span>
            {session?.user.email}
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
                setRetry((value) => value + 1);
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
              onSubmit={(event) =>
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
                onChange={(event) =>
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
              onSubmit={(event) =>
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
                    onChange={(event) =>
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
                    onChange={(event) =>
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
          NEXO CRM · Acceso protegido con
          Supabase Auth
        </small>
      </div>
    </main>
  );
}
