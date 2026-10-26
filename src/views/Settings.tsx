
import { useRef, useState } from 'react';

import {
  AlertTriangle,
  CloudOff,
  Download,
  FileJson2,
  FileUp,
  RotateCcw,
  Save,
  ShieldCheck,
  UserRoundCog,
} from 'lucide-react';

import { useCRM } from '../lib/store';
import { assertData, downloadJSON } from '../lib/utils';
import { PageHeading, SectionTitle } from '../components/Shared';

export function Settings() {
  const crm = useCRM();
  const { data } = crm;

  const [org, setOrg] = useState(data.settings.organization);
  const [name, setName] = useState(data.settings.userName);
  const [currency, setCurrency] = useState(data.settings.currency);
  const [error, setError] = useState('');

  const picker = useRef<HTMLInputElement>(null);

  const restore = async (file?: File) => {
    if (!file) return;

    try {
      if (file.size > 3_000_000) {
        throw new Error('El archivo supera el límite de 3 MB.');
      }

      const raw = await file.text();
      const value = assertData(JSON.parse(raw));

      if (
        window.confirm(
          '¿Restaurar este respaldo? Reemplazará los datos actuales guardados en el navegador.',
        )
      ) {
        crm.restore(value);

        setOrg(value.settings.organization);
        setName(value.settings.userName);
        setCurrency(value.settings.currency);
        setError('');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo leer el archivo.',
      );
    } finally {
      if (picker.current) {
        picker.current.value = '';
      }
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / PREFERENCIAS"
        title="Configuración"
        subtitle="Personalizá tu espacio de trabajo y administrá tus datos de demostración."
      />

      <div className="settings-grid">
        <div className="panel setting-panel">
          <SectionTitle
            icon={<UserRoundCog size={18} />}
            title="Preferencias generales"
            description="Datos visibles en esta versión del CRM"
          />

          <form
            className="settings-form"
            onSubmit={(e) => {
              e.preventDefault();

              if (!org.trim() || !name.trim()) return;

              crm.updateSettings({
                organization: org.trim(),
                userName: name.trim(),
                currency,
              });
            }}
          >
            <div className="form-field">
              <label>Nombre del espacio de trabajo</label>

              <input
                value={org}
                maxLength={80}
                required
                onChange={(e) => setOrg(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Tu nombre</label>

              <input
                value={name}
                maxLength={80}
                required
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Moneda de las oportunidades</label>

              <select
                value={currency}
                onChange={(e) =>
                  setCurrency(e.target.value as 'ARS' | 'USD')
                }
              >
                <option value="ARS">
                  ARS — Pesos argentinos
                </option>

                <option value="USD">
                  USD — Dólares estadounidenses
                </option>
              </select>

              <small>
                Cambia el símbolo de visualización; no convierte
                los importes existentes.
              </small>
            </div>

            <button type="submit" className="btn btn-primary">
              <Save size={16} />
              Guardar preferencias
            </button>
          </form>
        </div>

        <div className="panel setting-panel">
          <SectionTitle
            icon={<ShieldCheck size={18} />}
            title="Datos y respaldos"
            description="Controlá la información cargada en el navegador"
          />

          <div className="storage-note">
            <CloudOff size={23} />

            <div>
              <strong>Demo local, sin servidor</strong>

              <p>
                Los datos se guardan en el navegador de este
                dispositivo. No existe sincronización entre
                usuarios ni copia automática en la nube.
              </p>
            </div>
          </div>

          <div className="setting-action">
            <div>
              <strong>Descargar respaldo</strong>

              <p>
                Guarda oportunidades, contactos, empresas y tareas
                en un archivo JSON.
              </p>
            </div>

            <button
              className="btn btn-outline"
              onClick={() => downloadJSON(data)}
            >
              <Download size={15} />
              Exportar JSON
            </button>
          </div>

          <div className="setting-action">
            <div>
              <strong>Restaurar respaldo</strong>

              <p>
                Importá un archivo generado previamente por esta
                demo.
              </p>
            </div>

            <input
              ref={picker}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => void restore(e.target.files?.[0])}
            />

            <button
              className="btn btn-outline"
              onClick={() => picker.current?.click()}
            >
              <FileUp size={15} />
              Importar JSON
            </button>
          </div>

          {error && (
            <div className="form-error">
              <AlertTriangle size={15} />
              {error}
            </div>
          )}

          <div className="setting-action destructive">
            <div>
              <strong>Reiniciar demo</strong>

              <p>
                Elimina los cambios locales y recupera los datos
                de ejemplo.
              </p>
            </div>

            <button
              className="btn btn-danger-subtle"
              onClick={() => {
                if (
                  window.confirm(
                    '¿Restaurar todos los datos de demostración? Perderás los cambios locales que no hayas exportado.',
                  )
                ) {
                  crm.reset();

                  setOrg('NEXO Studio');
                  setName('Alex Morgan');
                  setCurrency('ARS');
                }
              }}
            >
              <RotateCcw size={15} />
              Reiniciar
            </button>
          </div>
        </div>
      </div>

      <div className="settings-disclaimer">
        <FileJson2 size={20} />

        <div>
          <strong>
            ¿Queremos convertirlo en un CRM comercial?
          </strong>

          <p>
            Esta versión está pensada para demostrar experiencia
            de producto y funcionalidades. Antes de usar datos
            reales de clientes se necesita backend, base de
            datos, cuentas de usuario, permisos, auditoría,
            backups y seguridad de producción.
          </p>
        </div>
      </div>
    </>
  );
}
