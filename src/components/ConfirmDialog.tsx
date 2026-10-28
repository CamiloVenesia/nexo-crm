
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

import './confirm-dialog.css';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'danger' | 'warning';
}

/**
 * Diálogo accesible de NEXO CRM.
 * El navegador gestiona el foco mediante el elemento dialog.
 * Escape cancela; nunca confirma acciones destructivas.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  tone = 'danger',
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.showModal();

    return () => {
      if (dialog.open) dialog.close();
      previousFocus?.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`nexo-confirm nexo-confirm--${tone}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="nexo-confirm__top">
        <div className="nexo-confirm__icon" aria-hidden="true">
          <AlertTriangle size={19} />
        </div>

        <button
          className="nexo-confirm__close"
          type="button"
          aria-label="Cancelar y cerrar confirmación"
          onClick={onCancel}
        >
          <X size={18} />
        </button>
      </div>

      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{description}</p>

      <div className="nexo-confirm__actions">
        <button
          type="button"
          className="btn btn-outline"
          autoFocus
          onClick={onCancel}
        >
          Conservar y volver
        </button>

        <button
          type="button"
          className={
            tone === 'danger'
              ? 'btn btn-danger-subtle'
              : 'btn btn-primary'
          }
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
