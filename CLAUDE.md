# Frontend — SaaS Médico Multi-tenant (Sakai Vue)

SPA en Vue 3 + Vite, basada en el template admin **Sakai** (PrimeVue 4 + Tailwind). Consume la API del backend Laravel en `/Users/howard/Desktop/backend_inv_cv_laravel` vía Axios.

## Stack

- Vue 3, Vue Router 4, Axios, PrimeVue 4 (`@primeuix/themes`), Tailwind (`tailwindcss-primeui`).
- Sin store centralizado (Pinia/Vuex): el estado de auth se maneja con `localStorage` (token) + composable `src/composables/useAuth.js` y helpers en `src/service/auth.service.js`.

## Estructura relevante

- `src/service/api.js` — instancia de Axios base.
- `src/service/*.service.js` — un servicio por recurso: `auth`, `cita`, `historial`, `patient`, `receta`, `dieta`, `autorizacion`, `licencia`, `usuario`, `tenant`. Espejan los recursos de la API Laravel (`patients`, `citas`, `historial`, `recetas`, `dietas`, `autorizaciones`, `licencias`, `users`, `branding`).
- `src/views/usuarios/Usuarios.vue` — CRUD de usuarios (solo `superadmin`, `admin`).
- `src/views/pacientes/Pacientes.vue` — gestión de pacientes (`superadmin`, `admin`, `secretaria`).
- `src/views/historial/HistorialPaciente.vue` — historial clínico por paciente (solo `superadmin`, `admin`): consultas, recetas, Dieta, Autorización de Procedimientos y Licencia Médica (ver más abajo). Dieta es un documento propio (tabla + diálogo + impresión con membrete), **no** una columna de Consultas — así se pidió explícitamente después de tenerla como columna. Las 5 secciones van en pestañas (`Tabs`/`TabList`/`Tab`/`TabPanels`/`TabPanel` de PrimeVue, una sola visible a la vez) — al apilarlas todas verticalmente con un botón "Nueva..." sólido por sección se sentía "abrumador y cargado a la derecha"; con pestañas + botones `outlined` se resolvió. Hay dos rutas para este mismo componente: `/historial` (sin id, solo el buscador por cédula — a donde lleva el acceso rápido del Dashboard) y `/pacientes/:id/historial` (con paciente cargado). **`patientId` es un `computed` sobre `route.params.id`, no una constante**, con un `watch(patientId, cargarPaciente)`: al buscar desde `/historial`, la navegación a `/pacientes/:id/historial` reutiliza la misma instancia del componente (Vue Router no la remonta porque ambas rutas resuelven al mismo componente) — sin el `watch`, `onMounted` no se vuelve a disparar y la página se queda pegada en el estado vacío aunque la URL sí cambie.
- Mismo patrón en `Dashboard.vue`: el ítem "Nueva cita" del sidebar navega a `/?accion=nueva-cita` (misma ruta `/`, sin id de por medio) para abrir el diálogo automáticamente. Como el cambio es solo de query string sobre la misma ruta, si el usuario ya estaba en el Dashboard Vue Router **no** remonta el componente — por eso, además de revisar el query en `onMounted`, hay un `watch(() => route.query.accion, ...)` que hace lo mismo. Cualquier acceso directo por sidebar/query a una acción de una pantalla que ya pudo estar montada necesita este `watch`, no alcanza con `onMounted` solo.
- `src/views/Dashboard.vue` — incluye citas nuevas e historial clínico (ver commit "dashboard historial clinico citas nuevas"). "Accesos rápidos" (solo `admin`/`superadmin`) tiene un botón "Historial clínico" que lleva a `/historial` (sin id) para buscar un paciente por cédula sin pasar por Pacientes.
- `src/views/pages/auth/{Login,Access,Error}.vue` — login, pantalla de acceso denegado, error genérico.
- `src/layout/*` — layout tipo admin (sidebar, topbar, menú) heredado del template Sakai.

## Branding por tenant

`src/service/tenant.service.js` tiene dos grupos de llamadas: `funObtenerBranding()` (`GET /v1/branding`, propio usuario, solo lectura) para pintar el topbar y el membrete de documentos; y `funObtenerBrandingUsuario/funActualizarBrandingUsuario/funSubirLogoUsuario/funSubirHeaderIconoUsuario` (`/v1/users/{id}/branding...`) para que el **Superadmin** gestione la marca de un médico puntual: nombre, dos colores (principal y secundario), logo, los dos íconos del encabezado (izquierdo/derecho), el párrafo de credenciales (`header_credentials`: especialidad, teléfonos, email, dirección) y el párrafo de apertura de la Licencia Médica (`licencia_declaracion`). `src/composables/useBranding.js` carga el branding efectivo del usuario logueado (incluye todos esos campos) y aplica el color principal con `palette()` + `updatePrimaryPalette()` de `@primeuix/themes`, y el secundario como variable CSS `--brand-secondary` en `document.documentElement` (sin slot propio en el tema de PrimeVue; hoy solo la usa `AppMenuItem.vue` para el indicador del ítem activo del menú, con fallback a `--p-primary-color` si el médico no definió uno). `AppTopbar.vue` muestra el logo/nombre del tenant en vez del SVG/"SAKAI" fijo cuando hay `logo_url`/`brand_name`.

La edición vive en `views/usuarios/Usuarios.vue`: un botón con ícono de paleta (visible solo si `esSuperAdmin && fila.role === 'admin'`) abre un diálogo para editar todo lo anterior. `views/Profile.vue` es de solo lectura (nombre/email/rol) — el médico ya no puede editar su propio branding ahí.

## Impresión con membrete (Recetas, Autorización de Procedimientos y Licencia Médica)

`imprimirReceta()`, `imprimirAutorizacion()` e `imprimirLicencia()` (en `HistorialPaciente.vue`) arman a mano el HTML completo de una ventana nueva (no hay librería de PDF) con el membrete de `useBranding` (íconos a los extremos, nombre + `header_credentials` centrados) y disparan `window.print()`. El título del documento (ej. "RECETA MÉDICA", "LICENCIA MÉDICA") va como texto centrado **debajo** del `<hr>` del membrete y **encima** de la caja de contenido — no dentro de la caja. Las tres comparten los helpers `formatearFechaLegible()` y `calcularEdadDetallada()`. La receta además tiene `formatearHoraLegible()` (hora de `created_at`, no editable) y el símbolo ℞. El historial médico y las recetas "viejas" (antes de este cambio) usan el helper genérico `imprimirDocumento()`, sin membrete.

## Autorización de Procedimientos (`views/historial/HistorialPaciente.vue`)

Documento clínico, en la misma pantalla que Consultas y Recetas. Formulario con 5 campos de texto libre (historia detallada de la enfermedad actual, estudios realizados, tiempo de evolución, tratamiento(s) previo(s), diagnóstico presuntivo) más `ars` — precargado desde `paciente.insurance` al crear, pero **editable por documento** (el ARS de un paciente puede diferir o cambiar). `imprimirAutorizacion()` arma en una ventana nueva el membrete completo más una caja con datos del paciente (nombre, edad calculada con `calcularEdadDetallada()` a partir de `birth_date`, ARS del documento, fecha) y el cuerpo con las 5 secciones.

## Licencia Médica (`views/historial/HistorialPaciente.vue`)

Certificado de reposo. 3 campos de texto libre por documento: `constatado` ("Y constatado"), `recomendacion` ("Por lo que recomiendo"), y `certificacion_cierre` (la línea final "Expido la presente certificación en [ciudad] a partir de hoy día...", que el médico escribe libremente cada vez — no se auto-genera). El párrafo de apertura ("Yo: [médico] ... CERTIFICO, haber examinado a:") viene de `branding.licencia_declaracion`; `imprimirLicencia()` le concatena el nombre y cédula del paciente (`paciente.first_name/last_name/cedula`) más ", TITULAR." fijo. La cédula del propio médico que aparece arriba a la derecha en el documento original de referencia **no se implementa** (decisión explícita del usuario). Estructura impresa: membrete → título → una caja con 4 secciones separadas por líneas horizontales (declaración+paciente, constatado, recomendación, línea de cierre) — las 4 dentro del mismo recuadro.

## Autenticación y control de acceso (`src/router/index.js`)

- Guard global `router.beforeEach`:
  - Si la ruta requiere auth (`meta.requiresAuth`) y no hay `token` en `localStorage` → redirige a `/auth/login`.
  - Si ya hay token y se intenta ir a `/auth/login` → redirige a `/`.
  - Si la ruta define `meta.roles`, usa `hasRole()` de `auth.service.js` para verificar el rol del usuario actual; si no coincide → redirige a `/auth/access`.
- Los roles del dominio son los mismos que en el backend: `superadmin`, `admin` (médico/tenant), `secretaria`.
- Ruta catch-all (`/:pathMatch(.*)*`) redirige a login.

## Sistema de diseño (propuesta visual aplicada)

`src/assets/layout/_tokens.scss` (importado desde `styles.scss`) define los tokens propios: neutros (`--paper`, `--surface-2`, `--ink-muted`, `--line`...), bronce (`--brass`), colores de estado (`--good`, `--warn`, `--critical`, cada uno con su `-soft`), la barra lateral (`--sidebar-bg`, `--sidebar-ink`...) y 3 fuentes (`--font-display`: Manrope; `--font-body`: IBM Plex Sans; `--font-mono`: IBM Plex Mono — instaladas vía `@fontsource/*`, importadas en `main.js`; **no** son las fuentes del sistema usadas en la propuesta visual original en Artifact — ahí se probó con fuentes de macOS por conveniencia, pero para el código real se usaron equivalentes de licencia abierta para poder distribuirlas con la app). Todo integrado con el modo oscuro existente (`:root[class*='app-dark']`, ver `layout.js`), sin tocar el color de acento (`--p-primary-*`), que sigue siendo 100% dinámico por médico.

Utilidades reutilizables: `.font-display`, `.text-tabular` (para cédulas/fechas/números en tablas), `.pill`/`.pill-good`/`.pill-critical`/`.pill-neutral` (estado), `.stat-tile`/`.stat-icon`/`.stat-num` (tarjetas de KPI del Dashboard), `.patient-card` (encabezado del paciente en `HistorialPaciente.vue`). El indicador del ítem activo del menú (`AppMenuItem.vue`) usa `--brand-secondary` (ver sección de Branding) con reserva al color primario.

Aplicado hasta ahora a: shell (sidebar/topbar/tipografía global), Dashboard, Usuarios y HistorialPaciente. El resto de las pantallas (Pacientes, diálogos de citas, etc.) heredan los tokens globales pero no se les aplicó el detalle de componente (pills, stat tiles) todavía.

## Convenciones observadas

- Nombres de vistas/rutas y mensajes de commit en español (Pacientes, Usuarios, Historial, Citas), resto del código en inglés/estilo Vue estándar.
- Los servicios (`*.service.js`) son el único punto de contacto con la API — al agregar un recurso nuevo, seguir ese mismo patrón (un archivo de servicio + vista(s) + entrada de ruta con `meta.roles`).
- Cuando varias `DataTable` se apilan una debajo de otra en la misma pantalla (como en `HistorialPaciente.vue`) y tienen distinto número/ancho de columnas, la columna "Acciones" no queda alineada entre tablas por defecto — se soluciona con `tableStyle="table-layout: fixed; width: 100%"` en el `DataTable` y un ancho fijo igual (`headerStyle`/`bodyStyle`, ej. `width: 8.5rem`) en la columna "Acciones" de **todas** las tablas de esa pantalla.
- Botones de acción en tablas: editar, imprimir y el de marca (paleta) **no** llevan `severity` — así heredan el color del tenant (`--p-primary-*`, dinámico vía `updatePrimaryPalette`) igual que los botones "Nueva...". Eliminar (`severity="danger"`, rojo) y activar (`severity="success"`, verde) sí mantienen su color fijo a propósito — son señales de estado/alerta, no de marca. "Cancelar"/"Cerrar" en diálogos se quedan en `severity="secondary"` (gris neutro), por ser una acción de descarte, no la acción principal.
- Con `table-layout: fixed` (usado para alinear la columna Acciones entre tablas, ver arriba), una palabra larga sin espacios se desborda por encima de la columna vecina en vez de partirse ("letras solapadas") — `_tokens.scss` fuerza `overflow-wrap`/`word-break: break-word` en `.p-datatable :is(th, td)` globalmente para evitarlo.
- **No combinar `FloatLabel` con `:placeholder` en el mismo campo** (`Select`, `Textarea`, etc.): cuando el campo está vacío, la etiqueta flotante y el placeholder se dibujan superpuestos ("letras solapadas"). Si el campo necesita placeholder, usar una `<label>` fija por fuera de `FloatLabel` en su lugar (ver `historial_medico_id` y `certificacion_cierre` en `HistorialPaciente.vue`).

## Preferencias del usuario (Howard)

- Trabajar de forma **autónoma** en los cambios de código (no pedir confirmación por cada edición).
- **Siempre preguntar antes de hacer `git commit`.**
