
import { useEffect, useState } from 'react';

import {
  ArrowRight,
  FlaskConical,
  LogOut,
  RotateCcw,
} from 'lucide-react';

import App from '../App';
import { AuthGate } from './AuthGate';
import { DEMO_STORAGE_KEY } from '../lib/persistence';

import './demo-portal.css';

const DEMO_SESSION_MARKER =
  'nexo-public-demo-session-active-v1';

const DEMO_CALENDAR_KEY =
  'nexo-calendar-events:demo';

function isDemoRoute(): boolean {
  return (
    new URLSearchParams(
      window.location.search,
    ).get('demo') === '1'
  );
}

function getDemoUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set('demo', '1');

  return url.pathname + url.search + url.hash;
}

function getNormalUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete('demo');

  return url.pathname + url.search + url.hash;
}

function clearDemoData(): void {
  try {
    window.sessionStorage.removeItem(
      DEMO_STORAGE_KEY,
    );

    window.sessionStorage.removeItem(
      DEMO_SESSION_MARKER,
    );

    window.localStorage.removeItem(
      DEMO_CALENDAR_KEY,
    );
  } catch {
    // Si el navegador bloquea el almacenamiento,
    // igualmente permitimos salir o reiniciar.
  }
}

export function DemoPortal() {
  const demo = isDemoRoute();

  const [ready, setReady] = useState(
    !demo,
  );

  // ==========================================
  // PREPARAR UN ENTORNO AISLADO
  // ==========================================

  useEffect(() => {
    if (!demo) return;

    try {
      const active = window.sessionStorage.getItem(
        DEMO_SESSION_MARKER,
      );

      if (active !== '1') {
        // Una nueva sesión no debe recuperar
        // eventos de una demo anterior.

        window.localStorage.removeItem(
          DEMO_CALENDAR_KEY,
        );

        window.sessionStorage.setItem(
          DEMO_SESSION_MARKER,
          '1',
        );
      }
    } catch {
      // La demo podrá usarse aun si el navegador
      // no permite guardar datos temporalmente.
    }

    setReady(true);
  }, [demo]);

  function resetDemo() {
    clearDemoData();
    window.location.reload();
  }

  function leaveDemo() {
    clearDemoData();
    window.location.assign(getNormalUrl());
  }

  // ==========================================
  // MODO DEMOSTRACIÓN
  // ==========================================

  if (demo) {
    if (!ready) {
      return (
        <main className="nexo-demo-loading">
          Preparando demostración...
        </main>
      );
    }

    return (
      <div className="nexo-public-demo">
        {/*
          App se renderiza sin WorkspaceProvider.

          De esta manera CRMProvider utiliza
          los datos locales de demostración
          y no carga una organización de Supabase.
        */}

        <App />

        <div
          className="nexo-demo-banner"
          role="region"
          aria-label="Modo de demostración"
        >
          <div className="nexo-demo-banner-info">
            <span className="nexo-demo-banner-icon">
              <FlaskConical size={18} />
            </span>

            <span className="nexo-demo-banner-text">
              <strong>Modo Demo</strong>
              <small>
                Datos ficticios · Sin cuenta
              </small>
            </span>
          </div>

          <div className="nexo-demo-banner-actions">
            <button
              type="button"
              className="nexo-demo-reset"
              onClick={resetDemo}
              title="Restaurar los datos de ejemplo"
            >
              <RotateCcw size={15} />
              <span>Reiniciar</span>
            </button>

            <button
              type="button"
              className="nexo-demo-exit"
              onClick={leaveDemo}
            >
              <LogOut size={15} />
              <span>Salir de la demo</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // ACCESO NORMAL: ADMINISTRADOR Y MIEMBRO
  // ==========================================

  return (
    <div className="nexo-demo-router">
      <AuthGate />

      {/*
        El botón se muestra únicamente cuando
        AuthGate presenta una pantalla de acceso.
        Las sesiones autenticadas no lo muestran.
      */}

      <div className="nexo-demo-entry">
        <div className="nexo-demo-entry-copy">
          <FlaskConical size={18} />

          <span>
            <strong>¿Querés conocer NEXO?</strong>
            <small>
              Explorá todas sus funciones sin registrarte.
            </small>
          </span>
        </div>

        <a
          href={getDemoUrl()}
          className="nexo-demo-entry-button"
        >
          Probar NEXO
          <ArrowRight size={15} />
        </a>
      </div>
    </div>
  );
}
