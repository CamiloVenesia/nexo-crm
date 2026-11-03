
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

import {
  Building2,
  Check,
  FlaskConical,
  MessageCircle,
  MessageSquare,
  Plus,
  Search,
  Send,
  UsersRound,
  X,
} from 'lucide-react';

import { Avatar, PageHeading } from '../components/Shared';
import { useCRM } from '../lib/store';

import './workspace-extras.css';
import './messages-internal.css';
import './demo-messages.css';

const DEMO_MESSAGES_KEY = 'nexo-demo-messages-v1';

type ChatTab = 'team' | 'contacts';

type DemoMember = {
  id: string;
  name: string;
  email: string;
  role: 'Administrador' | 'Miembro';
  company: string;
};

type DemoMessage = {
  id: string;
  own: boolean;
  text: string;
  createdAt: number;
};

type DemoConversation = {
  memberId: string;
  unread: number;
  messages: DemoMessage[];
};

const members: DemoMember[] = [
  {
    id: 'ventas',
    name: 'Elena Torres',
    email: 'elena@nexo-demo.example',
    role: 'Miembro',
    company: 'BrightLabs',
  },
  {
    id: 'coordinacion',
    name: 'Marcos Vidal',
    email: 'marcos@nexo-demo.example',
    role: 'Administrador',
    company: 'Pampa Logística',
  },
  {
    id: 'soporte',
    name: 'Lucía Castillo',
    email: 'lucia@nexo-demo.example',
    role: 'Miembro',
    company: 'Faro Digital',
  },
  {
    id: 'operaciones',
    name: 'Natalia Suárez',
    email: 'natalia@nexo-demo.example',
    role: 'Miembro',
    company: 'Andes Tech',
  },
  {
    id: 'diseno',
    name: 'Bruno Campos',
    email: 'bruno@nexo-demo.example',
    role: 'Miembro',
    company: 'Lumen Studio',
  },
  {
    id: 'administracion',
    name: 'Valeria Ríos',
    email: 'valeria@nexo-demo.example',
    role: 'Miembro',
    company: 'Nova Retail',
  },
];

function initialConversations(): DemoConversation[] {
  const now = Date.now();

  const message = (
    id: string,
    own: boolean,
    text: string,
    minutesAgo: number,
  ): DemoMessage => ({
    id,
    own,
    text,
    createdAt: now - minutesAgo * 60_000,
  });

  return [
    {
      memberId: 'ventas',
      unread: 2,
      messages: [
        message(
          'v1',
          false,
          'Buen día. BrightLabs confirmó que quiere avanzar con la propuesta.',
          155,
        ),
        message(
          'v2',
          true,
          'Excelente. ¿Tenemos fecha para la reunión?',
          145,
        ),
        message(
          'v3',
          false,
          'Sí, mañana a las 11:00. Ya lo agregué al calendario.',
          16,
        ),
        message(
          'v4',
          false,
          'También actualicé la oportunidad en el pipeline.',
          14,
        ),
      ],
    },
    {
      memberId: 'coordinacion',
      unread: 0,
      messages: [
        message(
          'c1',
          false,
          'Revisé las tareas pendientes de esta semana.',
          325,
        ),
        message(
          'c2',
          true,
          '¿Hay algún vencimiento prioritario?',
          311,
        ),
        message(
          'c3',
          false,
          'El seguimiento de Pampa Logística. Lo dejé marcado como alta prioridad.',
          91,
        ),
      ],
    },
    {
      memberId: 'soporte',
      unread: 1,
      messages: [
        message(
          's1',
          true,
          '¿Cómo va la incorporación de Faro Digital?',
          610,
        ),
        message(
          's2',
          false,
          'Bien, ya cargamos los contactos y el primer seguimiento.',
          602,
        ),
        message(
          's3',
          false,
          'Te comparto las novedades en la reunión del equipo.',
          205,
        ),
      ],
    },
    {
      memberId: 'operaciones',
      unread: 0,
      messages: [
        message(
          'o1',
          false,
          'Ya actualicé los datos de Andes Tech.',
          1465,
        ),
        message(
          'o2',
          true,
          'Perfecto, gracias. Lo reviso en el dashboard.',
          1445,
        ),
      ],
    },
  ];
}

function readDemoConversations(): DemoConversation[] {
  try {
    const raw = window.sessionStorage.getItem(DEMO_MESSAGES_KEY);

    if (!raw) return initialConversations();

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return initialConversations();
    }

    const valid = parsed.every((conversation) => {
      if (
        !conversation ||
        typeof conversation !== 'object'
      ) {
        return false;
      }

      const item = conversation as Partial<DemoConversation>;

      return (
        typeof item.memberId === 'string' &&
        members.some((member) => member.id === item.memberId) &&
        typeof item.unread === 'number' &&
        Array.isArray(item.messages) &&
        item.messages.every((message: DemoMessage) =>
          typeof message.id === 'string' &&
          typeof message.text === 'string' &&
          typeof message.own === 'boolean' &&
          typeof message.createdAt === 'number'
        )
      );
    });

    return valid && parsed.length <= members.length
      ? (parsed as DemoConversation[])
      : initialConversations();
  } catch {
    return initialConversations();
  }
}

function timeLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dateLabel(timestamp: number): string {
  const date = new Date(timestamp);

  if (date.toDateString() === new Date().toDateString()) {
    return 'Hoy';
  }

  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
  });
}

export function DemoMessages() {
  const { data } = useCRM();

  const [tab, setTab] = useState<ChatTab>('team');

  const [conversations, setConversations] =
    useState<DemoConversation[]>(readDemoConversations);

  const [selectedId, setSelectedId] = useState('ventas');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        DEMO_MESSAGES_KEY,
        JSON.stringify(conversations),
      );
    } catch {
      setStorageWarning(true);
    }
  }, [conversations]);

  const sorted = useMemo(
    () =>
      [...conversations].sort(
        (a, b) =>
          (b.messages.at(-1)?.createdAt ?? 0) -
          (a.messages.at(-1)?.createdAt ?? 0),
      ),
    [conversations],
  );

  const visibleConversations = sorted.filter((item) => {
    const member = members.find(
      (candidate) => candidate.id === item.memberId,
    );

    return (
      member &&
      `${member.name} ${member.email} ${member.company}`
        .toLocaleLowerCase('es-AR')
        .includes(search.toLocaleLowerCase('es-AR'))
    );
  });

  const selected = conversations.find(
    (item) => item.memberId === selectedId,
  );

  const recipient = members.find(
    (member) => member.id === selectedId,
  );

  const unusedMembers = members.filter(
    (member) =>
      !conversations.some(
        (item) => item.memberId === member.id,
      ),
  );

  const filteredContacts = data.contacts.filter((contact) =>
    `${contact.name} ${contact.email}`
      .toLocaleLowerCase('es-AR')
      .includes(contactSearch.toLocaleLowerCase('es-AR')),
  );

  const selectedContact = data.contacts.find(
    (contact) => contact.id === contactId,
  );

  const selectedContactCompany = data.companies.find(
    (company) => company.id === selectedContact?.companyId,
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      block: 'end',
      behavior: 'instant',
    });
  }, [selectedId, selected?.messages.length]);

  function selectConversation(memberId: string) {
    setSelectedId(memberId);

    setConversations((current) =>
      current.map((item) =>
        item.memberId === memberId
          ? { ...item, unread: 0 }
          : item,
      ),
    );
  }

  function sendMessage(event?: FormEvent) {
    event?.preventDefault();

    const text = draft.trim();

    if (
      !text ||
      text.length > 2000 ||
      !selected
    ) {
      return;
    }

    const message: DemoMessage = {
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      own: true,
      createdAt: Date.now(),
    };

    setConversations((current) =>
      current.map((item) =>
        item.memberId === selectedId
          ? {
              ...item,
              messages: [...item.messages, message].slice(-200),
            }
          : item,
      ),
    );

    setDraft('');
  }

  function onComposerKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function createConversation(event: FormEvent) {
    event.preventDefault();

    if (
      !unusedMembers.some(
        (member) => member.id === newMemberId,
      )
    ) {
      return;
    }

    setConversations((current) => [
      ...current,
      {
        memberId: newMemberId,
        unread: 0,
        messages: [],
      },
    ]);

    setSelectedId(newMemberId);
    setTab('team');
    setNewMemberId('');
    setShowNew(false);
  }

  return (
    <div className="nexo-extras nexo-messages-page nexo-demo-messages">
      <PageHeading
        eyebrow="COMUNICACIÓN / DEMOSTRACIÓN"
        title="Mensajería"
        subtitle="Explorá conversaciones de ejemplo y enviá mensajes simulados sin conectarte a usuarios reales."
        action={
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setShowNew(true)}
            disabled={unusedMembers.length === 0}
          >
            <Plus size={16} />
            Nuevo mensaje
          </button>
        }
      />

      <div className="nexo-demo-chat-info">
        <FlaskConical size={15} />
        <span>
          <strong>Mensajería de prueba.</strong> Los participantes, las conversaciones y los mensajes son ficticios. Nada se envía a Supabase.
        </span>
      </div>

      {storageWarning && (
        <p className="nexo-demo-chat-warning" role="status">
          El navegador bloqueó el almacenamiento temporal. Los mensajes podrían perderse al recargar.
        </p>
      )}

      <div
        className="nexo-message-tabs"
        role="tablist"
        aria-label="Canales de mensajería de prueba"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'team'}
          className={tab === 'team' ? 'active' : ''}
          onClick={() => setTab('team')}
        >
          <UsersRound size={16} />
          Equipo
          <span>{conversations.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === 'contacts'}
          className={tab === 'contacts' ? 'active' : ''}
          onClick={() => setTab('contacts')}
        >
          <Building2 size={16} />
          Contactos externos
        </button>
      </div>

      {tab === 'team' ? (
        <div className="nexo-chat-layout">
          <aside
            className="nexo-chat-sidebar"
            aria-label="Conversaciones de ejemplo"
          >
            <div className="nexo-chat-sidebar-heading">
              <div>
                <h2>Conversaciones</h2>
                <small>{members.length} integrantes ficticios</small>
              </div>

              <button
                type="button"
                className="nexo-chat-new-button"
                disabled={unusedMembers.length === 0}
                onClick={() => setShowNew(true)}
                title="Nueva conversación de prueba"
                aria-label="Nueva conversación de prueba"
              >
                <Plus size={17} />
              </button>
            </div>

            <label className="nexo-chat-search">
              <Search size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar conversación"
                aria-label="Buscar conversación de prueba"
              />
            </label>

            {visibleConversations.length ? (
              <div className="nexo-chat-conversation-list">
                {visibleConversations.map((item) => {
                  const member = members.find(
                    (candidate) => candidate.id === item.memberId,
                  )!;

                  const last = item.messages.at(-1);

                  return (
                    <button
                      key={item.memberId}
                      type="button"
                      className={`nexo-chat-conversation ${
                        selectedId === item.memberId ? 'active' : ''
                      }`}
                      onClick={() => selectConversation(item.memberId)}
                    >
                      <Avatar name={member.name} size={42} />

                      <span className="nexo-chat-conversation-copy">
                        <span className="nexo-chat-conversation-topline">
                          <strong>{member.name}</strong>

                          {last && (
                            <time>
                              {dateLabel(last.createdAt) === 'Hoy'
                                ? timeLabel(last.createdAt)
                                : dateLabel(last.createdAt)}
                            </time>
                          )}
                        </span>

                        <span className="nexo-chat-conversation-preview">
                          {last
                            ? `${last.own ? 'Vos: ' : ''}${last.text}`
                            : 'Iniciá la conversación'}
                        </span>

                        <span className="nexo-chat-conversation-meta">
                          <span>
                            {member.company} · {member.role}
                          </span>

                          {item.unread > 0 && <b>{item.unread}</b>}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="nexo-chat-sidebar-empty">
                <MessageSquare size={23} />
                <strong>Sin coincidencias</strong>
                <p>Probá buscando otro integrante.</p>
              </div>
            )}
          </aside>

          <section
            className="nexo-chat-thread"
            aria-label="Chat de demostración"
          >
            {selected && recipient ? (
              <>
                <header className="nexo-chat-thread-header">
                  <Avatar name={recipient.name} size={43} />

                  <div className="nexo-chat-thread-person">
                    <strong>{recipient.name}</strong>
                    <small>
                      {recipient.role} · Equipo de demostración
                    </small>
                  </div>

                  <span className="nexo-demo-chat-tag">
                    <FlaskConical size={13} />
                    Simulado
                  </span>

                  <span className="nexo-chat-context">
                    <Building2 size={13} />
                    <span>{recipient.company}</span>
                  </span>
                </header>

                <div
                  className="nexo-chat-messages"
                  aria-live="polite"
                >
                  {selected.messages.length ? (
                    <div className="nexo-chat-message-list">
                      {selected.messages.map((message, index) => {
                        const previous = selected.messages[index - 1];

                        const showDate =
                          !previous ||
                          new Date(previous.createdAt).toDateString() !==
                            new Date(message.createdAt).toDateString();

                        return (
                          <div key={message.id}>
                            {showDate && (
                              <div className="nexo-chat-date-divider">
                                <span>
                                  {new Date(message.createdAt).toLocaleDateString(
                                    'es-AR',
                                    {
                                      weekday: 'long',
                                      day: 'numeric',
                                      month: 'long',
                                    },
                                  )}
                                </span>
                              </div>
                            )}

                            <div
                              className={`nexo-chat-message-row ${
                                message.own ? 'own' : 'received'
                              }`}
                            >
                              <div className="nexo-chat-bubble">
                                {!message.own && (
                                  <small>{recipient.name}</small>
                                )}

                                <p>{message.text}</p>

                                <time>
                                  {timeLabel(message.createdAt)}

                                  {message.own && <Check size={12} />}
                                </time>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    <div className="nexo-chat-empty-state">
                      <MessageCircle size={28} />
                      <h2>Conversación de ejemplo</h2>
                      <p>
                        Escribí un mensaje para explorar cómo funciona NEXO.
                      </p>
                    </div>
                  )}
                </div>

                <form
                  className="nexo-chat-composer"
                  onSubmit={sendMessage}
                >
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={onComposerKeyDown}
                    maxLength={2000}
                    placeholder="Escribí un mensaje de prueba..."
                    aria-label="Mensaje de prueba"
                  />

                  <div className="nexo-chat-composer-footer">
                    <small>
                      Enter para enviar · Shift + Enter para nueva línea · Envío local
                    </small>

                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={!draft.trim()}
                    >
                      <Send size={15} />
                      Enviar
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="nexo-chat-empty-state">
                <MessageSquare size={28} />
                <h2>Elegí una conversación</h2>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="nexo-inbox nexo-external-inbox">
          <aside
            className="nexo-inbox-list"
            aria-label="Contactos externos ficticios"
          >
            <div className="nexo-inbox-list-head">
              <h2>Contactos</h2>
              <span>{data.contacts.length}</span>
            </div>

            <label className="nexo-inbox-search">
              <Search size={16} />

              <input
                value={contactSearch}
                onChange={(event) =>
                  setContactSearch(event.target.value)
                }
                placeholder="Buscar contacto o empresa"
                aria-label="Buscar contacto ficticio"
              />
            </label>

            <div className="nexo-inbox-contacts">
              {filteredContacts.map((contact) => {
                const company = data.companies.find(
                  (item) => item.id === contact.companyId,
                );

                return (
                  <button
                    key={contact.id}
                    type="button"
                    className={`nexo-inbox-contact ${
                      contactId === contact.id ? 'active' : ''
                    }`}
                    onClick={() => setContactId(contact.id)}
                  >
                    <Avatar name={contact.name} size={36} />

                    <span>
                      <strong>{contact.name}</strong>
                      <small>
                        {company?.name || 'Sin empresa vinculada'}
                      </small>
                      <small>
                        {contact.email || 'Contacto de prueba'}
                      </small>
                    </span>
                  </button>
                );
              })}

              {filteredContacts.length === 0 && (
                <p className="nexo-inbox-no-results">
                  Sin coincidencias.
                </p>
              )}
            </div>
          </aside>

          <section
            className="nexo-inbox-thread"
            aria-label="Vista de contacto de prueba"
          >
            {selectedContact ? (
              <>
                <div className="nexo-inbox-thread-head">
                  <Avatar name={selectedContact.name} size={42} />

                  <div>
                    <strong>{selectedContact.name}</strong>
                    <small>
                      {selectedContactCompany?.name || 'Sin empresa'}
                    </small>
                  </div>

                  <span className="nexo-inbox-status">
                    Datos de ejemplo
                  </span>
                </div>

                <div className="nexo-inbox-empty-thread">
                  <div className="nexo-inbox-hero">
                    <MessageCircle size={28} />
                  </div>

                  <h2>{selectedContact.name}</h2>

                  <p>
                    En una cuenta real, NEXO permite acceder a los
                    canales de contacto. En esta demostración no se
                    abren enlaces de WhatsApp ni se envían correos.
                  </p>

                  <div className="nexo-demo-contact-preview">
                    <strong>Contacto comercial ficticio</strong>
                    <span>
                      {selectedContact.email || 'Sin email'}
                    </span>
                    <span>
                      {selectedContactCompany?.name || 'Sin empresa'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="nexo-inbox-empty-thread">
                <MessageCircle size={28} />
                <h2>Elegí un contacto</h2>
                <p>
                  Estos contactos son datos ficticios de demostración.
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {showNew && (
        <div
          className="nexo-message-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowNew(false);
            }
          }}
        >
          <section
            className="nexo-message-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nexo-demo-message-modal-title"
          >
            <header className="nexo-message-modal-header">
              <div>
                <span>CONVERSACIÓN DE PRUEBA</span>
                <h2 id="nexo-demo-message-modal-title">
                  Nuevo mensaje
                </h2>
              </div>

              <button
                type="button"
                className="nexo-extras-icon"
                onClick={() => setShowNew(false)}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </header>

            <form
              className="nexo-message-modal-form"
              onSubmit={createConversation}
            >
              <label>
                Integrante ficticio

                <select
                  value={newMemberId}
                  required
                  onChange={(event) =>
                    setNewMemberId(event.target.value)
                  }
                >
                  <option value="">
                    Seleccioná un integrante
                  </option>

                  {unusedMembers.map((member) => (
                    <option
                      key={member.id}
                      value={member.id}
                    >
                      {member.name} · {member.role}
                    </option>
                  ))}
                </select>
              </label>

              <p className="nexo-demo-modal-note">
                Esta conversación será visible solamente en tu sesión Demo.
              </p>

              <footer>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowNew(false)}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!newMemberId}
                >
                  <MessageSquare size={15} />
                  Abrir conversación
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
