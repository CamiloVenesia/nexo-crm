
import { useState } from 'react';
import { Settings2, UsersRound } from 'lucide-react';

import { Settings as SettingsBase } from './SettingsBase';
import { TeamManagement } from './TeamManagement';

import { useWorkspace } from '../lib/workspace';
import { supabase } from '../lib/supabase';

type SettingsTab = 'preferences' | 'team';

export function Settings() {
  const [activeTab, setActiveTab] =
    useState<SettingsTab>('preferences');

  const workspace = useWorkspace();

  return (
    <>
      {/* NAVEGACIÓN DE CONFIGURACIÓN */}

      <div
        role="tablist"
        aria-label="Secciones de configuración"
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: '1px solid #34486e',
        }}
      >
        <button
          type="button"
          role="tab"
          id="nexo-preferences-tab"
          aria-controls="nexo-preferences-panel"
          aria-selected={activeTab === 'preferences'}
          className={
            activeTab === 'preferences'
              ? 'btn btn-primary'
              : 'btn btn-outline'
          }
          onClick={() =>
            setActiveTab('preferences')
          }
        >
          <Settings2 size={16} />
          Preferencias
        </button>

        <button
          type="button"
          role="tab"
          id="nexo-team-tab"
          aria-controls="nexo-team-panel"
          aria-selected={activeTab === 'team'}
          className={
            activeTab === 'team'
              ? 'btn btn-primary'
              : 'btn btn-outline'
          }
          onClick={() =>
            setActiveTab('team')
          }
        >
          <UsersRound size={16} />
          Gestión del equipo
        </button>
      </div>

      {/* CONTENIDO DE LAS PESTAÑAS */}

      {activeTab === 'preferences' ? (
        <div
          role="tabpanel"
          id="nexo-preferences-panel"
          aria-labelledby="nexo-preferences-tab"
        >
          <SettingsBase />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="nexo-team-panel"
          aria-labelledby="nexo-team-tab"
        >
          {workspace && supabase ? (
            <TeamManagement />
          ) : (
            <div className="panel setting-panel">
              <h2>Gestión del equipo</h2>

              <p>
                No se pudo identificar una sesión
                y organización activas en Supabase.
              </p>

              <p>
                Iniciá sesión con tu cuenta para
                administrar los miembros del equipo.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
