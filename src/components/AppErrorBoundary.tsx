
import {
  Component,
  Fragment,
  useEffect,
  useState,
} from 'react';

import type {
  ErrorInfo,
  ReactNode,
} from 'react';

import {
  AlertTriangle,
  RefreshCw,
  WifiOff,
} from 'lucide-react';

import './app-error-boundary.css';

interface BoundaryProps {
  children: ReactNode;
}

interface BoundaryState {
  hasError: boolean;
  failedChunk: boolean;
  retryCount: number;
}

function isChunkLoadError(error: Error): boolean {
  const text = `${error.name} ${error.message}`;

  return /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading chunk.*failed|error loading dynamically imported module/i.test(
    text,
  );
}

export class AppErrorBoundary extends Component<
  BoundaryProps,
  BoundaryState
> {
  state: BoundaryState = {
    hasError: false,
    failedChunk: false,
    retryCount: 0,
  };

  static getDerivedStateFromError(
    error: Error,
  ): Partial<BoundaryState> {
    return {
      hasError: true,
      failedChunk: isChunkLoadError(error),
    };
  }

  componentDidCatch(
    error: Error,
    info: ErrorInfo,
  ) {
    // Los detalles se muestran solo en desarrollo.
    // No se envían datos a servicios externos.

    if (import.meta.env.DEV) {
      console.error(
        'NEXO: error de interfaz',
        error,
        info.componentStack,
      );
    }
  }

  private retry = () => {
    this.setState((previous) => ({
      hasError: false,
      failedChunk: false,
      retryCount: previous.retryCount + 1,
    }));
  };

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="nexo-error-page">
          <section
            className="nexo-error-card"
            role="alert"
          >
            <span
              className="nexo-error-icon"
              aria-hidden="true"
            >
              <AlertTriangle size={24} />
            </span>

            <span className="nexo-error-eyebrow">
              NEXO CRM
            </span>

            <h1>
              No se pudo mostrar la aplicación
            </h1>

            <p>
              {this.state.failedChunk
                ? 'No se pudo cargar una parte de NEXO. Esto puede ocurrir después de una actualización o por un problema de conexión.'
                : 'Ocurrió un error inesperado en la interfaz. Podés volver a intentarlo sin borrar tus registros.'}
            </p>

            <div className="nexo-error-actions">
              {!this.state.failedChunk && (
                <button
                  className="nexo-error-secondary"
                  type="button"
                  onClick={this.retry}
                >
                  Volver a intentar
                </button>
              )}

              <button
                className="nexo-error-primary"
                type="button"
                onClick={this.reload}
              >
                <RefreshCw size={16} />
                Recargar NEXO
              </button>
            </div>

            <small>
              Si el problema continúa, comprobá
              tu conexión e informá el error
              al administrador.
            </small>
          </section>
        </main>
      );
    }

    // Remontar la interfaz después de un
    // reintento solicitado por el usuario.

    return (
      <Fragment key={this.state.retryCount}>
        {this.props.children}
      </Fragment>
    );
  }
}

// ===========================================
// AVISO DE DESCONEXIÓN A INTERNET
// ===========================================

export function ConnectionNotice() {
  const [offline, setOffline] = useState(
    () => !navigator.onLine,
  );

  useEffect(() => {
    const updateConnection = () => {
      setOffline(!navigator.onLine);
    };

    window.addEventListener(
      'online',
      updateConnection,
    );

    window.addEventListener(
      'offline',
      updateConnection,
    );

    return () => {
      window.removeEventListener(
        'online',
        updateConnection,
      );

      window.removeEventListener(
        'offline',
        updateConnection,
      );
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="nexo-connection-notice"
      role="status"
      aria-live="polite"
    >
      <WifiOff size={16} aria-hidden="true" />

      Sin conexión a internet.
      Algunos cambios pueden no guardarse.
    </div>
  );
}
