
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import {
  AlertTriangle,
  CloudOff,
  Download,
  FileJson2,
  FileUp,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  UserRoundCog,
  X,
} from 'lucide-react';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeading, SectionTitle } from '../components/Shared';
import { useCRM } from '../lib/store';

import {
  applyExchangeRate,
  fetchDollarQuote,
  getAppliedExchangeRate,
  validateFinancialData,
} from '../lib/currencyExchange';

import type { ExchangeSource } from '../lib/currencyExchange';

import {
  MAX_PREFERENCE_LENGTH,
  summarizeCRMData,
  validateBackupFile,
  validatePreferences,
} from '../lib/settingsSafety';

import { assertData, downloadJSON } from '../lib/utils';
import type { CRMData, Settings as WorkspaceSettings } from '../types';

import './settings-safety.css';

type BackupPreview = {
  name: string;
  data: CRMData;
};

const formatMoney = (
  value: number,
  currency: 'ARS' | 'USD',
) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatRate = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export function Settings() {
  const crm = useCRM();
  const { data } = crm;

  const appliedRate = getAppliedExchangeRate(data);

  const [org, setOrg] = useState(data.settings.organization);
  const [name, setName] = useState(data.settings.userName);

  const [currency, setCurrency] = useState<
    WorkspaceSettings['currency']
  >(data.settings.currency);

  const [rateInput, setRateInput] = useState(
    appliedRate === null ? '' : String(appliedRate),
  );

  const [rateSource, setRateSource] =
    useState<ExchangeSource>('manual');

  const [officialDate, setOfficialDate] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [preferencesError, setPreferencesError] = useState('');
  const [success, setSuccess] = useState('');

  const [backupError, setBackupError] = useState('');

  const [preview, setPreview] =
    useState<BackupPreview | null>(null);

  const [readingFile, setReadingFile] = useState(false);

  const [confirmRestoreOpen, setConfirmRestoreOpen] =
    useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');

  const picker = useRef<HTMLInputElement>(null);
  const readSequence = useRef(0);

  // ============================================
  // SINCRONIZAR PREFERENCIAS
  // ============================================

  useEffect(() => {
    setOrg(data.settings.organization);
    setName(data.settings.userName);
    setCurrency(data.settings.currency);

    const rate = getAppliedExchangeRate(data);

    setRateInput(rate === null ? '' : String(rate));

    setRateSource(
      data.settings.exchangeRateSource ?? 'manual',
    );

    setOfficialDate(
      data.settings.exchangeRateUpdatedAt ?? '',
    );

    setPreferencesError('');
  }, [data.settings]);

  const rateChanged =
    rateInput.trim() !==
    (appliedRate === null ? '' : String(appliedRate));

  const currencyChanged =
    currency !== data.settings.currency;

  const hasUnsavedChanges =
    org !== data.settings.organization ||
    name !== data.settings.userName ||
    currencyChanged ||
    rateChanged;

  const currentCounts = summarizeCRMData(data);

  const previewCounts = preview
    ? summarizeCRMData(preview.data)
    : null;

  const enteredRate = Number(rateInput);

  const rateValid =
    rateInput.trim() !== '' &&
    Number.isFinite(enteredRate) &&
    enteredRate > 0 &&
    enteredRate <= 1_000_000_000;

  // ============================================
  // VISTA PREVIA DE CONVERSIÓN
  // ============================================

  const firstDeal = data.deals.find(
    (deal) => deal.amount > 0,
  );

  let example: {
    before: string;
    after: string;
  } | null = null;

  if (
    firstDeal &&
    rateValid &&
    (rateChanged || currencyChanged)
  ) {
    const previousBase =
      firstDeal.amountBaseARS ??
      (data.settings.currency === 'ARS'
        ? firstDeal.amount
        : appliedRate !== null
          ? firstDeal.amount * appliedRate
          : null);

    if (previousBase !== null) {
      const newAmount =
        currency === 'ARS'
          ? previousBase
          : previousBase / enteredRate;

      if (Number.isFinite(newAmount)) {
        example = {
          before: formatMoney(
            firstDeal.amount,
            data.settings.currency,
          ),

          after: formatMoney(
            Math.round(newAmount * 100) / 100,
            currency,
          ),
        };
      }
    }
  }

  // ============================================
  // CONSULTAR COTIZACIÓN OFICIAL
  // ============================================

  const consultOfficialRate = async () => {
    if (quoteLoading) return;

    setQuoteLoading(true);
    setPreferencesError('');
    setSuccess('');

    try {
      const quote = await fetchDollarQuote();

      setRateInput(String(quote.rate));
      setRateSource('oficial');
      setOfficialDate(quote.updatedAt);
    } catch (error) {
      setPreferencesError(
        error instanceof Error
          ? error.message
          : 'No se pudo consultar la cotización.',
      );
    } finally {
      setQuoteLoading(false);
    }
  };

  // ============================================
  // GUARDAR PREFERENCIAS
  // ============================================

  const savePreferences = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (quoteLoading) return;

    setSuccess('');

    const result = validatePreferences(
      org,
      name,
      currency,
    );

    if (!result.ok) {
      setPreferencesError(result.error);
      return;
    }

    if (rateChanged || currencyChanged) {
      if (!rateValid) {
        setPreferencesError(
          'Ingresá una cotización válida, por ejemplo 1560.50, sin separador de miles.',
        );
        return;
      }

      try {
        const timestamp = new Date().toISOString();

        const converted = applyExchangeRate(
          data,
          result.value.currency,
          enteredRate,
          rateSource,
          timestamp,
          rateSource === 'oficial' && officialDate
            ? officialDate
            : timestamp,
        );

        crm.restore({
          ...converted,
          settings: {
            ...converted.settings,
            ...result.value,
          },
        });

        setPreferencesError('');

        setSuccess(
          'Cotización y preferencias guardadas. Importes actualizados.',
        );
      } catch (error) {
        setPreferencesError(
          error instanceof Error
            ? error.message
            : 'No se pudo aplicar la cotización.',
        );
      }

      return;
    }

    if (hasUnsavedChanges) {
      crm.updateSettings({
        ...data.settings,
        ...result.value,
      });

      setSuccess('Preferencias guardadas.');
    }

    setPreferencesError('');
  };

  const discardPreferences = () => {
    setOrg(data.settings.organization);
    setName(data.settings.userName);
    setCurrency(data.settings.currency);

    setRateInput(
      appliedRate === null ? '' : String(appliedRate),
    );

    setRateSource(
      data.settings.exchangeRateSource ?? 'manual',
    );

    setOfficialDate(
      data.settings.exchangeRateUpdatedAt ?? '',
    );

    setPreferencesError('');
    setSuccess('');
  };

  // ============================================
  // INSPECCIONAR RESPALDO
  // ============================================

  const inspectBackup = async (file?: File) => {
    if (!file) return;

    const sequence = ++readSequence.current;

    setPreview(null);
    setConfirmRestoreOpen(false);
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
      const raw = await file.text();

      if (sequence !== readSequence.current) {
        return;
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(
          'El archivo no contiene un JSON válido.',
        );
      }

      const validData = assertData(parsed);

      validateFinancialData(validData);

      setPreview({
        name: file.name,
        data: validData,
      });
    } catch (error) {
      if (sequence === readSequence.current) {
        setBackupError(
          error instanceof Error
            ? error.message
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
    setConfirmRestoreOpen(false);
    setBackupError('');
    setReadingFile(false);

    if (picker.current) {
      picker.current.value = '';
    }
  };

  // ============================================
  // CONFIRMAR RESTAURACIÓN
  // ============================================

  const applyBackup = () => {
    if (!preview) {
      setConfirmRestoreOpen(false);
      return;
    }

    try {
      const validData = assertData(preview.data);

      validateFinancialData(validData);

      crm.restore(validData);

      cancelPreview();

      setResetOpen(false);
      setResetPhrase('');
      setSuccess('');
    } catch (error) {
      setBackupError(
        error instanceof Error
          ? error.message
          : 'No se pudo restaurar el respaldo.',
      );

      setConfirmRestoreOpen(false);
    }
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
    setConfirmRestoreOpen(false);
    setBackupError('');
    setReadingFile(false);
    setResetOpen(false);
    setResetPhrase('');
    setSuccess('');

    if (picker.current) {
      picker.current.value = '';
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
        {/* PREFERENCIAS GENERALES */}

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
                  setSuccess('');
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
                  setSuccess('');
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

                  setSuccess('');
                }}
              >
                <option value="ARS">
                  ARS — Pesos argentinos
                </option>

                <option value="USD">
                  USD — Dólares estadounidenses
                </option>
              </select>
            </div>

            {/* COTIZACIÓN EDITABLE */}

            <div className="form-field">
              <label htmlFor="nexo-dollar-rate">
                Cotización del dólar — 1 USD en pesos argentinos
              </label>

              <div className="settings-buttons">
                <input
                  id="nexo-dollar-rate"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max="1000000000"
                  step="0.01"
                  value={rateInput}
                  placeholder="Ej.: 1560.50"
                  style={{
                    flex: '1 1 150px',
                    minWidth: 0,
                  }}
                  onChange={(event) => {
                    setRateInput(event.target.value);
                    setRateSource('manual');
                    setOfficialDate('');
                    setPreferencesError('');
                    setSuccess('');
                  }}
                />

                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={quoteLoading}
                  onClick={() => void consultOfficialRate()}
                >
                  <RefreshCw size={15} />

                  {quoteLoading
                    ? 'Consultando...'
                    : 'Consultar oficial'}
                </button>
              </div>

              <small>
                Podés modificar la cotización manualmente.
                «Consultar oficial» solo carga un valor de
                referencia; no aplica cambios hasta que guardes.
              </small>

              {appliedRate !== null && (
                <small>
                  Cotización aplicada: 1 USD ={' '}
                  {formatRate(appliedRate)} ARS.

                  {data.settings.exchangeRateUpdatedAt && (
                    <>
                      {' '}Actualizada:{' '}
                      {new Date(
                        data.settings.exchangeRateUpdatedAt,
                      ).toLocaleString('es-AR')}.
                    </>
                  )}
                </small>
              )}

              {data.settings.currency === 'USD' &&
                appliedRate === null && (
                  <p className="settings-unsaved">
                    No encontramos la cotización anterior.
                    Para evitar cifras incorrectas,
                    recuperá un respaldo original en ARS
                    antes de recalcular.
                  </p>
                )}
            </div>

            {/* VISTA PREVIA DE CONVERSIÓN */}

            {(rateChanged || currencyChanged) && (
              <div
                className="settings-unsaved"
                role="status"
              >
                <strong>Vista previa del cambio</strong>

                <p style={{ margin: '6px 0 0' }}>
                  {rateValid
                    ? `Nueva cotización: 1 USD = ${formatRate(
                        enteredRate,
                      )} ARS.`
                    : 'Ingresá una cotización válida para ver el resultado.'}
                </p>

                {example && (
                  <p style={{ margin: '6px 0 0' }}>
                    Ejemplo: {example.before}
                    {' → '}
                    {example.after}
                  </p>
                )}

                <p style={{ margin: '6px 0 0' }}>
                  Los importes se actualizarán al guardar.
                  Si mantenés ARS, modificar la cotización
                  no altera los importes en pesos.
                </p>
              </div>
            )}

            {preferencesError && (
              <div
                className="form-error"
                role="alert"
              >
                <AlertTriangle size={15} />
                {preferencesError}
              </div>
            )}

            {success && (
              <p
                className="settings-unsaved"
                role="status"
              >
                {success}
              </p>
            )}

            {hasUnsavedChanges && (
              <p className="settings-unsaved">
                Tenés cambios sin guardar.
              </p>
            )}

            <div className="settings-buttons">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  !hasUnsavedChanges ||
                  quoteLoading
                }
              >
                <Save size={16} />
                Guardar preferencias y cotización
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

        {/* DATOS Y RESPALDOS */}

        <div className="panel setting-panel">
          <SectionTitle
            icon={<ShieldCheck size={18} />}
            title="Datos y respaldos"
            description="Controlá la información guardada en este navegador"
          />

          <div className="storage-note">
            <CloudOff size={23} />

            <div>
              <strong>Demo local, sin servidor</strong>

              <p>
                Los datos se guardan en este navegador.
                No existe sincronización entre dispositivos
                ni una copia automática en la nube.
              </p>
            </div>
          </div>

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

          {/* EXPORTAR RESPALDO */}

          <div className="setting-action">
            <div>
              <strong>Descargar respaldo</strong>

              <p>
                Incluye registros, moneda y cotización
                aplicada en un archivo JSON.
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
              <strong>Restaurar respaldo</strong>

              <p>
                Importá un JSON de NEXO CRM (máximo 3 MB)
                y revisalo antes de reemplazar datos.
              </p>
            </div>

            <input
              ref={picker}
              type="file"
              accept=".json,application/json"
              hidden
              aria-label="Seleccionar respaldo JSON"
              onChange={(event) =>
                void inspectBackup(
                  event.currentTarget.files?.[0],
                )
              }
            />

            <button
              type="button"
              className="btn btn-outline"
              disabled={readingFile}
              onClick={() => picker.current?.click()}
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

          {/* VISTA PREVIA DEL RESPALDO */}

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
                <div>
                  <small>DATOS ACTUALES</small>

                  <strong>
                    {data.settings.organization}
                  </strong>

                  <span>
                    {currentCounts.deals}
                    {' '}oportunidades ·{' '}
                    {currentCounts.contacts}
                    {' '}contactos
                  </span>

                  <span>
                    {currentCounts.companies}
                    {' '}empresas ·{' '}
                    {currentCounts.tasks}
                    {' '}tareas
                  </span>

                  <span>
                    Moneda: {data.settings.currency}
                    {' · '}
                    Cotización:{' '}
                    {appliedRate ?? 'no registrada'}
                  </span>
                </div>

                <div>
                  <small>RESPALDO SELECCIONADO</small>

                  <strong>
                    {preview.data.settings.organization}
                  </strong>

                  <span>
                    {previewCounts.deals}
                    {' '}oportunidades ·{' '}
                    {previewCounts.contacts}
                    {' '}contactos
                  </span>

                  <span>
                    {previewCounts.companies}
                    {' '}empresas ·{' '}
                    {previewCounts.tasks}
                    {' '}tareas
                  </span>

                  <span>
                    {previewCounts.activities}
                    {' '}actividades ·{' '}
                    {preview.data.settings.currency}
                  </span>

                  <span>
                    Cotización:{' '}
                    {getAppliedExchangeRate(
                      preview.data,
                    ) ?? 'no registrada'}
                  </span>
                </div>
              </div>

              <p className="settings-preview-warning">
                <AlertTriangle size={15} />

                Al restaurar se reemplazarán también
                la moneda y la cotización.
              </p>

              <div className="settings-buttons">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    setConfirmRestoreOpen(true)
                  }
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

          {/* REINICIAR DEMO */}

          <div className="setting-action destructive">
            <div>
              <strong>Reiniciar demo</strong>

              <p>
                Recupera los datos originales en ARS.
                Se perderán los cambios no exportados.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-danger-subtle"
              onClick={() => {
                setResetOpen((value) => !value);
                setResetPhrase('');
              }}
            >
              <RotateCcw size={15} />
              Reiniciar
            </button>
          </div>

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
                Exportá un respaldo si necesitás
                conservar los cambios.
                Escribí <strong>REINICIAR</strong>.
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
                  setResetPhrase(event.target.value)
                }
              />

              <div className="settings-buttons">
                <button
                  type="button"
                  className="btn btn-danger-subtle"
                  disabled={
                    resetPhrase.trim() !== 'REINICIAR'
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

      {/* AVISO SOBRE LA VERSIÓN DEMO */}

      <div className="settings-disclaimer">
        <FileJson2 size={20} />

        <div>
          <strong>
            ¿Queremos convertirlo en un CRM comercial?
          </strong>

          <p>
            Esta versión demuestra funcionalidades
            de producto. Antes de usar datos reales
            de clientes necesita backend, base de
            datos, permisos, auditoría y seguridad
            de producción. La cotización manual
            no garantiza un precio bancario ni
            constituye un registro de cobros.
          </p>
        </div>
      </div>

      {/* DIÁLOGO PROFESIONAL PARA RESTAURAR */}

      {confirmRestoreOpen && preview && (
        <ConfirmDialog
          tone="danger"
          title="¿Restaurar este respaldo?"
          description={
            `Vas a reemplazar los datos de ${data.settings.organization} por el respaldo «${preview.name}» ` +
            `de ${preview.data.settings.organization}.\n\n` +
            `Actual: ${currentCounts.deals} oportunidades, ${currentCounts.contacts} contactos, ` +
            `${currentCounts.companies} empresas y ${currentCounts.tasks} tareas.\n` +
            `Respaldo: ${preview.data.deals.length} oportunidades, ${preview.data.contacts.length} contactos, ` +
            `${preview.data.companies.length} empresas y ${preview.data.tasks.length} tareas.\n\n` +
            'También se reemplazarán la moneda y la cotización. No se combinarán los registros ' +
            'ni podrás deshacer el cambio sin otro respaldo.'
          }
          confirmLabel="Restaurar respaldo"
          onConfirm={applyBackup}
          onCancel={() =>
            setConfirmRestoreOpen(false)
          }
        />
      )}
    </>
  );
}
