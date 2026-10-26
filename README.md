# NEXO CRM — Plataforma comercial (demo interactiva)

Una aplicación de portfolio con una experiencia visual premium inspirada en el diseño de referencia compartido por el autor. Incluye un **CRM funcional en el navegador** para gestionar oportunidades, contactos, empresas y tareas.

## Ejecutar en Windows / VS Code

**Requisitos:** Node.js 20.19+ o 22.12+ y npm.

```powershell
cd NEXO-CRM
npm install
npm run dev
```

Abrí la URL indicada por Vite (normalmente `http://localhost:5173`). **Alternativa rápida en Windows:** doble clic en `INICIAR_NEXO.bat`; en la primera ejecución instala las dependencias.

Otros comandos:

```powershell
npm run check   # comprueba TypeScript
npm run test    # pruebas de lógica comercial
npm run build   # genera dist/ para despliegue estático
npm run preview # previsualiza la compilación
```

## Qué funciona

- **Dashboard:** cuatro indicadores, pipeline, proyección de ingresos, radar de seguimientos y tareas próximas. Los datos se recalculan al editar registros.
- **Oportunidades:** tablero Kanban arrastrable, vista tabla, búsqueda, filtro de cerradas, alta/edición/eliminación y cambio de etapa accesible por desplegable, exportación CSV.
- **Contactos:** CRUD, vinculación a empresas, control de correos duplicados, búsqueda, filtros, CSV.
- **Empresas:** CRUD, indicadores de contactos y oportunidades asociadas, búsqueda. Protege la eliminación de empresas vinculadas.
- **Tareas:** alta/edición/eliminación, prioridades, vinculación con oportunidades, fechas, completar/descompletar, listas filtradas.
- **Actividad:** historial de operaciones realizadas en esta demo.
- **Insights:** proyecciones, oportunidades por etapa, tasa de cierre, reglas transparentes para detectar vencimientos.
- **Búsqueda global:** contactos, oportunidades, empresas y tareas. Atajo `Ctrl+K` / `⌘+K`.
- **Configuración:** nombre del workspace y moneda, respaldo JSON, restauración validada y reinicio de los datos de ejemplo.
- **Responsive:** escritorio, tablet y celular, incluyendo `prefers-reduced-motion`.

Los contactos, empresas e importes son ficticios. El dominio `.example` señala datos de prueba. Los indicadores no son datos reales.

## Aviso importante: demo, no SaaS de producción

Esta primera entrega usa **React 19 + TypeScript + Vite + gráficos SVG propios + Lucide** y almacena los datos en `localStorage`, solo en el navegador y dispositivo actual. Es intencional: se puede probar apenas se descomprime, sin base de datos ni secretos. **No uses información privada de clientes reales** en la demo.

Todavía no incluye: backend, PostgreSQL, usuarios, control de acceso y aislamiento entre empresas, sincronización en tiempo real, recuperación de contraseña, emails, WhatsApp, pagos, IA real, auditoría o backups automáticos. Las secciones de insights son cálculos locales y reglas: no se presentan como predicciones de IA.

### Próximas fases sugeridas

1. **API & Postgres:** Node/Express o Next.js API, PostgreSQL, migraciones y pruebas de integración.
2. **Autenticación & multiempresa:** cuentas, roles, `organization_id` obligatorio en entidades, permisos en backend y auditoría.
3. **Funcionalidad comercial:** cotizaciones PDF, adjuntos, automatizaciones, notificaciones y plantillas.
4. **IA opcional:** resumir historial y sugerir pasos mediante API exclusivamente en servidor; permisos, costos y límites.
5. **Producción:** backups, monitoreo, rate limits, protección CSRF cuando aplique, seguridad de cookies, logs sin secretos, términos y privacidad.

## Código

- `src/types.ts` — entidades y etapas.
- `src/lib/seed.ts` — datos de prueba.
- `src/lib/store.tsx` — estado y persistencia local.
- `src/lib/utils.ts` — cálculos, fechas, exportaciones y validaciones.
- `src/views/` — pantallas principales.
- `src/components/` — componentes compartidos, gráficos, formularios.
- `src/styles.css` — sistema visual y responsive.

## Créditos

Diseño implementado de manera original, tomando como referencia visual el estilo de dashboard facilitado en la conversación. No incorpora ni reproduce código ni assets del producto de la imagen. Inspiración de UX de flujos CRM revisados en Pipedrive y HubSpot:

- https://support.pipedrive.com/en/article/how-can-i-customize-my-pipeline-stages
- https://www.pipedrive.com/en/crm/setup/ways-to-foster-crm-adoption
- https://blog.hubspot.com/sales/the-ultimate-first-time-crm-buyers-guide
