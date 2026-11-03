
# NEXO CRM

### Plataforma de gestión comercial y colaboración empresarial

**NEXO CRM** es una aplicación web de gestión comercial desarrollada con React, TypeScript y Supabase, diseñada para centralizar clientes, contactos, oportunidades de venta, tareas y actividades de un equipo.

Integra herramientas de seguimiento comercial, colaboración multiusuario, mensajería interna, calendario, notificaciones y reportes, mediante una interfaz moderna, responsive e intuitiva.

El proyecto también dispone de una **demostración pública interactiva**, que permite explorar sus funcionalidades utilizando datos ficticios, sin necesidad de crear una cuenta.

---

## Demo y repositorio

**Aplicación:** https://nexo-crm-oficial.vercel.app

**Demostración pública:** https://nexo-crm-oficial.vercel.app/?demo=1

**Código fuente:** https://github.com/CamiloVenesia/nexo-crm

La demostración permite conocer el funcionamiento del CRM sin acceder a los datos de usuarios reales.

---

## Funcionalidades principales

### 1. Dashboard comercial

Panel de control que centraliza los principales indicadores del negocio.

- Resumen de oportunidades comerciales.
- Indicadores de rendimiento.
- Visualización del pipeline.
- Proyección de ingresos.
- Seguimiento de actividades.
- Identificación de tareas y vencimientos.
- Gráficos e indicadores actualizados según los registros.

### 2. Gestión de clientes y contactos

Herramientas para organizar la información comercial.

- Registro y edición de empresas.
- Gestión de contactos asociados.
- Información de contacto y datos empresariales.
- Búsqueda y filtrado de registros.
- Vinculación entre clientes, contactos y oportunidades.
- Exportación de información comercial.

### 3. Pipeline de oportunidades

Sistema visual para administrar el proceso de ventas.

- Tablero Kanban.
- Visualización de oportunidades por etapa.
- Creación y edición de negocios.
- Seguimiento de importes y probabilidades.
- Fechas previstas de cierre.
- Asociación con empresas y contactos.
- Identificación de oportunidades ganadas y perdidas.

### 4. Gestión de tareas

Organización y seguimiento de actividades pendientes.

- Creación y edición de tareas.
- Asignación de prioridades.
- Fechas de vencimiento.
- Vinculación con oportunidades.
- Seguimiento de tareas pendientes y completadas.
- Recordatorios de vencimientos próximos.

### 5. Calendario comercial

Calendario integrado para organizar el trabajo.

- Creación y gestión de eventos.
- Reuniones y actividades comerciales.
- Visualización de fechas importantes.
- Integración con tareas y oportunidades.
- Registro de actividades por organización.

### 6. Mensajería interna

Sistema de comunicación entre integrantes del equipo.

- Conversaciones privadas.
- Envío y recepción de mensajes.
- Actualización en tiempo real.
- Historial de conversaciones.
- Identificación de participantes.
- Control de acceso según la organización.

### 7. Centro de notificaciones

Sistema de avisos integrado en la aplicación.

- Notificaciones de nuevos mensajes.
- Avisos de actividad del equipo.
- Notificaciones del calendario.
- Recordatorios de tareas y cierres comerciales.
- Contador de notificaciones pendientes.
- Marcado individual y general de lectura.
- Persistencia del estado de lectura.

### 8. Historial de actividades

Registro de operaciones realizadas dentro del CRM.

- Trazabilidad de movimientos.
- Identificación del usuario responsable.
- Organización cronológica.
- Filtros por tipo, usuario y período.
- Búsqueda de actividades.
- Exportación CSV.

### 9. Reportes comerciales

Herramientas para analizar la información del negocio.

- Indicadores comerciales.
- Análisis de oportunidades.
- Distribución de negocios por etapa.
- Proyecciones basadas en los datos registrados.
- Visualización de métricas y tendencias.

### 10. Configuración y moneda

Personalización de la organización y sus preferencias.

- Configuración del espacio de trabajo.
- Preferencias de moneda.
- Visualización de importes en ARS y USD.
- Conversión monetaria para reportes y operaciones.
- Gestión de integrantes y permisos.
- Exportación de respaldos.

---

## Sistema multiusuario

NEXO CRM utiliza Supabase Authentication y PostgreSQL para gestionar la autenticación y la información de las organizaciones.

### Administrador

Puede gestionar la organización y administrar sus integrantes, permisos y registros comerciales según las reglas establecidas.

### Miembro

Puede consultar y trabajar con la información comercial de su organización, respetando los permisos definidos.

La aplicación utiliza políticas de **Row Level Security (RLS)** para controlar el acceso a los registros desde la base de datos.

Las funciones privilegiadas se gestionan mediante procedimientos SQL con verificaciones de autorización.

---

## Modo Demo público

NEXO incluye una demostración interactiva para visitantes.

**Acceso:**

https://nexo-crm-oficial.vercel.app/?demo=1

### Características

- Acceso sin registro ni contraseña.
- Empresas y contactos ficticios.
- Oportunidades comerciales de ejemplo.
- Dashboard con información simulada.
- Creación y modificación de registros de prueba.
- Calendario de demostración.
- Mensajería ficticia interactiva.
- Conversaciones y mensajes precargados.
- Envío local de mensajes simulados.
- Reinicio de los datos de demostración.
- Acceso independiente de las cuentas reales.

Los datos de la demostración se mantienen en el navegador y no se utilizan para modificar los registros comerciales reales.

La mensajería Demo es una simulación local: no envía mensajes a usuarios reales ni realiza comunicaciones externas.

---

## Tecnologías utilizadas

| Tecnología | Utilización |
|------------|-------------|
| React 19 | Interfaz y componentes |
| TypeScript | Tipado y lógica de la aplicación |
| Vite 7 | Desarrollo y compilación |
| Supabase | Backend administrado |
| PostgreSQL | Base de datos relacional |
| Supabase Auth | Autenticación de usuarios |
| Supabase Realtime | Actualizaciones en tiempo real |
| Row Level Security | Control de acceso a los datos |
| Lucide React | Iconografía |
| CSS | Diseño visual y responsive |
| Vitest | Pruebas automatizadas |
| Git y GitHub | Control de versiones |
| Vercel | Hosting y despliegue |

---

## Arquitectura del proyecto

NEXO utiliza una arquitectura frontend React conectada directamente a los servicios administrados de Supabase.

```text
NEXO CRM
|
+-- Frontend
|   +-- React
|   +-- TypeScript
|   +-- Vite
|   +-- Componentes reutilizables
|   +-- Vistas comerciales
|   +-- Estado de la aplicación
|
+-- Backend administrado
|   +-- Supabase Authentication
|   +-- PostgreSQL
|   +-- Row Level Security
|   +-- Funciones SQL / RPC
|   +-- Realtime
|
+-- Modo Demo
|   +-- Datos ficticios
|   +-- Persistencia local temporal
|   +-- Mensajería simulada
|
+-- Infraestructura
    +-- GitHub
    +-- Vercel
    +-- HTTPS
```

La lógica de acceso a datos comerciales se complementa con controles de autorización implementados en PostgreSQL.

---

## Estructura del código

```text
NEXO-CRM/
|
+-- src/
|   |
|   +-- components/
|   |   +-- AuthGate.tsx
|   |   +-- DemoPortal.tsx
|   |   +-- DemoMessages (vista en views)
|   |   +-- NotificationCenter.tsx
|   |   +-- AppErrorBoundary.tsx
|   |   +-- EditorModal.tsx
|   |
|   +-- lib/
|   |   +-- store.tsx
|   |   +-- supabase.ts
|   |   +-- persistence.ts
|   |   +-- seed.ts
|   |   +-- Lógica comercial
|   |   +-- Pruebas automatizadas
|   |
|   +-- views/
|   |   +-- Dashboard.tsx
|   |   +-- Companies.tsx
|   |   +-- Contacts.tsx
|   |   +-- Deals.tsx
|   |   +-- Tasks.tsx
|   |   +-- Calendar.tsx
|   |   +-- Messages.tsx
|   |   +-- DemoMessages.tsx
|   |   +-- Activity.tsx
|   |   +-- Insights.tsx
|   |   +-- Settings.tsx
|   |
|   +-- App.tsx
|   +-- main.tsx
|
+-- supabase/
|   +-- 001_auth_teams.sql
|   +-- 002_commercial.sql
|   +-- 003_team_security.sql
|   +-- 004_organization_currency.sql
|   +-- 005_calendar_events.sql
|   +-- 006_internal_messaging.sql
|   +-- 007_notifications.sql
|   +-- 008_performance_indexes.sql
|
+-- package.json
+-- vite.config.ts
+-- README.md
```

---

## Instalación local

### Requisitos

- Node.js compatible con Vite 7 (20.19+ o 22.12+).
- npm.
- Git.
- Una instancia de Supabase para utilizar las funciones autenticadas.

### 1. Clonar el repositorio

```bash
git clone https://github.com/CamiloVenesia/nexo-crm.git
cd nexo-crm
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crear un archivo `.env.local` en la raíz del proyecto.

```env
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA
```

Las credenciales públicas deben obtenerse desde el proyecto Supabase correspondiente.

No colocar claves `service_role`, claves secretas ni contraseñas privadas en variables `VITE_`.

Para una instancia nueva, aplicar las migraciones SQL de la carpeta `supabase/` en el orden correspondiente y configurar Supabase Authentication.

### 4. Iniciar el servidor

```bash
npm run dev
```

Abrir:

http://localhost:5173

Para ingresar directamente a la demostración:

http://localhost:5173/?demo=1

---

## Comandos disponibles

| Comando | Función |
|---------|---------|
| `npm run dev` | Iniciar servidor de desarrollo |
| `npm run build` | Compilar la aplicación |
| `npm run preview` | Previsualizar compilación |
| `npm run check` | Comprobar TypeScript |
| `npm test` | Ejecutar pruebas automatizadas |
| `npm audit` | Auditar dependencias |

---

## Rendimiento y estabilidad

Se implementaron mejoras de rendimiento y recuperación de errores.

- Separación de dependencias JavaScript.
- Carga diferida de pantallas mediante React.lazy.
- Optimización de índices PostgreSQL.
- Consultas comerciales paralelas.
- Control de errores de interfaz.
- Recuperación ante fallos de componentes.
- Avisos de pérdida de conexión.
- Manejo de estados de carga.
- Pruebas automatizadas de lógica comercial.

En la última validación local reportada:

- 116 pruebas automatizadas aprobadas.
- Compilación de producción correcta.
- 0 vulnerabilidades detectadas por npm audit.

Estas verificaciones no sustituyen una auditoría integral de seguridad o pruebas de carga.

---

## Seguridad y consideraciones de producción

El proyecto incluye medidas de seguridad como autenticación, políticas RLS, permisos por organización y funciones de base de datos con controles de autorización.

Antes de utilizarlo como servicio comercial con información sensible, todavía corresponde completar:

- Pruebas de aislamiento entre múltiples organizaciones.
- Auditoría integral de funciones privilegiadas.
- Revisión de autorizaciones y validación de datos.
- Política de respaldos y restauración.
- Monitoreo, observabilidad y respuesta ante incidentes.
- Revisión de límites de uso y protección contra abuso.
- Pruebas de carga y validación completa del despliegue.

La demostración pública utiliza información ficticia y está orientada a la evaluación funcional del proyecto.

---

## Despliegue

La aplicación está alojada en Vercel y utiliza un repositorio GitHub como fuente de despliegue.

Los cambios enviados a la rama principal pueden generar nuevas versiones de la aplicación mediante el proceso de despliegue automático.

**Producción:** https://nexo-crm-oficial.vercel.app

**Demo:** https://nexo-crm-oficial.vercel.app/?demo=1

---

## Objetivo del proyecto

NEXO CRM fue desarrollado como un proyecto de aplicación web integral, combinando desarrollo frontend, integración de backend, modelado de datos, autenticación, colaboración multiusuario, lógica comercial y despliegue en la nube.

Su propósito es demostrar la implementación de una solución de gestión empresarial funcional, desde la interfaz y los procesos comerciales hasta la persistencia de datos, el control de permisos y la publicación web.

---

## Autor

**Camilo Venesia**

Desarrollo de software y aplicaciones web.

GitHub: https://github.com/CamiloVenesia

---

**NEXO CRM — Gestión comercial, organización y colaboración en un solo lugar.**
