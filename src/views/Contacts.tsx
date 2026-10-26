
import { useMemo, useState } from 'react';

import {
  ArrowUpRight,
  Download,
  Mail,
  Phone,
  Plus,
  Search,
  UsersRound,
} from 'lucide-react';

import { useCRM } from '../lib/store';
import { csvDownload } from '../lib/utils';
import { Contact } from '../types';

import {
  Avatar,
  Empty,
  PageHeading,
  Tag,
} from '../components/Shared';

export function Contacts({
  onAdd,
  onEdit,
}: {
  onAdd: () => void;
  onEdit: (item: Contact) => void;
}) {
  const { data, notify } = useCRM();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('todos');

  const list = useMemo(
    () =>
      data.contacts.filter(
        (contact) =>
          (status === 'todos' ||
            contact.status === status) &&
          `${contact.name} ${contact.email} ${
            contact.role
          } ${
            data.companies.find(
              (company) =>
                company.id === contact.companyId,
            )?.name ?? ''
          }`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [data, search, status],
  );

  const exportCsv = () => {
    csvDownload('nexo-contactos.csv', [
      [
        'Nombre',
        'Correo',
        'Teléfono',
        'Cargo',
        'Empresa',
        'Estado',
        'Origen',
      ],
      ...list.map((contact) => [
        contact.name,
        contact.email,
        contact.phone,
        contact.role,
        data.companies.find(
          (company) =>
            company.id === contact.companyId,
        )?.name ?? '',
        contact.status,
        contact.source,
      ]),
    ]);

    notify('Contactos exportados');
  };

  return (
    <>
      <PageHeading
        eyebrow="RELACIONES / PERSONAS"
        title="Contactos"
        subtitle="Todas tus relaciones comerciales, con su contexto en un solo lugar."
        action={
          <button
            className="btn btn-primary"
            onClick={onAdd}
          >
            <Plus size={16} />
            Agregar contacto
          </button>
        }
      />

      <div className="summary-row">
        <div className="summary-count">
          <span className="summary-symbol">
            <UsersRound size={20} />
          </span>

          <div>
            <strong>{data.contacts.length}</strong>
            <small>Contactos registrados</small>
          </div>
        </div>

        <div className="summary-count">
          <span className="summary-symbol purple">
            <Mail size={20} />
          </span>

          <div>
            <strong>
              {
                data.contacts.filter(
                  (contact) =>
                    contact.status === 'calificado',
                ).length
              }
            </strong>

            <small>Contactos calificados</small>
          </div>
        </div>

        <div className="summary-tip">
          Tus contactos están conectados con empresas
          y oportunidades.
        </div>
      </div>

      <div className="panel full-panel">
        <div className="toolbar">
          <div className="search-field">
            <Search size={17} />

            <input
              aria-label="Buscar contactos"
              placeholder="Buscar nombre, correo o empresa..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <div className="toolbar-right">
            <select
              className="select-filter"
              aria-label="Filtrar estado"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
            >
              <option value="todos">
                Todos los estados
              </option>

              <option value="nuevo">
                Nuevos
              </option>

              <option value="contactado">
                Contactados
              </option>

              <option value="calificado">
                Calificados
              </option>
            </select>

            <button
              className="btn btn-outline"
              onClick={exportCsv}
            >
              <Download size={15} />
              CSV
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Contacto</th>
                <th>Empresa / Cargo</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th>Origen</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {list.map((contact) => (
                <tr
                  key={contact.id}
                  onClick={() => onEdit(contact)}
                  tabIndex={0}
                  onKeyDown={(event) =>
                    event.key === 'Enter' &&
                    onEdit(contact)
                  }
                >
                  <td>
                    <div className="table-person">
                      <Avatar
                        name={contact.name}
                        size={38}
                      />

                      <span>
                        <strong>
                          {contact.name}
                        </strong>

                        <small>
                          {contact.email || 'Sin correo'}
                        </small>
                      </span>
                    </div>
                  </td>

                  <td>
                    <strong className="table-subtitle">
                      {data.companies.find(
                        (company) =>
                          company.id ===
                          contact.companyId,
                      )?.name ?? 'Sin empresa'}
                    </strong>

                    <small>
                      {contact.role || 'Sin cargo'}
                    </small>
                  </td>

                  <td>{contact.phone || '—'}</td>

                  <td>
                    <Tag
                      tone={
                        contact.status === 'calificado'
                          ? 'green'
                          : contact.status ===
                              'contactado'
                            ? 'purple'
                            : 'blue'
                      }
                    >
                      {contact.status === 'nuevo'
                        ? 'Nuevo'
                        : contact.status ===
                            'contactado'
                          ? 'Contactado'
                          : 'Calificado'}
                    </Tag>
                  </td>

                  <td>{contact.source}</td>

                  <td>
                    <ArrowUpRight size={17} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!list.length && (
            <Empty
              title="Sin contactos para mostrar"
              detail="Creá el primer contacto o ajustá tu búsqueda."
              onAction={onAdd}
            />
          )}
        </div>
      </div>

      <div className="hint-row">
        <Phone size={15} />
        Los datos de contacto incluidos al inicio
        son ficticios y solo sirven para explorar
        la aplicación.
      </div>
    </>
  );
}
