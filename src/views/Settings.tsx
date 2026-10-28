
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

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
  X,
} from 'lucide-react';

import { useCRM } from '../lib/store';

import {
  MAX_PREFERENCE_LENGTH,
  summarizeCRMData,
  validateBackupFile,
  validatePreferences,
} from '../lib/settingsSafety';

import {
  assertData,
  downloadJSON,
} from '../lib/utils';

import type {
  CRMData,
  Settings as WorkspaceSettings,
} from '../types';

import {
  PageHeading,
  SectionTitle,
} from '../components/Shared';

import './settings-safety.css';

type BackupPreview = {
  name: string;
  data: CRMData;
};

export function Settings() {
  const crm = useCRM();
  const { data } = crm;

  const [org, setOrg] = useState(
    data.settings.organization,
  );

  const [name, setName] = useState(
    data.settings.userName,
  );

  const [currency, setCurrency] = useState<
    WorkspaceSettings['currency']
  >(data.settings.currency);

  const [preferencesError, setPreferencesError] =
    useState('');

  const [backupError, setBackupError] = useState('');

  const [preview, setPreview] =
    useState<BackupPreview | null>(null);

  const [readingFile, setReadingFile] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');

  const picker = useRef<HTMLInputElement>(null);
  const readSequence = useRef(0);

  // ============================================
  // SINCRONIZAR PREFERENCIAS
  // ============================================

  /*
    Cuando se restaura un respaldo o se reinicia
    la demo, el formulario debe mostrar las
    preferencias realmente guardadas.
  */

  useEffect(() => {
    setOrg(data.settings.organization);
    setName(data.settings.userName);
    setCurrency(data.settings.currency);
    setPreferencesError('');
  }, [
    data.settings.organization,
    data.settings.userName,
    data.settings.currency,
  ]);

  const hasUnsavedChanges =
    org !== data.settings.organization ||
    name !== data.settings.userName ||
    currency !== data.settings.currency;

  const currentCounts = summarizeCRMData(data);

  const previewCounts = preview
    ? summarizeCRMData(preview.data)
    : null;

  // ============================================
  // GUARDAR PREFERENCIAS
  // ============================================

  const savePreferences = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const result = validatePreferences(
      org,
      name,
      currency,
    );

    if (!result.ok) {
      setPreferencesError(result.error);
      return;
    }

    if (
      result.value.organization ===
        data.settings.organization &&
      result.value.userName === data.settings.userName &&
      result.value.currency === data.settings.currency
    ) {
      setOrg(result.value.organization);
      setName(result.value.userName);
      setPreferencesError('');
      return;
    }

    crm.updateSettings(result.value);
    setPreferencesError('');
  };

  const discardPreferences = () => {
    setOrg(data.settings.organization);
    setName(data.settings.userName);
    setCurrency(data.settings.currency);
    setPreferencesError('');
  };

  // ============================================
  // INSPECCIONAR RESPALDO
  // ============================================

  /*
    Elegir un archivo NO reemplaza los datos.

    Primero se verifica su extensión, tamaño,
    sintaxis JSON y estructura mediante assertData.
    Después se presenta una vista previa.
  */

  const inspectBackup = async (file?: File) => {
    if (!file) return;

    const sequence = ++readSequence.current;

    setPreview(null);
    setBackupError('');

    const validationError = validateBackupFile(file);

    if (validationError) {
      setBackupError(validationError);

      if (picker.current) {
        picker.current.value = '';
      }

      return;
    }

    setReadingFile(true);

    try {
      const text = await file.text();

      if (sequence !== readSequence.current) {
        return;
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(
          'El archivo no contiene un JSON válido.',
        );
      }

      const validated = assertData(parsed);

      setPreview({
        name: file.name,
        data: validated,
      });
    } catch (err) {
      if (sequence === readSequence.current) {
        setBackupError(
          err instanceof Error
            ? err.message
            : 'No se pudo leer el respaldo.',
        );
      }
    } finally {
      if (sequence === readSequence.current) {
        setReadingFile(false);

        if (picker.current) {
          picker.current.value = '';
        }
      }
    }
  };

  // ============================================
  // CANCELAR IMPORTACIÓN
  // ============================================

  const cancelPreview = () => {
    ++readSequence.current;

    setPreview(null);
    setBackupError('');
    setReadingFile(false);

    if (picker.current) {
      picker.current.value = '';
    }
  };

  // ============================================
  // RESTAURAR RESPALDO
  // ============================================

  const applyBackup = () => {
    if (!preview) return;

    const confirmed = window.confirm(
      `¿Reemplazar todos los datos actuales por el respaldo "${preview.name}"?\n\n` +
        'Se perderán los cambios locales que no hayas exportado. ' +
        'Esta acción no se puede deshacer desde NEXO CRM.',
    );

    if (!confirmed) return;

    crm.restore(preview.data);

    cancelPreview();

    setResetOpen(false);
    setResetPhrase('');
  };

  // ============================================
  // REINICIAR DEMO
  // ============================================

  const resetDemo = () => {
    if (resetPhrase.trim() !== 'REINICIAR') {
      return;
    }

    ++readSequence.current;

    crm.reset();

    setPreview(null);
    setBackupError('');
    setReadingFile(false);

    setResetOpen(false);
    setResetPhrase('');

    if (picker.current) {
      picker.current.value = '';
    }
  };

  // ============================================
  // INTERFAZ
  // ============================================

  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / PREFERENCIAS"
        title="Configuración"
        subtitle="Personalizá tu espacio de trabajo y administrá tus datos de demostración."
      />

      <div className="settings-grid">
        {/* ======================================
            PREFERENCIAS GENERALES
        ====================================== */}

        <div className="panel setting-panel">
          <SectionTitle
            icon={<UserRoundCog size={18} />}
            title="Preferencias generales"
            description="Datos visibles en esta versión del CRM"
          />

          <form
            className="settings-form"
            onSubmit={savePreferences}
            noValidate
          >
            <div className="form-field">
              <label htmlFor="nexo-organization">
                Nombre del espacio de trabajo
              </label>

              <input
                id="nexo-organization"
                value={org}
                maxLength={MAX_PREFERENCE_LENGTH}
                required
                autoComplete="organization"
                onChange={(event) => {
                  setOrg(event.target.value);
                  setPreferencesError('');
                }}
              />
            </div>

            <div className="form-field">
              <label htmlFor="nexo-user-name">
                Tu nombre
              </label>

              <input
                id="nexo-user-name"
                value={name}
                maxLength={MAX_PREFERENCE_LENGTH}
                required
                autoComplete="name"
                onChange={(event) => {
                  setName(event.target.value);
                  setPreferencesError('');
                }}
              />
            </div>

            <div className="form-field">
              <label htmlFor="nexo-currency">
                Moneda de las oportunidades
              </label>

              <select
                id="nexo-currency"
                value={currency}
                onChange={(event) => {
                  setCurrency(
                    event.target.value as
                      WorkspaceSettings['currency'],
                  );

                  setPreferencesError('');
                }}
              >
                <option value="ARS">
                  ARS — Pesos argentinos
                </option>

                <option value="USD">
                  USD — Dólares estadounidenses
                </option>
              </select>

              <small>
                Cambia la moneda de visualización;
                no convierte los importes existentes.
              </small>
            </div>

            {preferencesError && (
              <div
                className="form-error"
                role="alert"
              >
                <AlertTriangle size={15} />
                {preferencesError}
              </div>
            )}

            {hasUnsavedChanges && (
              <p
                className="settings-unsaved"
                role="status"
              >
                Tenés cambios de preferencias sin guardar.
              </p>
            )}

            <div className="settings-buttons">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!hasUnsavedChanges}
              >
                <Save size={16} />
                Guardar preferencias
              </button>

              {hasUnsavedChanges && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={discardPreferences}
                >
                  Descartar cambios
                </button>
              )}
            </div>
          </form>
        </div>

        {/* ======================================
            DATOS Y RESPALDOS
        ====================================== */}

        <div className="panel setting-panel">
          <SectionTitle
            icon={<ShieldCheck size={18} />}
            title="Datos y respaldos"
            description="Controlá la información guardada en este navegador"
          />

          <div className="storage-note">
            <CloudOff size={23} />

            <div>
              <strong>
                Demo local, sin servidor
              </strong>

              <p>
                Los datos se guardan en este navegador.
                No existe sincronización entre dispositivos
                ni copia automática en la nube. Exportá
                respaldos regularmente si querés conservar
                los cambios.
              </p>
            </div>
          </div>

          {/* CANTIDAD DE REGISTROS */}

          <div
            className="settings-data-summary"
            aria-label="Registros actuales"
          >
            <span>
              <strong>{currentCounts.deals}</strong>
              {' '}oportunidades
            </span>

            <span>
              <strong>{currentCounts.contacts}</strong>
              {' '}contactos
            </span>

            <span>
              <strong>{currentCounts.companies}</strong>
              {' '}empresas
            </span>

            <span>
              <strong>{currentCounts.tasks}</strong>
              {' '}tareas
            </span>

            <span>
              <strong>{currentCounts.activities}</strong>
              {' '}actividades
            </span>
          </div>

          {/* DESCARGAR RESPALDO */}

          <div className="setting-action">
            <div>
              <strong>
                Descargar respaldo
              </strong>

              <p>
                Guarda oportunidades, contactos,
                empresas, tareas, actividad y
                preferencias en un archivo JSON.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => downloadJSON(data)}
            >
              <Download size={15} />
              Exportar JSON
            </button>
          </div>

          {/* IMPORTAR RESPALDO */}

          <div className="setting-action">
            <div>
              <strong>
                Restaurar respaldo
              </strong>

              <p>
                Elegí un archivo de NEXO CRM
                (máximo 3 MB). Podrás revisar su
                contenido antes de reemplazar
                los datos actuales.
              </p>
            </div>

            <input
              ref={picker}
              type="file"
              accept=".json,application/json"
              hidden
              aria-label="Seleccionar respaldo JSON"
              onChange={(event) => {
                void inspectBackup(
                  event.currentTarget.files?.[0],
                );
              }}
            />

            <button
              type="button"
              className="btn btn-outline"
              disabled={readingFile}
              onClick={() =>
                picker.current?.click()
              }
            >
              <FileUp size={15} />

              {readingFile
                ? 'Revisando...'
                : 'Importar JSON'}
            </button>
          </div>

          {backupError && (
            <div
              className="form-error"
              role="alert"
            >
              <AlertTriangle size={15} />
              {backupError}
            </div>
          )}

          {/* ==================================
              VISTA PREVIA DEL RESPALDO
          ================================== */}

          {preview && previewCounts && (
            <div
              className="settings-backup-preview"
              role="region"
              aria-label="Vista previa del respaldo"
            >
              <div className="settings-preview-heading">
                <div>
                  <strong>
                    Respaldo validado para revisión
                  </strong>

                  <p>{preview.name}</p>
                </div>

                <button
                  type="button"
                  className="settings-small-close"
                  aria-label="Cancelar importación"
                  onClick={cancelPreview}
                >
                  <X size={17} />
                </button>
              </div>

              <div className="settings-preview-comparison">
                {/* DATOS ACTUALES */}

                <div>
                  <small>DATOS ACTUALES</small>

                  <strong>
                    {data.settings.organization}
                  </strong>

                  <span>
                    {currentCounts.deals} oportunidades
                    {' · '}
                    {currentCounts.contacts} contactos
                  </span>

                  <span>
                    {currentCounts.companies} empresas
                    {' · '}
                    {currentCounts.tasks} tareas
                  </span>
                </div>

                {/* DATOS DEL ARCHIVO */}

                <div>
                  <small>
                    RESPALDO SELECCIONADO
                  </small>

                  <strong>
                    {preview.data.settings.organization}
                  </strong>

                  <span>
                    {previewCounts.deals} oportunidades
                    {' · '}
                    {previewCounts.contacts} contactos
                  </span>

                  <span>
                    {previewCounts.companies} empresas
                    {' · '}
                    {previewCounts.tasks} tareas
                  </span>

                  <span>
                    {previewCounts.activities} eventos
                    {' · '}
                    {preview.data.settings.currency}
                  </span>
                </div>
              </div>

              <p className="settings-preview-warning">
                <AlertTriangle size={15} />

                Confirmar la importación reemplazará
                todos los datos locales, no los combinará.
              </p>

              <div className="settings-buttons">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={applyBackup}
                >
                  <FileUp size={15} />
                  Confirmar reemplazo
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={cancelPreview}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* ==================================
              REINICIAR DEMOSTRACIÓN
          ================================== */}

          <div className="setting-action destructive">
            <div>
              <strong>
                Reiniciar demo
              </strong>

              <p>
                Recupera los datos de ejemplo.
                Se perderán los cambios locales
                que no hayas exportado.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-danger-subtle"
              onClick={() => {
                setResetOpen(
                  (value) => !value,
                );

                setResetPhrase('');
              }}
            >
              <RotateCcw size={15} />
              Reiniciar
            </button>
          </div>

          {/* CONFIRMACIÓN DE REINICIO */}

          {resetOpen && (
            <div
              className="settings-reset-confirm"
              role="group"
              aria-labelledby="settings-reset-title"
            >
              <strong id="settings-reset-title">
                Confirmar reinicio de demostración
              </strong>

              <p>
                Antes de continuar, exportá un respaldo
                si necesitás estos datos. Para habilitar
                el reinicio escribí{' '}
                <strong>REINICIAR</strong>.
              </p>

              <label htmlFor="settings-reset-phrase">
                Confirmación
              </label>

              <input
                id="settings-reset-phrase"
                value={resetPhrase}
                autoComplete="off"
                placeholder="REINICIAR"
                onChange={(event) =>
                  setResetPhrase(
                    event.target.value,
                  )
                }
              />

              <div className="settings-buttons">
                <button
                  type="button"
                  className="btn btn-danger-subtle"
                  disabled={
                    resetPhrase.trim() !==
                    'REINICIAR'
                  }
                  onClick={resetDemo}
                >
                  <RotateCcw size={15} />
                  Confirmar reinicio
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setResetOpen(false);
                    setResetPhrase('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================================
          AVISO SOBRE LA DEMO
      ====================================== */}

      <div className="settings-disclaimer">
        <FileJson2 size={20} />

        <div>
          <strong>
            ¿Queremos convertirlo en un CRM comercial?
          </strong>

          <p>
            Esta versión demuestra funcionalidades
            y experiencia de producto. Antes de
            utilizar datos reales de clientes se
            necesitan backend, base de datos,
            usuarios, permisos, auditoría,
            respaldos de servidor y seguridad
            de producción.
          </p>
        </div>
      </div>
    </>
  );
}
