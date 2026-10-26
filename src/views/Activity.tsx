
import { useState } from 'react';

import {
  Activity as ActivityIcon,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  GitBranch,
  UserRound,
} from 'lucide-react';

import { useCRM } from '../lib/store';
import { fmtDateTime } from '../lib/utils';
import { Empty, PageHeading } from '../components/Shared';
import { ActivityType } from '../types';

const icons: Record<ActivityType, typeof ActivityIcon> = {
  deal: GitBranch,
  task: CheckCircle2,
  contact: UserRound,
  company: Building2,
  note: FileText,
  system: BadgeCheck,
};

export function Activity() {
  const { data } = useCRM();

  const [type, setType] = useState<'all' | ActivityType>(
    'all',
  );

  const list = data.activities.filter(
    (activity) =>
      type === 'all' || activity.type === type,
  );

  return (
    <>
      <PageHeading
        eyebrow="TRAZABILIDAD / HISTORIAL"
        title="Actividad reciente"
        subtitle="Un registro simple de los cambios realizados en este espacio de trabajo."
      />

      <div className="panel full-panel">
        <div className="toolbar">
          <div className="tab-row">
            <button
              className={type === 'all' ? 'active' : ''}
              onClick={() => setType('all')}
            >
              Todo
            </button>

            {(
              [
                {
                  key: 'deal',
                  label: 'Oportunidades',
                },
                {
                  key: 'task',
                  label: 'Tareas',
                },
                {
                  key: 'contact',
                  label: 'Contactos',
                },
                {
                  key: 'company',
                  label: 'Empresas',
                },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                onClick={() => setType(item.key)}
                className={
                  type === item.key ? 'active' : ''
                }
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="muted activity-counter">
            <ActivityIcon size={15} />
            {list.length} movimientos
          </div>
        </div>

        <div className="timeline">
          {list.map((activity) => {
            const Icon = icons[activity.type];

            return (
              <div
                className="timeline-item"
                key={activity.id}
              >
                <div
                  className={`timeline-icon timeline-${activity.type}`}
                >
                  <Icon size={17} />
                </div>

                <div>
                  <strong>
                    {activity.title}
                  </strong>

                  <p>
                    {activity.detail}
                  </p>

                  <small>
                    <Clock3 size={12} />
                    {fmtDateTime(activity.createdAt)}
                  </small>
                </div>
              </div>
            );
          })}
        </div>

        {!list.length && (
          <Empty
            title="Sin actividad"
            detail="Los nuevos cambios aparecerán aquí automáticamente."
          />
        )}
      </div>
    </>
  );
}
