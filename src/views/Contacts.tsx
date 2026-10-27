
import { Fragment, useMemo, useState } from 'react';

import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  ClipboardList,
  Download,
  FileClock,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  UsersRound,
  X,
} from 'lucide-react';

import { useCRM } from '../lib/store';

import {
  csvDownload,
  fmtDate,
  fmtDateTime,
  overdue,
  todayDue,
} from '../lib/utils';

import type { Contact } from '../types';

import {
  Avatar,
  Empty,
  PageHeading,
  StageBadge,
  Tag,
} from '../components/Shared';

import './contacts-detail.css';

interface ContactsProps {
  onAdd: () => void;
  onEdit: (item: Contact) => void;
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR')
    .trim();

export function Contacts({
  onAdd,
  onEdit,
}: ContactsProps) {
  const { data, notify } = useCRM();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('todos');

  const [selectedContactId, setSelectedContactId] =
    useState<string | null>(null);

  // ============================================
  // BÚSQUEDA Y FILTROS
  // ============================================

  const list = useMemo(() => {
    const query = normalize(search);

    return data.contacts.filter((contact) => {
      if (
        status !== 'todos' &&
        contact.status !== status
      ) {
        return false;
      }

      const company =
        data.companies.find(
          (item) => item.id === contact.companyId,
        )?.name ?? '';

      const text = normalize(
        [
          contact.name,
          contact.email,
          contact.phone,
          contact.role,
          contact.source,
          company,
        ].join(' '),
      );

      return text.includes(query);
    });
  }, [data.contacts, data.companies, search, status]);

  // ============================================
  // CONTACTO SELECCIONADO
  // ============================================

  const selectedContact = data.contacts.find(
    (contact) => contact.id === selectedContactId,
  );

  const selectedCompany = data.companies.find(
    (company) =>
      company.id === selectedContact?.companyId,
  );

  // ============================================
  // OPORTUNIDADES RELACIONADAS
  // ============================================

  const relatedDeals = useMemo(
    () =>
      data.deals.filter(
        (deal) =>
          deal.contactId === selectedContactId,
      ),
    [data.deals, selectedContactId],
  );

  const relatedDealIds = useMemo(
    () =>
      new Set(relatedDeals.map((deal) => deal.id)),
    [relatedDeals],
  );

  const openRelatedDeals = relatedDeals.filter(
    (deal) =>
      deal.stage !== 'ganado' &&
      deal.stage !== 'perdido',
  );

  // ============================================
  // TAREAS RELACIONADAS
  // ============================================

  const relatedTasks = useMemo(
    () =>
      data.tasks
        .filter((task) =>
          relatedDealIds.has(task.dealId),
        )
        .sort(
          (a, b) =>
            Number(a.done) - Number(b.done) ||
            a.dueDate.localeCompare(b.dueDate),
        ),
    [data.tasks, relatedDealIds],
  );

  const pendingRelatedTasks = relatedTasks.filter(
    (task) => !task.done,
  );

  // ============================================
  // ACTIVIDAD RELACIONADA
  // ============================================

  const relatedActivities = useMemo(() => {
    if (!selectedContact) return [];

    const references = [
      selectedContact.name,
      ...relatedDeals.map((deal) => deal.title),
      ...relatedTasks.map((task) => task.title),
    ]
      .map(normalize)
      .filter((value) => value.length >= 4);

    return data.activities
      .filter((activity) => {
        const text = normalize(
          `${activity.title} ${activity.detail}`,
        );

        return references.some((reference) =>
          text.includes(reference),
        );
      })
      .slice(0, 5);
  }, [
    data.activities,
    selectedContact,
    relatedDeals,
    relatedTasks,
  ]);

  // ============================================
  // EXPORTAR CSV
  // ============================================

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

  // ============================================
  // ABRIR Y CERRAR FICHA
  // ============================================

  const toggleContactDetails = (id: string) => {
    setSelectedContactId((current) =>
      current === id ? null : id,
    );
  };

  // ============================================
  // INTERFAZ
  // ============================================

  return (
    <>
      <PageHeading
        eyebrow="RELACIONES / PERSONAS"
        title="Contactos"
        subtitle="Todas tus relaciones comerciales, con su contexto en un solo lugar."
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAdd}
          >
            <Plus size={16} />
            Agregar contacto
          </button>
        }
      />

      {/* ======================================
          RESUMEN
      ====================================== */}

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
          Consultá los datos de cada contacto, sus
          oportunidades y las tareas relacionadas.
        </div>
      </div>

      {/* ======================================
          TABLA PRINCIPAL
      ====================================== */}

      <div className="panel full-panel">
        <div className="toolbar">
          <div className="search-field">
            <Search size={17} />

            <input
              aria-label="Buscar contactos"
              placeholder="Buscar nombre, correo, teléfono o empresa..."
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
              type="button"
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
                <th>Acción</th>
              </tr>
            </thead>

            <tbody>
              {list.map((contact) => {
                const selected =
                  selectedContactId === contact.id;

                return (
                  <Fragment key={contact.id}>
                    {/* FILA DEL CONTACTO */}

                    <tr
                      className={
                        selected
                          ? 'contact-selected-row'
                          : ''
                      }
                      onClick={() => onEdit(contact)}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (
                          event.target ===
                            event.currentTarget &&
                          event.key === 'Enter'
                        ) {
                          onEdit(contact);
                        }
                      }}
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
                              {contact.email ||
                                'Sin correo'}
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
                          {contact.role ||
                            'Sin cargo'}
                        </small>
                      </td>

                      <td>
                        {contact.phone || '—'}
                      </td>

                      <td>
                        <Tag
                          tone={
                            contact.status ===
                            'calificado'
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

                      <td>
                        {contact.source}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="contact-open-details"
                          aria-label={`${
                            selected
                              ? 'Cerrar'
                              : 'Ver'
                          } ficha de ${contact.name}`}
                          aria-expanded={selected}
                          aria-controls={`contact-details-${contact.id}`}
                          onClick={(event) => {
                            event.stopPropagation();

                            toggleContactDetails(
                              contact.id,
                            );
                          }}
                        >
                          {selected
                            ? 'Cerrar ficha'
                            : 'Ver ficha'}

                          <ArrowUpRight size={15} />
                        </button>
                      </td>
                    </tr>

                    {/* ==================================
                        FICHA DEBAJO DEL CONTACTO
                    ================================== */}

                    {selected && selectedContact && (
                      <tr className="contact-detail-row">
                        <td
                          colSpan={6}
                          style={{
                            padding: 0,
                            verticalAlign: 'top',
                            borderBottom:
                              '1px solid #30466c',
                          }}
                        >
                          <section
                            id={`contact-details-${contact.id}`}
                            className="contact-profile"
                            aria-label={`Ficha comercial de ${selectedContact.name}`}
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                            }}
                          >
                            {/* CABECERA */}

                            <div className="contact-profile-header">
                              <div className="contact-profile-identity">
                                <Avatar
                                  name={selectedContact.name}
                                  size={48}
                                />

                                <div>
                                  <span className="contact-profile-eyebrow">
                                    FICHA COMERCIAL
                                  </span>

                                  <h3>
                                    {selectedContact.name}
                                  </h3>

                                  <p>
                                    {selectedContact.role ||
                                      'Sin cargo registrado'}
                                    {' · '}
                                    {selectedCompany?.name ||
                                      'Sin empresa'}
                                  </p>
                                </div>
                              </div>

                              <div className="contact-profile-actions">
                                {selectedContact.email && (
                                  <a
                                    className="btn btn-outline"
                                    href={`mailto:${selectedContact.email}`}
                                  >
                                    <Mail size={15} />
                                    Correo
                                  </a>
                                )}

                                {selectedContact.phone && (
                                  <a
                                    className="btn btn-outline"
                                    href={`tel:${selectedContact.phone.replace(
                                      /[^\d+]/g,
                                      '',
                                    )}`}
                                  >
                                    <Phone size={15} />
                                    Llamar
                                  </a>
                                )}

                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  onClick={() =>
                                    onEdit(selectedContact)
                                  }
                                >
                                  <Pencil size={15} />
                                  Editar
                                </button>

                                <button
                                  type="button"
                                  className="contact-profile-close"
                                  aria-label="Cerrar ficha"
                                  onClick={() =>
                                    setSelectedContactId(
                                      null,
                                    )
                                  }
                                >
                                  <X size={18} />
                                </button>
                              </div>
                            </div>

                            {/* DATOS GENERALES */}

                            <div className="contact-profile-overview">
                              <div>
                                <span>
                                  Estado comercial
                                </span>

                                <strong>
                                  {selectedContact.status ===
                                  'nuevo'
                                    ? 'Nuevo'
                                    : selectedContact.status ===
                                        'contactado'
                                      ? 'Contactado'
                                      : 'Calificado'}
                                </strong>
                              </div>

                              <div>
                                <span>Origen</span>

                                <strong>
                                  {selectedContact.source ||
                                    'Sin origen'}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Oportunidades abiertas
                                </span>

                                <strong>
                                  {openRelatedDeals.length}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Tareas pendientes vinculadas
                                </span>

                                <strong>
                                  {pendingRelatedTasks.length}
                                </strong>
                              </div>
                            </div>

                            {/* OPORTUNIDADES Y TAREAS */}

                            <div className="contact-profile-columns">
                              {/* OPORTUNIDADES */}

                              <div className="contact-profile-section">
                                <h4>
                                  <Building2 size={17} />
                                  Oportunidades relacionadas
                                </h4>

                                {relatedDeals.length ? (
                                  <div className="contact-profile-list">
                                    {relatedDeals.map(
                                      (deal) => (
                                        <div
                                          className="contact-profile-item"
                                          key={deal.id}
                                        >
                                          <div className="contact-profile-item-main">
                                            <strong>
                                              {deal.title}
                                            </strong>

                                            <small>
                                              {deal.owner}
                                              {' · '}
                                              Cierre:{' '}
                                              {fmtDate(
                                                deal.dueDate,
                                              )}
                                            </small>
                                          </div>

                                          <StageBadge
                                            stage={
                                              deal.stage
                                            }
                                          />
                                        </div>
                                      ),
                                    )}
                                  </div>
                                ) : (
                                  <p className="contact-profile-empty">
                                    Este contacto todavía no
                                    tiene oportunidades
                                    vinculadas.
                                  </p>
                                )}
                              </div>

                              {/* TAREAS */}

                              <div className="contact-profile-section">
                                <h4>
                                  <ClipboardList
                                    size={17}
                                  />
                                  Tareas relacionadas
                                </h4>

                                {relatedTasks.length ? (
                                  <div className="contact-profile-list">
                                    {relatedTasks.map(
                                      (task) => {
                                        const isLate =
                                          !task.done &&
                                          overdue(
                                            task.dueDate,
                                          );

                                        const isToday =
                                          !task.done &&
                                          todayDue(
                                            task.dueDate,
                                          );

                                        return (
                                          <div
                                            className="contact-profile-item"
                                            key={task.id}
                                          >
                                            <div className="contact-profile-item-main">
                                              <strong>
                                                {task.title}
                                              </strong>

                                              <small
                                                className={
                                                  isLate
                                                    ? 'danger-text'
                                                    : ''
                                                }
                                              >
                                                <CalendarDays
                                                  size={12}
                                                />

                                                {task.done
                                                  ? 'Completada · '
                                                  : isLate
                                                    ? 'Vencida · '
                                                    : isToday
                                                      ? 'Hoy · '
                                                      : ''}

                                                {fmtDate(
                                                  task.dueDate,
                                                )}
                                              </small>
                                            </div>

                                            <Tag
                                              tone={
                                                task.done
                                                  ? 'green'
                                                  : task.priority ===
                                                      'alta'
                                                    ? 'red'
                                                    : 'purple'
                                              }
                                            >
                                              {task.done
                                                ? 'Hecha'
                                                : task.priority ===
                                                    'alta'
                                                  ? 'Alta'
                                                  : task.priority ===
                                                      'media'
                                                    ? 'Media'
                                                    : 'Baja'}
                                            </Tag>
                                          </div>
                                        );
                                      },
                                    )}
                                  </div>
                                ) : (
                                  <p className="contact-profile-empty">
                                    No hay tareas asociadas
                                    a las oportunidades de
                                    este contacto.
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* NOTAS */}

                            {selectedContact.notes.trim() && (
                              <div className="contact-profile-notes">
                                <strong>
                                  Notas del contacto
                                </strong>

                                <p>
                                  {selectedContact.notes}
                                </p>
                              </div>
                            )}

                            {/* ACTIVIDAD RECIENTE */}

                            <div className="contact-profile-section contact-profile-history">
                              <h4>
                                <FileClock size={17} />
                                Menciones en la actividad
                                reciente
                              </h4>

                              {relatedActivities.length ? (
                                <div className="contact-profile-list">
                                  {relatedActivities.map(
                                    (activity) => (
                                      <div
                                        className="contact-profile-item"
                                        key={activity.id}
                                      >
                                        <div className="contact-profile-item-main">
                                          <strong>
                                            {activity.title}
                                          </strong>

                                          <small>
                                            {activity.detail}
                                          </small>
                                        </div>

                                        <span className="contact-profile-time">
                                          {fmtDateTime(
                                            activity.createdAt,
                                          )}
                                        </span>
                                      </div>
                                    ),
                                  )}
                                </div>
                              ) : (
                                <p className="contact-profile-empty">
                                  No se encontraron menciones
                                  relacionadas en la
                                  actividad reciente.
                                </p>
                              )}

                              <p className="contact-profile-disclaimer">
                                Las menciones se identifican
                                por nombres y títulos
                                coincidentes. Esta demo
                                todavía no vincula cada
                                movimiento directamente
                                al contacto.
                              </p>
                            </div>
                          </section>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
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
        Los datos de contacto iniciales son ficticios
        y sirven exclusivamente para explorar NEXO CRM.
      </div>
    </>
  );
}
