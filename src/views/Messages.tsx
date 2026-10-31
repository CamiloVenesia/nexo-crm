
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  FormEvent,
  KeyboardEvent,
} from 'react';

import {
  ArrowUpRight,
  Building2,
  Check,
  Mail,
  MessageCircle,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';

import {
  Avatar,
  PageHeading,
} from '../components/Shared';

import { useCRM } from '../lib/store';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../lib/workspace';
import type { Company, Contact } from '../types';

import './workspace-extras.css';
import './messages-internal.css';

type Section = 'team' | 'contacts';
type MemberRole = 'admin' | 'member';

interface ChatMember {
  member_user_id: string;
  member_email: string;
  member_role: MemberRole;
  member_joined_at: string;
}

interface ConversationSummary {
  conversation_id: string;
  other_user_id: string;
  other_user_email: string;
  other_user_role: MemberRole;
  contact_id: string | null;
  contact_name: string | null;
  company_id: string | null;
  company_name: string | null;
  last_message: string | null;
  last_message_at: string;
  last_message_sender_id: string | null;
  unread_count: number;
  last_read_at: string | null;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

function getError(error: unknown): string {
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
    : 'Ocurrió un error inesperado.';
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function contactWhatsApp(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');

  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  return `https://wa.me/${digits}`;
}

function contactEmail(email: string): string | null {
  const normalized = email.trim();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? `mailto:${normalized}`
    : null;
}

function formatMessageTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatConversationTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) return formatMessageTime(value);

  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
  });
}

function formatMessageDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function sameCalendarDay(first: string, second: string): boolean {
  const a = new Date(first);
  const b = new Date(second);

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function Messages() {
  const workspace = useWorkspace();
  const { data } = useCRM();

  const [section, setSection] = useState<Section>('team');
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [pageError, setPageError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [draft, setDraft] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
  const [realtimeVersion, setRealtimeVersion] = useState(0);

  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newCompanyId, setNewCompanyId] = useState('');
  const [newContactId, setNewContactId] = useState('');
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [newConversationError, setNewConversationError] = useState('');

  const [contactSearch, setContactSearch] = useState('');
  const [externalContactId, setExternalContactId] = useState<string | null>(null);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const organizationId = workspace?.organizationId ?? '';
  const currentUserId = workspace?.userId ?? '';

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) =>
          conversation.conversation_id === activeConversationId,
      ) ?? null,
    [conversations, activeConversationId],
  );

  const otherMembers = useMemo(
    () => members.filter(
      (member) => member.member_user_id !== currentUserId,
    ),
    [members, currentUserId],
  );

  const filteredConversations = useMemo(() => {
    const query = normalize(conversationSearch);

    if (!query) return conversations;

    return conversations.filter((conversation) =>
      normalize([
        conversation.other_user_email,
        conversation.contact_name ?? '',
        conversation.company_name ?? '',
        conversation.last_message ?? '',
      ].join(' ')).includes(query),
    );
  }, [conversations, conversationSearch]);

  const filteredContacts = useMemo(() => {
    const query = normalize(contactSearch);

    return data.contacts.filter((contact) => {
      const company = data.companies.find(
        (item) => item.id === contact.companyId,
      );

      return normalize([
        contact.name,
        contact.email,
        contact.phone,
        company?.name ?? '',
      ].join(' ')).includes(query);
    });
  }, [data.contacts, data.companies, contactSearch]);

  const selectedExternalContact: Contact | undefined =
    data.contacts.find(
      (contact) => contact.id === externalContactId,
    ) ?? filteredContacts[0];

  const selectedExternalCompany: Company | undefined =
    data.companies.find(
      (company) => company.id === selectedExternalContact?.companyId,
    );

  const mailLink = selectedExternalContact
    ? contactEmail(selectedExternalContact.email)
    : null;

  const whatsappLink = selectedExternalContact
    ? contactWhatsApp(selectedExternalContact.phone)
    : null;

  const availableContacts = data.contacts.filter(
    (contact) =>
      !newCompanyId || contact.companyId === newCompanyId,
  );

  // =====================================================
  // CARGA DE EQUIPO Y CONVERSACIONES
  // =====================================================

  useEffect(() => {
    if (!supabase || !organizationId) {
      setLoading(false);
      setPageError(
        'La mensajería interna requiere una sesión autenticada y una organización conectada a Supabase.',
      );
      return;
    }

    let active = true;

    async function loadInbox() {
      setLoading(true);
      setPageError('');

      try {
        const [membersResult, conversationsResult] = await Promise.all([
          supabase!.rpc('nexo_list_chat_members', {
            p_organization_id: organizationId,
          }),
          supabase!.rpc('nexo_list_conversations', {
            p_organization_id: organizationId,
          }),
        ]);

        if (membersResult.error) throw membersResult.error;
        if (conversationsResult.error) throw conversationsResult.error;
        if (!active) return;

        const nextMembers = (membersResult.data ?? []) as ChatMember[];
        const nextConversations = (
          conversationsResult.data ?? []
        ) as ConversationSummary[];

        setMembers(nextMembers);
        setConversations(nextConversations);

        setActiveConversationId((current) => {
          if (
            current &&
            nextConversations.some(
              (item) => item.conversation_id === current,
            )
          ) {
            return current;
          }

          return nextConversations[0]?.conversation_id ?? null;
        });
      } catch (error) {
        if (!active) return;
        setPageError(getError(error));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInbox();

    return () => {
      active = false;
    };
  }, [organizationId, currentUserId, realtimeVersion]);

  // =====================================================
  // SINCRONIZACIÓN EN TIEMPO REAL
  // =====================================================

  useEffect(() => {
    if (!supabase || !organizationId) return;

    const channel = supabase
      .channel(`nexo-internal-messages-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_messages',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          setRealtimeVersion((version) => version + 1);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_conversations',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          setRealtimeVersion((version) => version + 1);
        },
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [organizationId]);

  // =====================================================
  // CARGAR MENSAJES DE LA CONVERSACIÓN SELECCIONADA
  // =====================================================

  useEffect(() => {
    if (!supabase || !organizationId || !activeConversationId) {
      setMessages([]);
      setMessagesLoading(false);
      setMessageError('');
      return;
    }

    let active = true;

    async function loadMessages() {
      setMessagesLoading(true);
      setMessageError('');

      const { data: rows, error } = await supabase!
        .from('crm_messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .eq('organization_id', organizationId)
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true })
        .limit(250);

      if (!active) return;

      if (error) {
        setMessageError(getError(error));
        setMessages([]);
      } else {
        setMessages((rows ?? []) as ChatMessage[]);
      }

      setMessagesLoading(false);
    }

    void loadMessages();

    return () => {
      active = false;
    };
  }, [organizationId, activeConversationId, realtimeVersion]);

  // Marcar como leída únicamente cuando hay mensajes no leídos.

  useEffect(() => {
    if (
      section !== 'team' ||
      !supabase ||
      !activeConversationId ||
      !activeConversation ||
      Number(activeConversation.unread_count) <= 0
    ) {
      return;
    }

    let active = true;

    async function markRead() {
      const { error } = await supabase!.rpc(
        'nexo_mark_conversation_read',
        {
          p_conversation_id: activeConversationId,
        },
      );

      if (!active) return;

      if (error) {
        setMessageError(getError(error));
      } else {
        setRealtimeVersion((version) => version + 1);
      }
    }

    void markRead();

    return () => {
      active = false;
    };
  }, [
    section,
    activeConversationId,
    activeConversation?.unread_count,
  ]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [messages]);

  // =====================================================
  // INICIAR CONVERSACIÓN
  // =====================================================

  function openNewConversation() {
    setNewMemberId(otherMembers[0]?.member_user_id ?? '');
    setNewCompanyId('');
    setNewContactId('');
    setNewConversationError('');
    setNewConversationOpen(true);
  }

  async function createConversation(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!supabase || !workspace || creatingConversation) return;

    if (!newMemberId) {
      setNewConversationError(
        'Seleccioná a un integrante del equipo.',
      );
      return;
    }

    setCreatingConversation(true);
    setNewConversationError('');

    const selectedContact = data.contacts.find(
      (contact) => contact.id === newContactId,
    );

    try {
      const { data: conversationId, error } = await supabase.rpc(
        'nexo_start_direct_conversation',
        {
          p_organization_id: workspace.organizationId,
          p_other_user_id: newMemberId,
          p_contact_id: newContactId || null,
          p_company_id:
            selectedContact?.companyId || newCompanyId || null,
        },
      );

      if (error) throw error;

      if (typeof conversationId !== 'string' || !conversationId) {
        throw new Error(
          'Supabase no devolvió el identificador de la conversación.',
        );
      }

      setActiveConversationId(conversationId);
      setSection('team');
      setNewConversationOpen(false);
      setRealtimeVersion((version) => version + 1);
    } catch (error) {
      setNewConversationError(getError(error));
    } finally {
      setCreatingConversation(false);
    }
  }

  // =====================================================
  // ENVIAR MENSAJE
  // =====================================================

  async function sendMessage() {
    const body = draft.trim();

    if (
      !supabase ||
      !workspace ||
      !activeConversationId ||
      !body ||
      sending
    ) {
      return;
    }

    if (body.length > 5000) {
      setMessageError('El mensaje no puede superar los 5000 caracteres.');
      return;
    }

    setSending(true);
    setMessageError('');

    try {
      const { error } = await supabase.rpc(
        'nexo_send_message',
        {
          p_conversation_id: activeConversationId,
          p_body: body,
        },
      );

      if (error) throw error;

      setDraft('');
      setRealtimeVersion((version) => version + 1);
      composerRef.current?.focus();
    } catch (error) {
      setMessageError(getError(error));
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  // =====================================================
  // INTERFAZ
  // =====================================================

  return (
    <div className="nexo-extras nexo-messages-page">
      <PageHeading
        eyebrow="COMUNICACIÓN / MENSAJERÍA"
        title="Mensajería"
        subtitle="Conversá con tu equipo y mantené cada intercambio vinculado al contexto comercial."
        action={
          <button
            className="btn btn-primary"
            type="button"
            onClick={openNewConversation}
            disabled={!supabase || !workspace || otherMembers.length === 0}
          >
            <Plus size={16} />
            Nuevo mensaje
          </button>
        }
      />

      <div className="nexo-message-tabs" role="tablist" aria-label="Canales de mensajería">
        <button
          type="button"
          role="tab"
          aria-selected={section === 'team'}
          className={section === 'team' ? 'active' : ''}
          onClick={() => setSection('team')}
        >
          <UsersRound size={16} />
          Equipo
          {conversations.length > 0 && (
            <span>{conversations.length}</span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={section === 'contacts'}
          className={section === 'contacts' ? 'active' : ''}
          onClick={() => setSection('contacts')}
        >
          <Building2 size={16} />
          Contactos externos
        </button>
      </div>

      {section === 'team' ? (
        <div className="nexo-chat-layout">
          <aside className="nexo-chat-sidebar" aria-label="Conversaciones del equipo">
            <div className="nexo-chat-sidebar-heading">
              <div>
                <h2>Conversaciones</h2>
                <small>
                  {members.length} integrantes en el equipo
                </small>
              </div>

              <button
                type="button"
                className="nexo-chat-new-button"
                onClick={openNewConversation}
                disabled={!supabase || !workspace || otherMembers.length === 0}
                aria-label="Iniciar una conversación"
                title="Nuevo mensaje"
              >
                <Plus size={17} />
              </button>
            </div>

            <label className="nexo-chat-search">
              <Search size={15} />
              <input
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder="Buscar conversación"
                aria-label="Buscar conversación"
              />
            </label>

            {loading ? (
              <div className="nexo-chat-sidebar-state">
                Cargando conversaciones…
              </div>
            ) : pageError ? (
              <div className="nexo-chat-sidebar-state error">
                No se pudo cargar la bandeja.
              </div>
            ) : filteredConversations.length > 0 ? (
              <div className="nexo-chat-conversation-list">
                {filteredConversations.map((conversation) => {
                  const isActive =
                    conversation.conversation_id === activeConversationId;

                  const preview = conversation.last_message
                    ? `${conversation.last_message_sender_id === currentUserId ? 'Vos: ' : ''}${conversation.last_message}`
                    : 'Iniciá la conversación';

                  return (
                    <button
                      type="button"
                      key={conversation.conversation_id}
                      className={`nexo-chat-conversation ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setActiveConversationId(conversation.conversation_id);
                        setMessageError('');
                      }}
                    >
                      <Avatar
                        name={conversation.other_user_email || 'Usuario'}
                        size={42}
                      />

                      <span className="nexo-chat-conversation-copy">
                        <span className="nexo-chat-conversation-topline">
                          <strong>{conversation.other_user_email || 'Integrante del equipo'}</strong>
                          <time>{formatConversationTime(conversation.last_message_at)}</time>
                        </span>

                        <span className="nexo-chat-conversation-preview">
                          {preview}
                        </span>

                        <span className="nexo-chat-conversation-meta">
                          {conversation.company_name || conversation.contact_name ? (
                            <span>
                              {conversation.contact_name || conversation.company_name}
                            </span>
                          ) : (
                            <span>Conversación interna</span>
                          )}

                          {Number(conversation.unread_count) > 0 && (
                            <b>{conversation.unread_count}</b>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="nexo-chat-sidebar-empty">
                <MessageSquare size={23} />
                <strong>
                  {conversationSearch
                    ? 'Sin coincidencias'
                    : 'Todavía no hay conversaciones'}
                </strong>
                <p>
                  {conversationSearch
                    ? 'Probá con otro nombre o correo.'
                    : 'Iniciá un chat con alguien de tu equipo.'}
                </p>
                {!conversationSearch && otherMembers.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={openNewConversation}
                  >
                    <Plus size={15} />
                    Nuevo mensaje
                  </button>
                )}
              </div>
            )}
          </aside>

          <section className="nexo-chat-thread" aria-label="Conversación seleccionada">
            {pageError ? (
              <div className="nexo-chat-empty-state">
                <ShieldCheck size={30} />
                <h2>No se pudo abrir la mensajería</h2>
                <p>{pageError}</p>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setRealtimeVersion((version) => version + 1)}
                >
                  Reintentar
                </button>
              </div>
            ) : activeConversation ? (
              <>
                <header className="nexo-chat-thread-header">
                  <Avatar
                    name={activeConversation.other_user_email || 'Usuario'}
                    size={43}
                  />

                  <div className="nexo-chat-thread-person">
                    <strong>{activeConversation.other_user_email}</strong>
                    <small>
                      {activeConversation.other_user_role === 'admin'
                        ? 'Administrador'
                        : 'Miembro'}
                      {' · '}
                      {workspace?.organizationName}
                    </small>
                  </div>

                  <span className="nexo-chat-secure-label">
                    <ShieldCheck size={14} />
                    Privado
                  </span>

                  {(activeConversation.contact_name || activeConversation.company_name) && (
                    <div className="nexo-chat-context">
                      <Building2 size={13} />
                      <span>
                        {activeConversation.contact_name || activeConversation.company_name}
                        {activeConversation.contact_name && activeConversation.company_name
                          ? ` · ${activeConversation.company_name}`
                          : ''}
                      </span>
                    </div>
                  )}
                </header>

                <div className="nexo-chat-messages" aria-live="polite">
                  {messagesLoading && messages.length === 0 ? (
                    <div className="nexo-chat-message-state">
                      Cargando mensajes…
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="nexo-chat-empty-state">
                      <div className="nexo-chat-empty-icon">
                        <MessageCircle size={27} />
                      </div>
                      <h2>Empezá la conversación</h2>
                      <p>
                        Este chat es privado entre vos y {activeConversation.other_user_email}.
                        Escribí el primer mensaje para comenzar.
                      </p>
                    </div>
                  ) : (
                    <div className="nexo-chat-message-list">
                      {messages.map((message, index) => {
                        const own = message.sender_id === currentUserId;
                        const previous = messages[index - 1];
                        const showDate =
                          !previous ||
                          !sameCalendarDay(previous.created_at, message.created_at);

                        return (
                          <div key={message.id}>
                            {showDate && (
                              <div className="nexo-chat-date-divider">
                                <span>{formatMessageDate(message.created_at)}</span>
                              </div>
                            )}

                            <div className={`nexo-chat-message-row ${own ? 'own' : 'received'}`}>
                              <div className="nexo-chat-bubble">
                                {!own && (
                                  <small>{activeConversation.other_user_email}</small>
                                )}

                                <p>{message.body}</p>

                                <time>
                                  {formatMessageTime(message.created_at)}
                                  {own && <Check size={13} />}
                                </time>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messageEndRef} />
                    </div>
                  )}
                </div>

                {messageError && (
                  <div className="nexo-chat-message-error" role="alert">
                    {messageError}
                  </div>
                )}

                <form
                  className="nexo-chat-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendMessage();
                  }}
                >
                  <textarea
                    ref={composerRef}
                    value={draft}
                    maxLength={5000}
                    rows={2}
                    placeholder="Escribí un mensaje… (Enter para enviar, Shift + Enter para salto de línea)"
                    aria-label="Escribir mensaje"
                    disabled={sending}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                  />

                  <div className="nexo-chat-composer-footer">
                    <small>{draft.length}/5000</small>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={sending || !draft.trim()}
                    >
                      <Send size={15} />
                      {sending ? 'Enviando…' : 'Enviar'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="nexo-chat-empty-state">
                <div className="nexo-chat-empty-icon">
                  <MessageSquare size={28} />
                </div>
                <h2>Tu espacio de conversación</h2>
                <p>
                  Seleccioná una conversación de la izquierda o iniciá un chat
                  privado con un integrante de tu equipo.
                </p>
                {otherMembers.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={openNewConversation}
                  >
                    <Plus size={15} />
                    Nuevo mensaje
                  </button>
                )}
                {otherMembers.length === 0 && !loading && (
                  <small>
                    Invitá a otro integrante desde Configuración → Gestión del equipo.
                  </small>
                )}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="nexo-inbox nexo-external-inbox">
          <aside className="nexo-inbox-list" aria-label="Contactos externos">
            <div className="nexo-inbox-list-head">
              <h2>Contactos</h2>
              <span>{data.contacts.length}</span>
            </div>

            <label className="nexo-inbox-search">
              <Search size={16} />
              <input
                value={contactSearch}
                onChange={(event) => {
                  setContactSearch(event.target.value);
                  setExternalContactId(null);
                }}
                placeholder="Buscar contacto o empresa"
                aria-label="Buscar contacto externo"
              />
            </label>

            <div className="nexo-inbox-contacts">
              {filteredContacts.length > 0 ? (
                filteredContacts.map((contact) => {
                  const company = data.companies.find(
                    (item) => item.id === contact.companyId,
                  );

                  return (
                    <button
                      key={contact.id}
                      type="button"
                      className={`nexo-inbox-contact ${selectedExternalContact?.id === contact.id ? 'active' : ''}`}
                      onClick={() => setExternalContactId(contact.id)}
                    >
                      <Avatar name={contact.name} size={36} />
                      <span>
                        <strong>{contact.name}</strong>
                        <small>{company?.name || 'Sin cliente vinculado'}</small>
                        <small>
                          {contact.email || contact.phone || 'Sin datos de contacto'}
                        </small>
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="nexo-inbox-no-results">
                  No encontramos contactos.
                </p>
              )}
            </div>
          </aside>

          <section className="nexo-inbox-thread" aria-label="Canales del contacto">
            {selectedExternalContact ? (
              <>
                <div className="nexo-inbox-thread-head">
                  <Avatar name={selectedExternalContact.name} size={42} />
                  <div>
                    <strong>{selectedExternalContact.name}</strong>
                    <small>{selectedExternalCompany?.name || 'Sin empresa'}</small>
                  </div>
                  <span className="nexo-inbox-status">Canales externos</span>
                </div>

                <div className="nexo-inbox-empty-thread">
                  <div className="nexo-inbox-hero">
                    <MessageCircle size={28} />
                  </div>

                  <h2>
                    Contactá a {selectedExternalContact.name.split(' ')[0]}
                  </h2>

                  <p>
                    Estos accesos abren aplicaciones externas. NEXO no recibe
                    ni sincroniza las respuestas de WhatsApp o email.
                  </p>

                  <div className="nexo-inbox-actions">
                    {mailLink ? (
                      <a className="btn btn-primary" href={mailLink}>
                        <Mail size={16} />
                        Abrir email
                        <ArrowUpRight size={14} />
                      </a>
                    ) : (
                      <span className="nexo-inbox-unavailable">
                        <Mail size={16} />
                        Sin email válido
                      </span>
                    )}

                    {whatsappLink ? (
                      <a
                        className="btn btn-outline"
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle size={16} />
                        Abrir WhatsApp
                        <ArrowUpRight size={14} />
                      </a>
                    ) : (
                      <span className="nexo-inbox-unavailable">
                        <MessageCircle size={16} />
                        Sin teléfono internacional
                      </span>
                    )}
                  </div>

                  <div className="nexo-inbox-tip">
                    <Building2 size={15} />
                    Los datos de contacto se administran desde la sección Contactos.
                  </div>
                </div>
              </>
            ) : (
              <div className="nexo-inbox-empty-thread">
                <UserRound size={28} />
                <h2>Elegí un contacto</h2>
                <p>
                  Los contactos que crees en NEXO aparecerán acá automáticamente.
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {newConversationOpen && (
        <div
          className="nexo-message-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creatingConversation) {
              setNewConversationOpen(false);
            }
          }}
        >
          <section
            className="nexo-message-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nexo-message-modal-title"
          >
            <header className="nexo-message-modal-header">
              <div>
                <span>NUEVA CONVERSACIÓN</span>
                <h2 id="nexo-message-modal-title">Enviar un mensaje</h2>
              </div>

              <button
                type="button"
                className="nexo-extras-icon"
                aria-label="Cerrar"
                disabled={creatingConversation}
                onClick={() => setNewConversationOpen(false)}
              >
                <X size={18} />
              </button>
            </header>

            <form
              className="nexo-message-modal-form"
              onSubmit={(event) => void createConversation(event)}
            >
              <label>
                Integrante del equipo
                <select
                  required
                  value={newMemberId}
                  onChange={(event) => setNewMemberId(event.target.value)}
                >
                  <option value="">Seleccioná un destinatario</option>
                  {otherMembers.map((member) => (
                    <option
                      key={member.member_user_id}
                      value={member.member_user_id}
                    >
                      {member.member_email} · {member.member_role === 'admin' ? 'Administrador' : 'Miembro'}
                    </option>
                  ))}
                </select>
              </label>

              <div className="nexo-message-modal-divider">
                Contexto comercial (opcional)
              </div>

              <label>
                Empresa relacionada
                <select
                  value={newCompanyId}
                  onChange={(event) => {
                    setNewCompanyId(event.target.value);
                    setNewContactId('');
                  }}
                >
                  <option value="">Sin empresa vinculada</option>
                  {data.companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Contacto relacionado
                <select
                  value={newContactId}
                  onChange={(event) => {
                    const contactId = event.target.value;
                    setNewContactId(contactId);

                    const contact = data.contacts.find(
                      (item) => item.id === contactId,
                    );

                    if (contact?.companyId) {
                      setNewCompanyId(contact.companyId);
                    }
                  }}
                >
                  <option value="">Sin contacto vinculado</option>
                  {availableContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                    </option>
                  ))}
                </select>
              </label>

              {newConversationError && (
                <p className="nexo-message-modal-error" role="alert">
                  {newConversationError}
                </p>
              )}

              <footer>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={creatingConversation}
                  onClick={() => setNewConversationOpen(false)}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creatingConversation || !newMemberId}
                >
                  <MessageSquare size={15} />
                  {creatingConversation ? 'Preparando…' : 'Abrir conversación'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
