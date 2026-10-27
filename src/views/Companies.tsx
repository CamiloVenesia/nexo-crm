
import { useEffect, useMemo, useState } from 'react';

import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  ExternalLink,
  FileClock,
  Globe2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  UsersRound,
  X,
} from 'lucide-react';

import { useCRM } from '../lib/store';
import {
  fmtDate,
  fmtDateTime,
  money,
  overdue,
  todayDue,
} from '../lib/utils';

import type { Company, CRMData } from '../types';

import {
  CompanyIcon,
  Empty,
  PageHeading,
  StageBadge,
  Tag,
} from '../components/Shared';

import './companies-detail.css';

interface CompaniesProps {
  onAdd: () => void;
  onEdit: (company: Company) => void;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR')
    .trim();
}

// Coincide con los puntos de corte del styles.css original.
function getVisibleColumns(): number {
  if (typeof window === 'undefined') return 3;

  if (window.matchMedia('(max-width: 560px)').matches) {
    return 1;
  }

  if (window.matchMedia('(max-width: 1180px)').matches) {
    return 2;
  }

  return 3;
}

function getWebsiteUrl(website: string): string | null {
  const value = website.trim();

  if (!value) return null;

  try {
    const url = new URL(
      /^https?:\/\//i.test(value)
        ? value
        : `https://${value}`,
    );

    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    if (url.hostname.endsWith('.example')) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

// ============================================
// FICHA COMERCIAL DE LA EMPRESA
// ============================================

function CompanyProfile({
  company,
  data,
  onEdit,
  onClose,
}: {
  company: Company;
  data: CRMData;
  onEdit: (company: Company) => void;
  onClose: () => void;
}) {
  // CONTACTOS

  const contacts = data.contacts.filter(
    (contact) => contact.companyId === company.id,
  );

  // OPORTUNIDADES

  const deals = data.deals.filter(
    (deal) => deal.companyId === company.id,
  );

  const openDeals = deals.filter(
    (deal) =>
      deal.stage !== 'ganado' &&
      deal.stage !== 'perdido',
  );

  // TAREAS RELACIONADAS POR OPORTUNIDAD

  const dealIds = new Set(
    deals.map((deal) => deal.id),
  );

  const tasks = data.tasks
    .filter((task) => dealIds.has(task.dealId))
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        (a.dueDate || '9999-12-31').localeCompare(
          b.dueDate || '9999-12-31',
        ),
    );

  const pendingTasks = tasks.filter(
    (task) => !task.done,
  );

  const openValue = openDeals.reduce(
    (sum, deal) => sum + deal.amount,
    0,
  );

  const websiteUrl = getWebsiteUrl(company.website);

  // ACTIVIDAD RELACIONADA POR MENCIONES
  // Los eventos actuales no tienen companyId.

  const references = [
    company.name,
    ...contacts.map((contact) => contact.name),
    ...deals.map((deal) => deal.title),
    ...tasks.map((task) => task.title),
  ]
    .map(normalize)
    .filter((value) => value.length >= 4);

  const mentions = data.activities
    .filter((activity) => {
      const text = normalize(
        `${activity.title} ${activity.detail}`,
      );

      return references.some((reference) =>
        text.includes(reference),
      );
    })
    .slice(0, 5);

  return (
    <section
      id={`company-details-${company.id}`}
      className="company-profile"
      aria-label={`Ficha comercial de ${company.name}`}
    >
      {/* CABECERA */}

      <div className="company-profile-header">
        <div className="company-profile-identity">
          <CompanyIcon
            company={company}
            size={50}
          />

          <div>
            <span className="company-profile-eyebrow">
              FICHA COMERCIAL
            </span>

            <h3>{company.name}</h3>

            <p>
              {company.industry || 'Sin sector definido'}
              {' · '}
              {company.location ||
                'Sin ubicación registrada'}
            </p>
          </div>
        </div>

        <div className="company-profile-actions">
          {websiteUrl && (
            <a
              className="btn btn-outline"
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={15} />
              Sitio web
            </a>
          )}

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onEdit(company)}
          >
            <Pencil size={15} />
            Editar
          </button>

          <button
            type="button"
            className="company-profile-close"
            aria-label="Cerrar ficha de empresa"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* INFORMACIÓN GENERAL */}

      <div className="company-profile-information">
        <span>
          <Globe2 size={14} />
          {company.website || 'Sin sitio web'}
        </span>

        <span>
          <UsersRound size={14} />
          {company.employees || 'No informado'}
          {' '}
          empleados (rango declarado)
        </span>

        <span>
          <FileClock size={14} />
          Registrada: {fmtDate(company.createdAt)}
        </span>
      </div>

      {/* INDICADORES */}

      <div className="company-profile-overview">
        <div>
          <span>Contactos</span>
          <strong>{contacts.length}</strong>
        </div>

        <div>
          <span>Oportunidades abiertas</span>
          <strong>{openDeals.length}</strong>
        </div>

        <div>
          <span>Tareas pendientes vinculadas</span>
          <strong>{pendingTasks.length}</strong>
        </div>

        <div>
          <span>Valor de oportunidades abiertas</span>

          <strong>
            {money(
              openValue,
              data.settings.currency,
              true,
            )}
          </strong>
        </div>
      </div>

      {/* INFORMACIÓN RELACIONADA */}

      <div className="company-profile-columns">
        {/* CONTACTOS */}

        <section className="company-profile-section">
          <h4>
            <UsersRound size={17} />
            Contactos vinculados
          </h4>

          {contacts.length ? (
            <div className="company-profile-list">
              {contacts.map((contact) => (
                <div
                  className="company-profile-item"
                  key={contact.id}
                >
                  <div className="company-profile-item-main">
                    <strong>{contact.name}</strong>

                    <small>
                      {contact.role || 'Sin cargo'}
                    </small>

                    {contact.email && (
                      <a href={`mailto:${contact.email}`}>
                        <Mail size={12} />
                        {contact.email}
                      </a>
                    )}

                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone.replace(
                          /[^\d+]/g,
                          '',
                        )}`}
                      >
                        <Phone size={12} />
                        {contact.phone}
                      </a>
                    )}
                  </div>

                  <Tag
                    tone={
                      contact.status === 'calificado'
                        ? 'green'
                        : contact.status === 'contactado'
                          ? 'purple'
                          : 'blue'
                    }
                  >
                    {contact.status === 'nuevo'
                      ? 'Nuevo'
                      : contact.status === 'contactado'
                        ? 'Contactado'
                        : 'Calificado'}
                  </Tag>
                </div>
              ))}
            </div>
          ) : (
            <p className="company-profile-empty">
              Todavía no hay contactos vinculados.
            </p>
          )}
        </section>

        {/* OPORTUNIDADES */}

        <section className="company-profile-section">
          <h4>
            <Building2 size={17} />
            Oportunidades comerciales
          </h4>

          {deals.length ? (
            <div className="company-profile-list">
              {deals.map((deal) => (
                <div
                  className="company-profile-item"
                  key={deal.id}
                >
                  <div className="company-profile-item-main">
                    <strong>{deal.title}</strong>

                    <small>
                      {money(
                        deal.amount,
                        data.settings.currency,
                      )}
                      {' · '}
                      {deal.owner}
                    </small>

                    <small>
                      Fecha estimada: {fmtDate(deal.dueDate)}
                    </small>
                  </div>

                  <StageBadge stage={deal.stage} />
                </div>
              ))}
            </div>
          ) : (
            <p className="company-profile-empty">
              Todavía no hay oportunidades vinculadas.
            </p>
          )}
        </section>

        {/* TAREAS */}

        <section className="company-profile-section">
          <h4>
            <CalendarClock size={17} />
            Tareas de las oportunidades
          </h4>

          {tasks.length ? (
            <div className="company-profile-list">
              {tasks.map((task) => {
                const isLate =
                  !task.done && overdue(task.dueDate);

                const isToday =
                  !task.done && todayDue(task.dueDate);

                return (
                  <div
                    className="company-profile-item"
                    key={task.id}
                  >
                    <div className="company-profile-item-main">
                      <strong>{task.title}</strong>

                      <small
                        className={
                          isLate ? 'danger-text' : ''
                        }
                      >
                        {task.done
                          ? 'Completada · '
                          : isLate
                            ? 'Vencida · '
                            : isToday
                              ? 'Hoy · '
                              : ''}

                        {fmtDate(task.dueDate)}
                      </small>
                    </div>

                    <Tag
                      tone={
                        task.done
                          ? 'green'
                          : task.priority === 'alta'
                            ? 'red'
                            : 'purple'
                      }
                    >
                      {task.done
                        ? 'Hecha'
                        : task.priority === 'alta'
                          ? 'Alta'
                          : task.priority === 'media'
                            ? 'Media'
                            : 'Baja'}
                    </Tag>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="company-profile-empty">
              No hay tareas asociadas a oportunidades
              de esta empresa.
            </p>
          )}
        </section>

        {/* ACTIVIDAD */}

        <section className="company-profile-section">
          <h4>
            <FileClock size={17} />
            Menciones en actividad reciente
          </h4>

          {mentions.length ? (
            <div className="company-profile-list">
              {mentions.map((activity) => (
                <div
                  className="company-profile-item"
                  key={activity.id}
                >
                  <div className="company-profile-item-main">
                    <strong>{activity.title}</strong>

                    <small>{activity.detail}</small>

                    <small>
                      {fmtDateTime(activity.createdAt)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="company-profile-empty">
              No hay menciones recientes relacionadas.
            </p>
          )}

          <p className="company-profile-disclaimer">
            Las menciones se detectan por nombres y
            títulos coincidentes; la demo todavía
            no asocia cada evento a una empresa
            mediante su identificador.
          </p>
        </section>
      </div>
    </section>
  );
}

// ============================================
// PANTALLA DE EMPRESAS
// ============================================

export function Companies({
  onAdd,
  onEdit,
}: CompaniesProps) {
  const { data } = useCRM();

  const [search, setSearch] = useState('');

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [columns, setColumns] =
    useState(getVisibleColumns);

  // Adaptar filas a escritorio, tablet o celular.

  useEffect(() => {
    const mobile = window.matchMedia(
      '(max-width: 560px)',
    );

    const tablet = window.matchMedia(
      '(max-width: 1180px)',
    );

    const onChange = () => {
      setColumns(getVisibleColumns());
    };

    mobile.addEventListener('change', onChange);
    tablet.addEventListener('change', onChange);

    onChange();

    return () => {
      mobile.removeEventListener('change', onChange);
      tablet.removeEventListener('change', onChange);
    };
  }, []);

  // BÚSQUEDA

  const companies = useMemo(() => {
    const query = normalize(search);

    return data.companies.filter((company) =>
      normalize(
        `${company.name} ${company.industry} ${company.location} ${company.website}`,
      ).includes(query),
    );
  }, [data.companies, search]);

  // ORGANIZAR LAS EMPRESAS EN FILAS

  const rows = useMemo(() => {
    const groups: Company[][] = [];

    for (
      let i = 0;
      i < companies.length;
      i += columns
    ) {
      groups.push(
        companies.slice(i, i + columns),
      );
    }

    return groups;
  }, [companies, columns]);

  return (
    <>
      <PageHeading
        eyebrow="RELACIONES / EMPRESAS"
        title="Empresas"
        subtitle="Conocé mejor a las organizaciones con las que trabajás."
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAdd}
          >
            <Plus size={16} />
            Nueva empresa
          </button>
        }
      />

      <div className="panel full-panel">
        {/* BÚSQUEDA */}

        <div className="toolbar">
          <div className="search-field">
            <Search size={17} />

            <input
              placeholder="Buscar empresas por nombre o sector..."
              aria-label="Buscar empresas"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <span className="toolbar-count">
            {companies.length} empresas
          </span>
        </div>

        {/* TARJETAS Y FICHAS */}

        <div className="companies-grid companies-expandable-grid">
          {rows.map((row) => {
            const expandedCompany = row.find(
              (company) =>
                company.id === selectedId,
            );

            return (
              <div
                className="company-grid-group"
                key={row[0].id}
              >
                <div className="company-cards-row">
                  {row.map((company) => {
                    const contacts = data.contacts.filter(
                      (contact) =>
                        contact.companyId === company.id,
                    );

                    const deals = data.deals.filter(
                      (deal) =>
                        deal.companyId === company.id,
                    );

                    const selected =
                      company.id === selectedId;

                    return (
                      <article
                        key={company.id}
                        className={`company-card company-card-with-action${
                          selected
                            ? ' company-card-selected'
                            : ''
                        }`}
                      >
                        {/* CONSERVA LA EDICIÓN ACTUAL */}

                        <button
                          type="button"
                          className="company-card-main"
                          aria-label={`Editar empresa ${company.name}`}
                          onClick={() => onEdit(company)}
                        >
                          <div className="company-card-top">
                            <CompanyIcon
                              company={company}
                              size={52}
                            />

                            <ArrowUpRight size={19} />
                          </div>

                          <strong className="company-card-name">
                            {company.name}
                          </strong>

                          <span className="industry-label">
                            {company.industry ||
                              'Sin sector definido'}
                          </span>

                          <div className="company-detail">
                            <MapPin size={14} />
                            {company.location ||
                              'Ubicación no registrada'}
                          </div>

                          <div className="company-detail">
                            <Globe2 size={14} />
                            {company.website ||
                              'Sin sitio web'}
                          </div>

                          <div className="company-card-bottom">
                            <span>
                              <UsersRound size={14} />
                              {contacts.length} contactos
                            </span>

                            <span>
                              <Building2 size={14} />
                              {deals.length} oportunidades
                            </span>
                          </div>

                          <div className="company-volume">
                            {money(
                              deals.reduce(
                                (sum, deal) =>
                                  sum + deal.amount,
                                0,
                              ),
                              data.settings.currency,
                              true,
                            )}

                            <small>
                              {' '}
                              volumen total asociado
                            </small>
                          </div>
                        </button>

                        {/* ABRIR FICHA */}

                        <button
                          type="button"
                          className="company-open-details"
                          aria-controls={`company-details-${company.id}`}
                          aria-expanded={selected}
                          onClick={() => {
                            setSelectedId((current) =>
                              current === company.id
                                ? null
                                : company.id,
                            );
                          }}
                        >
                          {selected
                            ? 'Cerrar ficha'
                            : 'Ver ficha'}

                          <ArrowUpRight size={15} />
                        </button>
                      </article>
                    );
                  })}
                </div>

                {/* FICHA DEBAJO DE LA FILA */}

                {expandedCompany && (
                  <CompanyProfile
                    company={expandedCompany}
                    data={data}
                    onEdit={onEdit}
                    onClose={() =>
                      setSelectedId(null)
                    }
                  />
                )}
              </div>
            );
          })}
        </div>

        {!companies.length && (
          <Empty
            title="No encontramos empresas"
            detail="Probá otra búsqueda o registrá una nueva empresa."
            onAction={onAdd}
          />
        )}
      </div>
    </>
  );
}
