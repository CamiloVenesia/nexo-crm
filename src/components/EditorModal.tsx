
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { FormEvent } from 'react';

import {
  Check,
  Info,
  Trash2,
  X,
} from 'lucide-react';

import { useCRM } from '../lib/store';

import {
  blankCompany,
  blankContact,
  blankDeal,
  blankTask,
  createId,
} from '../lib/seed';

import type {
  Company,
  Contact,
  Deal,
  Stage,
  Task,
} from '../types';

import { STAGES } from '../types';

import {
  validateEditor,
} from '../lib/editorValidation';

import type {
  EditorEntity,
} from '../lib/editorValidation';

// ==================================================
// TIPOS
// ==================================================

export type Editing =
  | { kind: 'deal'; value?: Deal }
  | { kind: 'contact'; value?: Contact }
  | { kind: 'company'; value?: Company }
  | { kind: 'task'; value?: Task };

interface EditorModalProps {
  editing: Editing;
  onClose: () => void;
}

const labels = {
  deal: 'oportunidad',
  contact: 'contacto',
  company: 'empresa',
  task: 'tarea',
};

// ==================================================
// FORMULARIO INICIAL
// ==================================================

function createInitialForm(editing: Editing): EditorEntity {
  if (editing.value) {
    return { ...editing.value };
  }

  const now = new Date().toISOString();
  const id = createId();

  switch (editing.kind) {
    case 'deal':
      return {
        ...blankDeal(),
        id,
        createdAt: now,
        updatedAt: now,
      };

    case 'contact':
      return {
        ...blankContact(),
        id,
        createdAt: now,
      };

    case 'company':
      return {
        ...blankCompany(),
        id,
        createdAt: now,
      };

    case 'task':
      return {
        ...blankTask(),
        id,
        createdAt: now,
      };
  }
}

// ==================================================
// COMPONENTE
// ==================================================

export function EditorModal({
  editing,
  onClose,
}: EditorModalProps) {
  const crm = useCRM();
  const { data } = crm;

  const modalRef = useRef<HTMLElement>(null);
  const submittingRef = useRef(false);

  const [form, setForm] = useState<EditorEntity>(
    () => createInitialForm(editing),
  );

  const originalRef = useRef(
    JSON.stringify(form),
  );

  const [error, setError] = useState('');

  const isDirty =
    JSON.stringify(form) !== originalRef.current;

  // ==================================================
  // ACTUALIZAR CAMPOS
  // ==================================================

  const setField = (
    key: string,
    value: unknown,
  ) => {
    setError('');

    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  // ==================================================
  // CERRAR SIN PERDER DATOS
  // ==================================================

  const requestClose = useCallback(() => {
    if (
      isDirty &&
      !window.confirm(
        'Tenés cambios sin guardar. ¿Querés descartarlos y cerrar el formulario?',
      )
    ) {
      return;
    }

    onClose();
  }, [isDirty, onClose]);

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();

        requestClose();
        return;
      }

      // Mantiene el foco dentro del modal.
      if (event.key === 'Tab') {
        const modal = modalRef.current;

        if (!modal) return;

        const elements = Array.from(
          modal.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])',
          ),
        ).filter(
          (element) =>
            element.getClientRects().length > 0,
        );

        if (!elements.length) return;

        const first = elements[0];
        const last = elements[elements.length - 1];

        if (
          event.shiftKey &&
          document.activeElement === first
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener(
      'keydown',
      handleKeyDown,
      true,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
        true,
      );
    };
  }, [requestClose]);

  // ==================================================
  // GUARDAR
  // ==================================================

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submittingRef.current) return;

    setError('');

    const validationError = validateEditor(
      editing.kind,
      form,
      data,
    );

    if (validationError) {
      setError(validationError);
      return;
    }

    submittingRef.current = true;

    try {
      switch (editing.kind) {
        case 'deal': {
          const item = form as Deal;

          crm.upsertDeal({
            ...item,
            title: item.title.trim(),
            owner: item.owner.trim(),
            updatedAt: new Date().toISOString(),
          });

          break;
        }

        case 'contact': {
          const item = form as Contact;

          crm.upsertContact({
            ...item,
            name: item.name.trim(),
            email: item.email.trim(),
            phone: item.phone.trim(),
            role: item.role.trim(),
          });

          break;
        }

        case 'company': {
          const item = form as Company;

          crm.upsertCompany({
            ...item,
            name: item.name.trim(),
            industry: item.industry.trim(),
            website: item.website.trim(),
            location: item.location.trim(),
          });

          break;
        }

        case 'task': {
          const item = form as Task;

          crm.upsertTask({
            ...item,
            title: item.title.trim(),
          });

          break;
        }
      }

      onClose();
    } catch {
      submittingRef.current = false;

      setError(
        'No se pudo guardar el registro. Revisá los datos e intentá nuevamente.',
      );
    }
  };

  // ==================================================
  // ELIMINAR
  // ==================================================

  const remove = () => {
    if (!editing.value) return;

    const id = editing.value.id;

    const exists = {
      deal: data.deals.some(
        (item) => item.id === id,
      ),
      contact: data.contacts.some(
        (item) => item.id === id,
      ),
      company: data.companies.some(
        (item) => item.id === id,
      ),
      task: data.tasks.some(
        (item) => item.id === id,
      ),
    }[editing.kind];

    if (!exists) {
      setError(
        'Este registro ya no existe. Cerrá el formulario y actualizá la vista.',
      );
      return;
    }

    if (editing.kind === 'company') {
      const linkedContacts = data.contacts.filter(
        (item) => item.companyId === id,
      ).length;

      const linkedDeals = data.deals.filter(
        (item) => item.companyId === id,
      ).length;

      if (linkedContacts || linkedDeals) {
        setError(
          `No se puede eliminar esta empresa: tiene ${linkedContacts} contacto(s) y ${linkedDeals} oportunidad(es) asociados. Desvinculalos primero.`,
        );
        return;
      }
    }

    let consequence =
      'Esta acción no se puede deshacer.';

    if (editing.kind === 'deal') {
      const count = data.tasks.filter(
        (task) => task.dealId === id,
      ).length;

      if (count > 0) {
        consequence =
          `Hay ${count} tarea(s) vinculadas. Se conservarán, pero dejarán de estar asociadas a esta oportunidad.`;
      }
    }

    if (editing.kind === 'contact') {
      const count = data.deals.filter(
        (deal) => deal.contactId === id,
      ).length;

      if (count > 0) {
        consequence =
          `Hay ${count} oportunidad(es) relacionadas. Se conservarán, pero quedarán sin este contacto.`;
      }
    }

    const confirmed = window.confirm(
      `¿Eliminar esta ${labels[editing.kind]}?\n\n${consequence}`,
    );

    if (!confirmed) return;

    switch (editing.kind) {
      case 'deal':
        crm.removeDeal(id);
        break;

      case 'contact':
        crm.removeContact(id);
        break;

      case 'company':
        crm.removeCompany(id);
        break;

      case 'task':
        crm.removeTask(id);
        break;
    }

    onClose();
  };

  // ==================================================
  // INTERFAZ
  // ==================================================

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget
        ) {
          requestClose();
        }
      }}
    >
      <section
        ref={modalRef}
        className="editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-heading"
      >
        <header className="modal-head">
          <div>
            <span className="modal-eyebrow">
              CENTRO DE TRABAJO
            </span>

            <h2 id="modal-heading">
              {editing.value ? 'Editar' : 'Nueva'}{' '}
              {labels[editing.kind]}
            </h2>

            <p>
              Completá los datos y presioná Guardar.
              Los cambios se conservarán en este navegador.
            </p>
          </div>

          <button
            type="button"
            className="icon-btn"
            title="Cerrar"
            aria-label="Cerrar formulario"
            onClick={requestClose}
          >
            <X size={19} />
          </button>
        </header>

        <form
          onSubmit={save}
          className="modal-form"
        >
          {/* ========================================
              OPORTUNIDAD
          ======================================== */}

          {editing.kind === 'deal' && (
            <>
              <div className="form-field full">
                <label htmlFor="deal-title">
                  Nombre de la oportunidad *
                </label>

                <input
                  id="deal-title"
                  autoFocus
                  required
                  maxLength={110}
                  value={(form as Deal).title}
                  onChange={(event) =>
                    setField('title', event.target.value)
                  }
                  placeholder="Ej. Implementación de CRM"
                />
              </div>

              <div className="form-field">
                <label htmlFor="deal-company">
                  Empresa
                </label>

                <select
                  id="deal-company"
                  value={(form as Deal).companyId}
                  onChange={(event) => {
                    setError('');

                    setForm((current) => ({
                      ...current,
                      companyId: event.target.value,
                      contactId: '',
                    }));
                  }}
                >
                  <option value="">
                    Sin empresa
                  </option>

                  {data.companies.map((company) => (
                    <option
                      key={company.id}
                      value={company.id}
                    >
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="deal-contact">
                  Contacto
                </label>

                <select
                  id="deal-contact"
                  value={(form as Deal).contactId}
                  onChange={(event) =>
                    setField(
                      'contactId',
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Sin contacto
                  </option>

                  {data.contacts
                    .filter(
                      (contact) =>
                        !(form as Deal).companyId ||
                        contact.companyId ===
                          (form as Deal).companyId,
                    )
                    .map((contact) => (
                      <option
                        key={contact.id}
                        value={contact.id}
                      >
                        {contact.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="deal-amount">
                  Importe ({data.settings.currency}) *
                </label>

                <input
                  id="deal-amount"
                  type="number"
                  min={0}
                  step="1"
                  required
                  value={(form as Deal).amount}
                  onChange={(event) =>
                    setField(
                      'amount',
                      Number(event.target.value),
                    )
                  }
                />
              </div>

              <div className="form-field">
                <label htmlFor="deal-stage">
                  Etapa
                </label>

                <select
                  id="deal-stage"
                  value={(form as Deal).stage}
                  onChange={(event) => {
                    const stage = event.target
                      .value as Stage;

                    setError('');

                    setForm((current) => ({
                      ...current,
                      stage,
                      probability:
                        STAGES.find(
                          (item) =>
                            item.id === stage,
                        )?.probability ?? 15,
                    }));
                  }}
                >
                  {STAGES.map((stage) => (
                    <option
                      key={stage.id}
                      value={stage.id}
                    >
                      {stage.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="deal-probability">
                  Probabilidad (%)
                </label>

                <input
                  id="deal-probability"
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={(form as Deal).probability}
                  onChange={(event) =>
                    setField(
                      'probability',
                      Number(event.target.value),
                    )
                  }
                />
              </div>

              <div className="form-field">
                <label htmlFor="deal-date">
                  Fecha estimada de cierre
                </label>

                <input
                  id="deal-date"
                  type="date"
                  value={(form as Deal).dueDate}
                  onChange={(event) =>
                    setField(
                      'dueDate',
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="form-field full">
                <label htmlFor="deal-owner">
                  Responsable *
                </label>

                <input
                  id="deal-owner"
                  required
                  maxLength={90}
                  value={(form as Deal).owner}
                  onChange={(event) =>
                    setField(
                      'owner',
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="form-field full">
                <label htmlFor="deal-notes">
                  Notas y próximos pasos
                </label>

                <textarea
                  id="deal-notes"
                  rows={4}
                  maxLength={2500}
                  value={(form as Deal).notes}
                  onChange={(event) =>
                    setField(
                      'notes',
                      event.target.value,
                    )
                  }
                  placeholder="Contexto, objeciones, próximos pasos…"
                />
              </div>
            </>
          )}

          {/* ========================================
              CONTACTO
          ======================================== */}

          {editing.kind === 'contact' && (
            <>
              <div className="form-field full">
                <label htmlFor="contact-name">
                  Nombre y apellido *
                </label>

                <input
                  id="contact-name"
                  autoFocus
                  required
                  maxLength={100}
                  value={(form as Contact).name}
                  onChange={(event) =>
                    setField(
                      'name',
                      event.target.value,
                    )
                  }
                  placeholder="Ej. Ana López"
                />
              </div>

              <div className="form-field">
                <label htmlFor="contact-email">
                  Correo electrónico
                </label>

                <input
                  id="contact-email"
                  type="email"
                  value={(form as Contact).email}
                  onChange={(event) =>
                    setField(
                      'email',
                      event.target.value,
                    )
                  }
                  placeholder="ana@empresa.com"
                />
              </div>

              <div className="form-field">
                <label htmlFor="contact-phone">
                  Teléfono
                </label>

                <input
                  id="contact-phone"
                  type="tel"
                  value={(form as Contact).phone}
                  onChange={(event) =>
                    setField(
                      'phone',
                      event.target.value,
                    )
                  }
                  placeholder="+54 341 ..."
                />
              </div>

              <div className="form-field">
                <label htmlFor="contact-company">
                  Empresa
                </label>

                <select
                  id="contact-company"
                  value={(form as Contact).companyId}
                  onChange={(event) =>
                    setField(
                      'companyId',
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Sin empresa
                  </option>

                  {data.companies.map((company) => (
                    <option
                      key={company.id}
                      value={company.id}
                    >
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="contact-role">
                  Cargo
                </label>

                <input
                  id="contact-role"
                  value={(form as Contact).role}
                  onChange={(event) =>
                    setField(
                      'role',
                      event.target.value,
                    )
                  }
                  placeholder="Ej. Gerente de ventas"
                />
              </div>

              <div className="form-field">
                <label htmlFor="contact-status">
                  Estado
                </label>

                <select
                  id="contact-status"
                  value={(form as Contact).status}
                  onChange={(event) =>
                    setField(
                      'status',
                      event.target.value,
                    )
                  }
                >
                  <option value="nuevo">
                    Nuevo
                  </option>

                  <option value="contactado">
                    Contactado
                  </option>

                  <option value="calificado">
                    Calificado
                  </option>
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="contact-source">
                  Origen
                </label>

                <select
                  id="contact-source"
                  value={(form as Contact).source}
                  onChange={(event) =>
                    setField(
                      'source',
                      event.target.value,
                    )
                  }
                >
                  {[
                    'Manual',
                    'Sitio web',
                    'Referido',
                    'LinkedIn',
                    'WhatsApp',
                    'Evento',
                    'Otro',
                  ].map((source) => (
                    <option key={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field full">
                <label htmlFor="contact-notes">
                  Notas
                </label>

                <textarea
                  id="contact-notes"
                  rows={4}
                  value={(form as Contact).notes}
                  onChange={(event) =>
                    setField(
                      'notes',
                      event.target.value,
                    )
                  }
                />
              </div>
            </>
          )}

          {/* ========================================
              EMPRESA
          ======================================== */}

          {editing.kind === 'company' && (
            <>
              <div className="form-field full">
                <label htmlFor="company-name">
                  Razón social / nombre *
                </label>

                <input
                  id="company-name"
                  autoFocus
                  required
                  maxLength={110}
                  value={(form as Company).name}
                  onChange={(event) =>
                    setField(
                      'name',
                      event.target.value,
                    )
                  }
                  placeholder="Ej. Estudio Norte"
                />
              </div>

              <div className="form-field">
                <label htmlFor="company-industry">
                  Industria
                </label>

                <input
                  id="company-industry"
                  value={(form as Company).industry}
                  onChange={(event) =>
                    setField(
                      'industry',
                      event.target.value,
                    )
                  }
                  placeholder="Tecnología, comercio…"
                />
              </div>

              <div className="form-field">
                <label htmlFor="company-size">
                  Tamaño del equipo
                </label>

                <select
                  id="company-size"
                  value={(form as Company).employees}
                  onChange={(event) =>
                    setField(
                      'employees',
                      event.target.value,
                    )
                  }
                >
                  {[
                    '1-10',
                    '11-50',
                    '51-200',
                    '201-500',
                    '500+',
                  ].map((size) => (
                    <option key={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="company-location">
                  Ubicación
                </label>

                <input
                  id="company-location"
                  value={(form as Company).location}
                  onChange={(event) =>
                    setField(
                      'location',
                      event.target.value,
                    )
                  }
                  placeholder="Rosario, Argentina"
                />
              </div>

              <div className="form-field">
                <label htmlFor="company-website">
                  Sitio web
                </label>

                <input
                  id="company-website"
                  value={(form as Company).website}
                  onChange={(event) =>
                    setField(
                      'website',
                      event.target.value,
                    )
                  }
                  placeholder="ejemplo.com"
                />
              </div>
            </>
          )}

          {/* ========================================
              TAREA
          ======================================== */}

          {editing.kind === 'task' && (
            <>
              <div className="form-field full">
                <label htmlFor="task-title">
                  Título de la tarea *
                </label>

                <input
                  id="task-title"
                  autoFocus
                  required
                  maxLength={150}
                  value={(form as Task).title}
                  onChange={(event) =>
                    setField(
                      'title',
                      event.target.value,
                    )
                  }
                  placeholder="Ej. Llamar al cliente"
                />
              </div>

              <div className="form-field">
                <label htmlFor="task-date">
                  Fecha de vencimiento *
                </label>

                <input
                  id="task-date"
                  type="date"
                  required
                  value={(form as Task).dueDate}
                  onChange={(event) =>
                    setField(
                      'dueDate',
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="form-field">
                <label htmlFor="task-priority">
                  Prioridad
                </label>

                <select
                  id="task-priority"
                  value={(form as Task).priority}
                  onChange={(event) =>
                    setField(
                      'priority',
                      event.target.value,
                    )
                  }
                >
                  <option value="alta">
                    Alta
                  </option>

                  <option value="media">
                    Media
                  </option>

                  <option value="baja">
                    Baja
                  </option>
                </select>
              </div>

              <div className="form-field full">
                <label htmlFor="task-deal">
                  Oportunidad vinculada
                </label>

                <select
                  id="task-deal"
                  value={(form as Task).dealId}
                  onChange={(event) =>
                    setField(
                      'dealId',
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Sin vincular
                  </option>

                  {data.deals.map((deal) => (
                    <option
                      key={deal.id}
                      value={deal.id}
                    >
                      {deal.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field full">
                <label htmlFor="task-description">
                  Descripción
                </label>

                <textarea
                  id="task-description"
                  rows={4}
                  value={(form as Task).description}
                  onChange={(event) =>
                    setField(
                      'description',
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="form-field full">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={(form as Task).done}
                    onChange={(event) =>
                      setField(
                        'done',
                        event.target.checked,
                      )
                    }
                  />

                  Marcar como completada
                </label>
              </div>
            </>
          )}

          {/* ========================================
              ERRORES Y ACCIONES
          ======================================== */}

          {error && (
            <div
              className="form-error"
              role="alert"
            >
              <Info size={15} />
              {error}
            </div>
          )}

          <footer className="modal-footer">
            {editing.value && (
              <button
                type="button"
                className="btn btn-danger-subtle"
                onClick={remove}
              >
                <Trash2 size={15} />
                Eliminar
              </button>
            )}

            <span className="modal-spacer" />

            <button
              type="button"
              className="btn btn-ghost"
              onClick={requestClose}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn btn-primary"
            >
              <Check size={16} />
              Guardar {labels[editing.kind]}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
