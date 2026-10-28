
import { useMemo, useState } from 'react';

import {
  ArrowUpRight,
  Building2,
  Mail,
  MessageCircle,
  Search,
  ShieldAlert,
  UserRound,
} from 'lucide-react';

import {
  Avatar,
  PageHeading,
} from '../components/Shared';

import { useCRM } from '../lib/store';
import type { Contact } from '../types';

import './workspace-extras.css';

function contactWhatsApp(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');

  // WhatsApp requiere un número internacional.
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

export function Messages() {
  const { data } = useCRM();

  const [search, setSearch] = useState('');
  const [contactId, setContactId] =
    useState<string | null>(null);

  const contacts = useMemo(
    () =>
      data.contacts.filter((contact) => {
        const company = data.companies.find(
          (item) => item.id === contact.companyId,
        );

        return [
          contact.name,
          contact.email,
          company?.name ?? '',
        ]
          .join(' ')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .includes(
            search
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .trim(),
          );
      }),
    [data.contacts, data.companies, search],
  );

  const selected: Contact | undefined =
    data.contacts.find(
      (contact) => contact.id === contactId,
    ) ?? contacts[0];

  const company = data.companies.find(
    (item) => item.id === selected?.companyId,
  );

  const mailLink = selected
    ? contactEmail(selected.email)
    : null;

  const whatsappLink = selected
    ? contactWhatsApp(selected.phone)
    : null;

  return (
    <div className="nexo-extras">
      <PageHeading
        eyebrow="COMUNICACIÓN / MENSAJERÍA"
        title="Mensajería"
        subtitle="Accedé a tus contactos y canales desde un solo lugar."
      />

      <div className="nexo-messages-notice">
        <ShieldAlert size={17} />

        <span>
          <strong>Canales no conectados.</strong>{' '}
          NEXO todavía no recibe ni envía mensajes
          dentro de la aplicación. Los accesos abren
          tu email o WhatsApp por separado;
          no mostramos conversaciones ficticias.
        </span>
      </div>

      <div className="nexo-inbox">
        <aside
          className="nexo-inbox-list"
          aria-label="Contactos de mensajería"
        >
          <div className="nexo-inbox-list-head">
            <h2>Contactos</h2>
            <span>{data.contacts.length}</span>
          </div>

          <label className="nexo-inbox-search">
            <Search size={16} />

            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setContactId(null);
              }}
              placeholder="Buscar contacto o empresa"
              aria-label="Buscar contacto"
            />
          </label>

          <div className="nexo-inbox-contacts">
            {contacts.length ? (
              contacts.map((contact) => {
                const client = data.companies.find(
                  (item) => item.id === contact.companyId,
                );

                return (
                  <button
                    key={contact.id}
                    type="button"
                    className={`nexo-inbox-contact ${
                      selected?.id === contact.id
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      setContactId(contact.id)
                    }
                  >
                    <Avatar
                      name={contact.name}
                      size={36}
                    />

                    <span>
                      <strong>{contact.name}</strong>

                      <small>
                        {client?.name ||
                          'Sin cliente vinculado'}
                      </small>

                      <small>
                        {contact.email ||
                          contact.phone ||
                          'Sin datos de contacto'}
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

        <section
          className="nexo-inbox-thread"
          aria-label="Detalle del contacto"
        >
          {selected ? (
            <>
              <div className="nexo-inbox-thread-head">
                <Avatar
                  name={selected.name}
                  size={42}
                />

                <div>
                  <strong>{selected.name}</strong>

                  <small>
                    {company?.name || 'Sin empresa'}
                  </small>
                </div>

                <span className="nexo-inbox-status">
                  Sin sincronizar
                </span>
              </div>

              <div className="nexo-inbox-empty-thread">
                <div className="nexo-inbox-hero">
                  <MessageCircle size={28} />
                </div>

                <h2>
                  Comunicate con{' '}
                  {selected.name.split(' ')[0]}
                </h2>

                <p>
                  Desde acá podés abrir un canal externo.
                  Cuando conectemos un proveedor, las
                  conversaciones se mostrarán en esta
                  bandeja.
                </p>

                <div className="nexo-inbox-actions">
                  {mailLink ? (
                    <a
                      className="btn btn-primary"
                      href={mailLink}
                    >
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

                  Los datos de contacto se administran
                  desde la sección Contactos.
                </div>
              </div>
            </>
          ) : (
            <div className="nexo-inbox-empty-thread">
              <UserRound size={28} />

              <h2>Elegí un contacto</h2>

              <p>
                Los contactos que crees en NEXO aparecerán
                acá automáticamente.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
