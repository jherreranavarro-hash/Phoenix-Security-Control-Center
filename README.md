# Phoenix Security Control Center

Aplicativo web corporativo, en español, para administrar, evaluar, gobernar y
desplegar configuraciones de seguridad y administración de Microsoft 365 del
tenant de **Phoenix Service** (Microsoft Entra ID, Intune, Microsoft Defender,
Microsoft Purview, Exchange Online, usuarios, grupos y licencias).

Backend en Node.js/Express + TypeScript, cliente de Microsoft Graph vía MSAL,
y un frontend SPA en JavaScript nativo (sin build step) servido como archivos
estáticos por el mismo backend.

## Principios de diseño

- **Sin secretos en el navegador.** Todas las credenciales viven en variables
  de entorno del servidor (o Azure Key Vault en producción). El frontend solo
  habla con `/api/*` del propio backend.
- **Dos identidades separadas** para Microsoft Graph:
  - `Phoenix Security Assessment – ReadOnly` — todas las lecturas.
  - `Phoenix Security Deployment – Production` — únicamente escrituras, y
    solo cuando `PHX_ENABLE_WRITES=true`.
- **Modo demostración por defecto.** Si no hay credenciales de Microsoft
  Graph configuradas, la plataforma funciona igual pero con datos de ejemplo
  del tenant, marcados explícitamente en toda la interfaz con la insignia
  "● Demostración".
- **Segregación de funciones.** El solicitante de un cambio nunca puede ser
  su propio aprobador ni ejecutar el paso a Producción; se valida en el
  backend, no solo en la interfaz.
- **Trazabilidad total.** Cada cambio gobernado y cada acción individual
  (bloqueo de cuenta, cambio de licencia, rol, membresía, buzón) queda
  registrada en una bitácora de auditoría (`GET /api/audit`).

## Estructura

```
src/
  config.ts            Variables de entorno, banderas de modo demo/escritura
  types.ts              Tipos de dominio compartidos
  graph/                Autenticación MSAL y cliente REST de Microsoft Graph
  data/                 Datos de DEMOSTRACIÓN (usuarios, grupos, SKU, hallazgos, catálogo de políticas)
  services/              Lógica de negocio (puntaje, flujo de cambios, despliegue, licencias, artefactos)
  middleware/             Identidad (Easy Auth / demo), control de escrituras, aprobador
  routes/                Endpoints REST, uno por módulo
  lib/                   Almacén JSON de gobierno + auditoría, utilidades
public/
  index.html, styles.css  Interfaz (sidebar + topbar)
  js/views/*.js           Un módulo por sección de negocio (Resumen, Dashboard, Assessment, Usuarios, Gobierno, Artefactos, Políticas, Despliegue, Integraciones)
data/store.json          Almacén de gobierno (cambios, auditoría, overrides de demo) — no se versiona
```

## Módulos implementados

1. **Resumen ejecutivo** — puntaje global, brechas por criticidad, cambios
   pendientes de aprobación, bitácora reciente, plan de mejora recomendado.
2. **Dashboard de KPI** — cobertura actual vs. meta por dominio, punto de
   inflexión (70/100), meta anual (85/100), proyección a 30/60/90 días,
   ranking de acciones prioritarias.
3. **Assessment** — radiografía del tenant con ~19 hallazgos cubriendo MFA,
   autenticación heredada, métodos resistentes a phishing, cuentas de
   emergencia, acceso condicional, Intune, BitLocker, Defender, ASR, DLP,
   etiquetas, auditoría/retención y funciones que requieren licenciamiento
   adicional (Entra ID P2, Defender for Endpoint P2, Defender for Identity /
   Cloud Apps, Purview avanzado). Cada hallazgo permite crear directamente un
   cambio gobernado.
4. **Catálogo de políticas** — ~27 políticas (Entra ID, Intune, Defender,
   Purview, Exchange) seleccionables individualmente o en lote para generar
   cambios gobernados.
5. **Gobierno de cambios** — flujo de 8 estados (Evaluación → Diseño →
   Piloto → Aprobación → Producción → Revertido/Cerrado/Rechazado) con
   máquina de estados validada en el servidor, resultado de piloto,
   evidencias y segregación de funciones.
6. **Despliegue y control de impacto** — selección de alcance por grupos o
   personas, búsqueda/filtros, selección masiva, exclusión obligatoria de
   cuentas de emergencia, ventanas de piloto/producción, cálculo de
   impacto y checklist de confirmación explícita antes de aprobar/ejecutar.
7. **Usuarios, roles, grupos y Exchange** — directorio con búsqueda/filtros,
   creación de usuarios, bloqueo/desbloqueo gobernado, roles, grupos de
   seguridad clasificados por dominio, y administración de buzones
   (alias, reenvío, respuesta automática, delegados, buzones compartidos).
8. **Licencias** — disponibilidad de SKU, gestión individual gobernada, y la
   **campaña masiva Business Standard → Business Premium** con todas las
   salvaguardas del enunciado (ver abajo).
9. **Artefactos** — generación y descarga en Markdown de los 8 documentos
   requeridos (política de gobierno, procedimiento operativo, evaluación de
   riesgo, plan de pruebas piloto, registro de cambio y reversión, informe
   de implementación, plan de mejora continua, inventario), más las
   cadencias de revisión (mensual/trimestral/anual).
10. **Integraciones** — dominios verificados, usuarios invitados, acceso de
    invitados en Teams, y el asistente de diagnóstico de acceso externo de
    7 pasos descrito en el enunciado.

## Variables de entorno

Ver `.env.example`. Resumen de las críticas:

| Variable | Efecto |
|---|---|
| `PHX_TENANT_ID`, `PHX_READONLY_CLIENT_ID/SECRET` | Habilitan lecturas reales vía Microsoft Graph. Sin ellas, modo demostración. |
| `PHX_PROD_CLIENT_ID/SECRET` | Identidad de producción, solo se usa si `PHX_ENABLE_WRITES=true`. |
| `PHX_ENABLE_WRITES` | Maestro de escrituras reales contra el tenant. **Debe quedar en `false` fuera de una ventana de cambio aprobada.** |
| `PHX_LICENSE_APPROVER_UPN` | Único UPN autorizado para ejecutar la campaña masiva de licencias. |
| `PHX_DEV_USER_*` | Identidad simulada cuando no hay Azure App Service Easy Auth disponible (desarrollo local). |

En producción (Azure App Service), activar **App Service Authentication**
con proveedor Microsoft: la app lee la identidad real del encabezado
`x-ms-client-principal` inyectado por la plataforma (`src/middleware/auth.ts`),
nunca la genera ni la valida por sí misma.

## Campaña masiva Business Standard → Business Premium

Implementada en `services/licenseCampaignService.ts` y expuesta en la pestaña
**Usuarios → Campaña Business Premium**:

1. Consulta los SKU reales del tenant (`/subscribedSkus` vía Graph, o datos
   de demostración si no hay conexión).
2. Detecta usuarios activos con el SKU técnico `O365_BUSINESS_PREMIUM`
   (nombre comercial actual: *Microsoft 365 Empresa Estándar*), excluyendo
   siempre las cuentas de emergencia.
3. Verifica disponibilidad real del SKU `SPB` (*Microsoft 365 Empresa
   Premium*).
4. Muestra la lista completa de personas afectadas antes de ejecutar.
5. Bloquea la ejecución si no hay licencias Premium suficientes — no se
   realiza ningún cambio parcial.
6. Ejecuta, por usuario, una única llamada a `assignLicense` que agrega SPB y
   retira `O365_BUSINESS_PREMIUM` al mismo tiempo.
7. La vista previa se firma con un `tokenRevision` (hash de la lista de
   personas + disponibilidad). Si la lista cambia entre la revisión y la
   ejecución, el backend rechaza la ejecución y exige una nueva revisión.
8. Registra bitácora completa (aprobador, fecha, cuenta por cuenta, éxito o
   fallo) en `GET /api/licenses/campania/historial` y en `GET /api/audit`.

Controles de acceso: requiere `PHX_ENABLE_WRITES=true`, que el usuario
autenticado sea exactamente `PHX_LICENSE_APPROVER_UPN`, la confirmación
explícita de revisión de impacto, y escribir textualmente
`AUTORIZO CAMBIO MASIVO A BUSINESS PREMIUM`. Al finalizar, la respuesta
recuerda dejar `PHX_ENABLE_WRITES=false` nuevamente.

## Desarrollo local

```bash
npm install          # o pnpm install / yarn install
cp .env.example .env  # y completa los valores reales cuando existan

npm run dev           # http://localhost:4100
npm run typecheck
npm run build && npm start
```

Sin variables de entorno de Microsoft Graph configuradas, la aplicación
arranca igual en modo demostración con datos de ejemplo de Phoenix Service.

## Licenciamiento base y funciones que requieren licencias adicionales

La plataforma asume **Microsoft 365 Business Premium** como base (Entra ID
P1, Intune Plan 1, Defender for Business, Defender for Office 365 Plan 1,
capacidades base de Purview). El módulo de Assessment marca explícitamente
como `RequiereLicencia` toda función que exceda esa base: Entra ID P2
(protección de identidad basada en riesgo), Defender for Endpoint Plan 2,
Defender for Identity, Defender for Cloud Apps y funciones avanzadas de
Purview (eDiscovery avanzado, Insider Risk Management).
