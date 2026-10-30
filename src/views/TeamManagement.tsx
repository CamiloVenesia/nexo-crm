
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Check,
  Copy,
  MailPlus,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../lib/workspace';

import './team-management.css';

type Role = 'admin' | 'member';

type TeamMember = {
  member_user_id: string;
  member_email: string;
  member_role: Role;
  member_joined_at: string;
};

type PendingAction =
  | {
      kind: 'role';
      member: TeamMember;
      nextRole: Role;
    }
  | {
      kind: 'remove';
      member: TeamMember;
    };

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'No se pudo completar la operación.';
}

export function TeamManagement() {
  const workspace = useWorkspace();

  const organizationId = workspace?.organizationId ?? '';
  const isAdmin = workspace?.role === 'admin';

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refreshTeam = useCallback(async () => {
    if (!supabase || !organizationId || !isAdmin) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'nexo_list_team',
        {
          p_organization_id: organizationId,
        },
      );

      if (rpcError) throw rpcError;

      if (!Array.isArray(data)) {
        throw new Error('La respuesta del equipo es inválida.');
      }

      setMembers(data as TeamMember[]);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, [organizationId, isAdmin]);

  useEffect(() => {
    void refreshTeam();
  }, [refreshTeam]);

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !isAdmin || busy) return;

    setBusy(true);
    setError('');
    setSuccess('');
    setInviteUrl('');

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'nexo_create_invite',
        {
          p_organization_id: organizationId,
          p_email: email.trim().toLowerCase(),
        },
      );

      if (rpcError) throw rpcError;

      if (typeof data !== 'string' || !data) {
        throw new Error('No se generó el enlace.');
      }

      const url = new URL(window.location.href);

      url.searchParams.set('invite', data);
      url.hash = '';

      setInviteUrl(url.toString());
      setEmail('');

      setSuccess(
        'Invitación creada. Copiá y compartí el enlace solo con el destinatario.',
      );
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setSuccess('Enlace copiado.');
    } catch {
      setError(
        'No se pudo copiar automáticamente. Seleccioná el enlace y copialo manualmente.',
      );
    }
  }

  async function confirmAction() {
    if (!supabase || !pending || busy || !isAdmin) return;

    const action = pending;

    setPending(null);
    setBusy(true);
    setError('');
    setSuccess('');

    try {
      const result =
        action.kind === 'remove'
          ? await supabase.rpc('nexo_remove_member', {
              p_organization_id: organizationId,
              p_user_id: action.member.member_user_id,
            })
          : await supabase.rpc('nexo_set_member_role', {
              p_organization_id: organizationId,
              p_user_id: action.member.member_user_id,
              p_role: action.nextRole,
            });

      if (result.error) throw result.error;

      await refreshTeam();

      setSuccess(
        action.kind === 'remove'
          ? 'Miembro retirado del equipo.'
          : 'Rol actualizado.',
      );
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!workspace || !supabase) return null;

  const adminCount = members.filter(
    member => member.member_role === 'admin',
  ).length;

  return (
    <section
      className="panel setting-panel nexo-team"
      aria-labelledby="nexo-team-title"
    >
      <div className="nexo-team-heading">
        <div>
          <h2 id="nexo-team-title">
            <UsersRound size={19} />
            Gestión del equipo
          </h2>

          <p>
            Usuarios autorizados del espacio
            «{workspace.organizationName}».
          </p>
        </div>

        {isAdmin && (
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => void refreshTeam()}
            disabled={loading || busy}
          >
            <RefreshCw size={15} />
            Actualizar
          </button>
        )}
      </div>

      {!isAdmin ? (
        <p className="nexo-team-notice">
          <ShieldCheck size={16} />
          Tu rol es Miembro. Solo los administradores
          pueden gestionar usuarios.
        </p>
      ) : (
        <>
          <form
            className="nexo-team-invite"
            onSubmit={event => void createInvite(event)}
          >
            <label htmlFor="nexo-team-email">
              <MailPlus size={16} />
              Invitar miembro por correo
            </label>

            <div className="nexo-team-row">
              <input
                id="nexo-team-email"
                type="email"
                required
                autoComplete="off"
                maxLength={320}
                placeholder="persona@empresa.com"
                value={email}
                disabled={busy}
                onChange={event => {
                  setEmail(event.target.value);
                  setInviteUrl('');
                  setError('');
                }}
              />

              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || !email.trim()}
              >
                <MailPlus size={15} />
                {busy ? 'Procesando…' : 'Crear invitación'}
              </button>
            </div>

            <small>
              El enlace vence en 48 horas y solo sirve
              para una cuenta con ese correo confirmado.
              No se envía un correo automáticamente.
            </small>
          </form>

          {inviteUrl && (
            <div className="nexo-team-invite-link">
              <label htmlFor="nexo-team-link">
                Enlace de invitación
              </label>

              <div className="nexo-team-row">
                <input
                  id="nexo-team-link"
                  readOnly
                  value={inviteUrl}
                  onFocus={event => event.target.select()}
                />

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => void copyInvite()}
                >
                  <Copy size={15} />
                  Copiar
                </button>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="nexo-team-error">
              {error}
            </p>
          )}

          {success && (
            <p role="status" className="nexo-team-success">
              <Check size={15} />
              {success}
            </p>
          )}

          <div className="nexo-team-list-heading">
            <strong>
              Miembros del equipo ({members.length})
            </strong>

            {loading && (
              <span role="status">Consultando…</span>
            )}
          </div>

          <div className="nexo-team-table-scroll">
            <table className="nexo-team-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Fecha de ingreso</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {members.map(member => {
                  const isMe =
                    member.member_user_id === workspace.userId;

                  const lastAdmin =
                    member.member_role === 'admin' &&
                    adminCount <= 1;

                  return (
                    <tr key={member.member_user_id}>
                      <td>
                        {member.member_email}

                        {isMe && (
                          <span className="nexo-team-self">
                            Vos
                          </span>
                        )}
                      </td>

                      <td>
                        <select
                          aria-label={`Rol de ${member.member_email}`}
                          value={member.member_role}
                          disabled={busy || lastAdmin}
                          onChange={event =>
                            setPending({
                              kind: 'role',
                              member,
                              nextRole: event.target.value as Role,
                            })
                          }
                        >
                          <option value="admin">
                            Administrador
                          </option>

                          <option value="member">
                            Miembro
                          </option>
                        </select>
                      </td>

                      <td>
                        {new Date(
                          member.member_joined_at,
                        ).toLocaleDateString('es-AR')}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="btn btn-danger-subtle"
                          disabled={busy || isMe || lastAdmin}
                          onClick={() =>
                            setPending({
                              kind: 'remove',
                              member,
                            })
                          }
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!loading && members.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      No se pudieron mostrar miembros.
                      Usá «Actualizar» para reintentar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="nexo-team-footnote">
            Por seguridad, NEXO no permite quitar
            al último administrador ni eliminar tu
            propia membresía. Los cambios de permisos
            se aplican en Supabase.
          </p>
        </>
      )}

      {pending && (
        <ConfirmDialog
          tone={
            pending.kind === 'remove'
              ? 'danger'
              : 'warning'
          }
          title={
            pending.kind === 'remove'
              ? '¿Quitar miembro?'
              : '¿Cambiar permisos?'
          }
          description={
            pending.kind === 'remove'
              ? `Vas a retirar a ${pending.member.member_email} del espacio de trabajo. Sus datos comerciales no se borrarán.`
              : `Vas a cambiar el rol de ${pending.member.member_email} a ${
                  pending.nextRole === 'admin'
                    ? 'Administrador'
                    : 'Miembro'
                }.`
          }
          confirmLabel={
            pending.kind === 'remove'
              ? 'Quitar del equipo'
              : 'Confirmar cambio'
          }
          onConfirm={() => void confirmAction()}
          onCancel={() => setPending(null)}
        />
      )}
    </section>
  );
}
