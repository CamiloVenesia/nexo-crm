
import { useMemo, useState } from 'react';

import {
  ArrowUpRight,
  Building2,
  Globe2,
  MapPin,
  Plus,
  Search,
  UsersRound,
} from 'lucide-react';

import { useCRM } from '../lib/store';
import { Company } from '../types';
import { money } from '../lib/utils';

import {
  CompanyIcon,
  Empty,
  PageHeading,
} from '../components/Shared';

export function Companies({
  onAdd,
  onEdit,
}: {
  onAdd: () => void;
  onEdit: (item: Company) => void;
}) {
  const { data } = useCRM();

  const [search, setSearch] = useState('');

  const companies = useMemo(
    () =>
      data.companies.filter((company) =>
        `${company.name} ${company.industry} ${company.location}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [data.companies, search],
  );

  return (
    <>
      <PageHeading
        eyebrow="RELACIONES / EMPRESAS"
        title="Empresas"
        subtitle="Conocé mejor a las organizaciones con las que trabajás."
        action={
          <button
            className="btn btn-primary"
            onClick={onAdd}
          >
            <Plus size={16} />
            Nueva empresa
          </button>
        }
      />

      <div className="panel full-panel">
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

        <div className="companies-grid">
          {companies.map((company) => {
            const contacts = data.contacts.filter(
              (contact) =>
                contact.companyId === company.id,
            ).length;

            const deals = data.deals.filter(
              (deal) =>
                deal.companyId === company.id,
            );

            return (
              <button
                key={company.id}
                className="company-card"
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
                    {contacts} contactos
                  </span>

                  <span>
                    <Building2 size={14} />
                    {deals.length} oportunidades
                  </span>
                </div>

                <div className="company-volume">
                  {money(
                    deals.reduce(
                      (total, deal) =>
                        total + deal.amount,
                      0,
                    ),
                    data.settings.currency,
                    true,
                  )}

                  <small>
                    {' '}volumen total asociado
                  </small>
                </div>
              </button>
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
