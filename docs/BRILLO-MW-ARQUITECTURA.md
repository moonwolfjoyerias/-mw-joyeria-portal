# BRILLO MW — Arquitectura del monorepo

**B**ase de **R**egistro de **I**nventarios, **L**íderes, **L**iquidaciones y
**O**ficinas MW. Una sola app (este repositorio) que se publica en tres
modos: **web** (portal público y clientas), **escritorio** (PC de caja,
Tauri → `.exe`) y **tablet** (piso de venta, Capacitor → `.apk`/`.ipa`),
todas contra el mismo proyecto de Firebase (`moonwolf-portal`).

Decisiones confirmadas (3-oct-2026):

- **BRILLO reemplaza a Aronium.** BRILLO pasa a ser la caja registradora
  y la fuente de verdad del inventario físico. Esto sustituye la
  Sección 20 de los requisitos v8 (ver §6).
- **Staff conserva la cuenta compartida** (requisitos, Sección 16) por
  ahora, con Nombre + PIN en cada acción registrable (ver §4).

Estado: **propuesta + modelo de datos**. Lo único ya agregado al repo es
`src/types/brillo.ts`, `tsconfig.json` (`npm run typecheck`) y la
exclusión de las carpetas nativas en `scripts/build.mjs`. Nada de lo que
hoy se sirve cambió.

---

## 1. Lo que ya existe (análisis del repo)

| Área | Archivos | Notas |
|---|---|---|
| Sitio público | `index.html`, `catalogo-publico.html`, `colecciones.html`, `nosotros.html`, `contacto.html`, `ventajas-plan.html`, `login.html` | HTML estático, sin framework |
| Portal por rol | `portal/{admin,encargado,staff,lider,emprendedora}/*.html` (44 páginas) | `encargado` = rol **RH** de los requisitos |
| Lógica | `js/` — 117 archivos, ~39 mil líneas, scripts globales (sin módulos) | Patrón `*-modelo.js` (reglas) + `*-firestore-sync.js` (caché + Firestore) + controladores por rol |
| Firebase | `js/firebase-config.js`, `js/firebase-init.js` (SDK *compat* por CDN), `js/auth-service.js`, `js/auth-guard.js` | `MODO_DEMO = false` — ya conectado a Firestore/Auth reales |
| Reglas | `firestore.rules` (~40 colecciones) | El rol se lee con `get(users/{uid}).rol` — **no hay custom claims todavía** |
| Scripts admin | `scripts/seed-firebase.js`, `crear-admin-firebase.js`, `migrar-personas-financiero.js`, `borrar-cuentas-ejemplo.js` | Usan `firebase-admin` con cuenta de servicio |
| Build | `scripts/build.mjs` (esbuild) → `dist/` | Copia completa del sitio con los `<script>` fusionados y minificados |
| Dependencias | `esbuild` (dev). Ahora también `typescript` (dev) | Sin dependencias de producción |
| Requisitos | `MW Joyeria Requisitos Fase1 v8.docx`, `AUDITORIA-FIREBASE.md`, `SETUP-FIREBASE.md` | |

Modelos que ya resuelven reglas de BRILLO y que **se reutilizan, no se
duplican**:

- **Variantes Modelo → Color → Talla** — `js/catalogo-variantes-modelo.js` (arreglo `variantes` aplanado por producto, stock descontado con transacción).
- **Descuento de mayoreo** — `js/catalogo-modelo.js` (`DESCUENTOS_POR_MATERIAL`, souvenirs sin % fijo).
- **Ventanas de depósito** — `js/apartados-modelo.js` (`DEPOSITO_BASE = 50`, piso + excedente, `normal`/`foranea`/`vip`, crédito guardado).
- **Comisiones** — `js/comisiones-modelo.js` (÷1.16 × % por nivel/rango, ajustes manuales con historial).
- **Nómina semanal** — `js/nomina-modelo.js` (flujo RH → validación Admin → pagado, ajustes con historial).

Lo que **no existe** todavía: ventas/POS, turnos y cortes de caja,
historial de movimientos de inventario, PIN de Staff, custom claims,
dispositivos registrados, impresión de tickets, lectura de código de
barras, y cualquier configuración de Tauri o Capacitor.

---

## 2. Estructura de carpetas propuesta

Principio: **la raíz sigue siendo el sitio web** tal cual. Mover las 50
páginas a `apps/web/` rompería sus rutas relativas (`../../js/...`), el
build y el despliegue actual, sin ganar nada. Las plataformas nativas son
"cáscaras" que empaquetan el mismo `dist/`.

```
mw-joyeria-portal/
├── index.html, login.html, …        ← sitio público (sin cambios)
├── portal/<rol>/*.html              ← portal por rol (sin cambios)
│   ├── staff/staff-pos.html         ← NUEVO: punto de venta (caja/tablet)
│   ├── staff/staff-caja.html        ← NUEVO: apertura y corte de caja
│   ├── staff/staff-inventario.html  ← NUEVO: entradas, ajustes, mermas
│   ├── staff/staff-depositos.html   ← NUEVO: captura de depósitos con firma
│   └── admin/admin-reportes.html    ← NUEVO: ventas, cortes, inventario
├── css/  assets/                    ← sin cambios
├── js/                              ← lógica actual (scripts globales)
│   ├── plataforma.js                ← NUEVO: detecta web / escritorio / tablet
│   ├── firma-pin.js                 ← NUEVO: modal Nombre + PIN y firma de acciones
│   ├── escaner-codigos.js           ← NUEVO: lector de código de barras USB
│   └── impresion-ticket.js          ← NUEVO: ticket térmico (Tauri) / PDF (web)
├── src/
│   └── types/brillo.ts              ← modelo de datos compartido (ya creado)
├── src-tauri/                       ← NUEVO: app de escritorio (Rust)
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   ├── capabilities/default.json
│   └── src/{main.rs, impresora.rs}
├── capacitor.config.ts              ← NUEVO: app de tablet
├── android/  ios/                   ← generadas por `npx cap add` (versionadas)
├── functions/                       ← OPCIONAL (requiere plan Blaze), ver §4
├── scripts/                         ← + fijar-claims.js (custom claims)
│                                       + importar-aronium.js (migración inicial)
├── docs/BRILLO-MW-ARQUITECTURA.md
├── firestore.rules
└── package.json                     ← scripts: build, typecheck, desktop:*, tablet:*
```

`scripts/build.mjs` ya ignora `src/`, `src-tauri/`, `android/`, `ios/` y
`docs/` (Capacitor guarda una **copia** de `dist/` dentro de `android/` e
`ios/`; sin esa exclusión, el build la duplicaría).

### Migración gradual a TypeScript

`src/types/brillo.ts` describe los documentos que ya existen. Los módulos
nuevos (POS, firma con PIN, impresión) pueden escribirse en `src/*.ts` y
compilarse con el mismo esbuild a `js/` — sin obligar a migrar los 117
archivos actuales. Mientras tanto, los `.js` pueden validarse contra los
tipos con `// @ts-check` + JSDoc `@type {import('../src/types/brillo').Venta}`.

---

## 3. Roles y control de acceso

| Rol (`users/{uid}.rol`) | Etiqueta | Accesos clave |
|---|---|---|
| `admin` | Administrativo | Todo; reportes globales; nómina; **ajustar y congelar** cualquier `ValorCalculado` |
| `encargado` | **RH** | Nómina semanal de Staff/RH/Admin + catálogo, apartados y calendario |
| `staff` | Staff (Caja) | POS, cobros, cortes de caja, depósitos, inventario — **una cuenta compartida; cada acción firmada con Nombre + PIN** |
| `lider` | Líder | Equipo, comisiones, apartados; `isVip: true` = sin depósito ni vencimiento (con aprobación de Staff) |
| `emprendedora` | Emprendedora | Catálogo con mayoreo automático; apartados; `isForanea: true` = 15 días |

Se conserva el valor guardado `encargado` (no se renombra a `rh`) para no
romper cuentas, reglas ni `portal/encargado/`: solo cambia la etiqueta.

### Custom claims

1. `scripts/fijar-claims.js` (Admin SDK, igual que los scripts actuales)
   copia `users/{uid}.rol` a un claim `{ rol, cv: 1 }` y lo vuelve a fijar
   cada vez que Administrativo cambia un rol.
2. `firestore.rules` pasa a leer `request.auth.token.rol` **con respaldo**
   al `get(users/{uid})` actual, para que ninguna cuenta quede fuera
   mientras se migran:
   ```
   function miRol() {
     return request.auth.token.rol != null ? request.auth.token.rol : miPerfil().rol;
   }
   ```
3. `isVip` / `isForanea` se quedan en el documento del usuario (no en
   claims): un claim tarda hasta 1 h en refrescarse y estos flags deben
   surtir efecto de inmediato.

Beneficio: las reglas dejan de hacer un `get()` facturable en cada
lectura, y el rol queda firmado por Firebase.

---

## 4. Firma con Nombre + PIN (cuenta compartida de Staff)

Requisito: la caja/tablet mantiene abierta la sesión **compartida** de
Staff, y cada acción registrable (venta, cancelación, depósito,
liquidación, inventario, apertura/corte de caja, consulta de nómina
propia) pide elegir Nombre + PIN de 4-6 dígitos.

Diseño (sin cuentas individuales para Staff):

1. **`pinesStaff/{empleadoId}`** guarda por empleado de nómina un hash
   PBKDF2-SHA256 con sal propia (tipo `PinStaff`) — nunca el PIN en
   claro. Solo Administrativo lo crea o restablece (requisitos 19.2).
2. **`js/firma-pin.js`** muestra el modal, calcula el hash con WebCrypto
   (disponible en web, Tauri y Capacitor) y lo compara. Tras
   `PIN_MAX_INTENTOS` (5) fallos seguidos fija `bloqueadoHasta`
   (15 minutos) y avisa a Administración.
3. La acción se escribe con una **`FirmaEmpleado`** (`empleadoId`,
   `empleadoNombre`, `sesionUid`, `dispositivoId`, fecha) y además queda
   en `bitacoraAcciones` (append-only).
4. Las reglas exigen que `firma.sesionUid == request.auth.uid`, que
   `firma.empleadoId` sea un empleado de Staff activo, y que
   `bitacoraAcciones` y `movimientosInventario` no se puedan editar ni borrar.

**Límite conocido (aceptado por ahora):** como las 8 personas comparten
la misma cuenta de Firebase, el servidor no puede comprobar *quién*
tecleó el PIN — la verificación ocurre en el dispositivo, y la cuenta
compartida necesita poder leer los hashes. El PIN evita que un
compañero firme por otro desde la pantalla normal de la caja, pero no
frena a alguien que abra las herramientas de desarrollador y pruebe las
10 000-1 000 000 combinaciones. Es el mismo nivel de confianza que el
"registro de nombre por acción" de los requisitos, con un control
adicional. `pinesStaff` solo es legible por `staff`/`admin`, nunca por
emprendedoras ni líderes.

**Cuándo reforzarlo:** si hace falta trazabilidad que valga ante una
disputa (faltantes en el corte de caja, por ejemplo), hay dos opciones
que no cambian el modelo de datos más allá de la firma: cuentas
individuales de Firebase Auth por empleado usadas solo para firmar, o
verificar el PIN en una Cloud Function (requiere plan Blaze).

## 5. Integración multiplataforma

Las tres plataformas sirven **el mismo `dist/`** que ya genera
`npm run build`. `js/plataforma.js` decide qué mostrar:

```js
const PLATAFORMA = window.__TAURI_INTERNALS__ ? 'escritorio'
  : (window.Capacitor && window.Capacitor.isNativePlatform()) ? 'tablet'
  : 'web';
document.documentElement.dataset.plataforma = PLATAFORMA;
```

### 5.1 Escritorio — Tauri v2 (PC de caja, `.exe`)

```
npm i -D @tauri-apps/cli
npx tauri init   # frontendDist: "../dist", devUrl: http://localhost:5173
```

`src-tauri/tauri.conf.json` (extracto):

```json
{
  "productName": "BRILLO MW Caja",
  "identifier": "com.mwjoyeria.brillo",
  "build": {
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [{ "title": "BRILLO MW", "url": "portal/staff/staff-pos.html", "maximized": true }]
  },
  "bundle": { "targets": ["nsis", "msi"] }
}
```

- **Impresora térmica de tickets:** comando Rust `imprimir_ticket` que
  genera ESC/POS (crate `escpos`) y lo envía a la impresora — USB/serie
  directo o como trabajo RAW al spooler de Windows. JS lo llama con
  `window.__TAURI__.core.invoke('imprimir_ticket', { venta })`. En web y
  tablet, `js/impresion-ticket.js` cae a `window.print()` con una hoja de
  80 mm.
- **Lector de código de barras USB:** casi todos funcionan como
  **teclado HID**, así que **no requieren código nativo**: `js/escaner-codigos.js`
  detecta ráfagas de teclas (< 30 ms entre teclas, terminadas en Enter) y
  busca `VarianteProducto.codigoBarras`. Funciona igual en las tres plataformas.
- Compilar el `.exe` requiere Windows (o CI con `windows-latest`).

### 5.2 Tablet — Capacitor (piso de venta, `.apk`/`.ipa`)

```
npm i @capacitor/core && npm i -D @capacitor/cli
npm i @capacitor/android @capacitor/ios
npx cap add android && npx cap add ios
```

`capacitor.config.ts`:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mwjoyeria.brillo',
  appName: 'BRILLO MW',
  webDir: 'dist',
  server: { androidScheme: 'https' }
};
export default config;
```

Flujo: `npm run build && npx cap sync` → abrir en Android Studio / Xcode.
La UI táctil se ajusta con `[data-plataforma="tablet"]` en `css/styles.css`
(objetivos de toque ≥ 44 px, sin hover). El `.ipa` requiere macOS + Xcode.

### 5.3 Firebase en las apps nativas

- **La caja debe poder cobrar sin internet** ahora que no hay Aronium de
  respaldo: Firestore con persistencia local encola las ventas y las
  sube al volver la red. Los folios se generan por dispositivo
  (`prefijoFolio` + consecutivo local) para no depender del servidor.
- Agregar a **Authentication → Configuración → Dominios autorizados**:
  `tauri.localhost` (Tauri en Windows) y `localhost` (Capacitor).
- El SDK *compat* por CDN necesita red en el primer arranque. Para que la
  caja siga abriendo sin internet conviene **empaquetar** el SDK en
  `dist/` (descargarlo en el build en vez de cargarlo de `gstatic.com`) y
  activar `firebase.firestore().enablePersistence()`.

### 5.4 Scripts propuestos en `package.json`

```json
"desktop:dev":   "tauri dev",
"desktop:build": "tauri build",
"tablet:sync":   "npm run build && cap sync",
"tablet:android":"cap open android",
"tablet:ios":    "cap open ios"
```

---

## 6. BRILLO como reemplazo de Aronium

Lo que antes hacía Aronium y ahora debe cubrir BRILLO:

| Función de Aronium | En BRILLO | Tipo en `brillo.ts` |
|---|---|---|
| Cobro en caja (público y emprendedoras) | POS en escritorio/tablet | `Venta` (`origen: 'pos'`) |
| Ticket impreso | Impresora térmica vía Tauri | `Venta.folio`, `ticketImpreso` |
| Inventario físico | `stock` por variante + historial | `MovimientoInventario` |
| Apertura y corte de caja | Turno por dispositivo | `TurnoCaja` |
| Historial de ventas y estadísticas | Historial completo migrado + ventas nuevas | `Venta`, `ImportacionAronium` |
| Reporte de ventas, métodos de pago y comisiones | Reporte por periodo (con referencias) | `ReporteVentasPeriodo` |
| Datos de emprendedoras | Ya viven en `users`/`personas` | `UsuarioVenta` |

Cambios respecto a los requisitos v8 (Sección 20):

- Ya no existe la "compra directa capturada después de cobrar en
  Aronium": una emprendedora que compra en tienda es una venta `pos` con
  `compradorId`, y el desglose normal/souvenirs se calcula solo a partir
  de las líneas del ticket.
- El catálogo deja de copiar a mano las cantidades de Aronium: el stock
  solo cambia por movimientos de inventario, en la misma transacción que
  la venta o el apartado.

### 6.1 Sin facturación electrónica

Hoy no se factura (no hay CFDI). Lo que se usa de Aronium es un
**reporte**: ventas totales, cuánto entró por tarjeta, transferencia y
efectivo, y los pagos de comisiones. BRILLO lo reemplaza con
`ReporteVentasPeriodo` (página `admin/admin-reportes.html`):

- Ventas del periodo: total, número de ventas y cancelaciones, normal
  vs. souvenirs, público general vs. emprendedoras/líderes.
- Ingresos por método (efectivo, tarjeta, transferencia), **incluyendo
  depósitos y liquidaciones de apartados**, no solo las ventas de caja.
- Detalle de cada pago con tarjeta o transferencia con su referencia,
  para conciliar contra la terminal y el estado de cuenta.
- Depósitos de apartado: recibidos, aplicados a compra, guardados como
  crédito y perdidos.
- Comisiones pagadas por líder, con método y referencia.
- Diferencias de los cortes de caja del periodo.

Se calcula al vuelo; al cerrar un periodo se guarda una foto
(`cerrado: true`) para que no cambie si después se corrige algo.
Exportable a Excel/PDF.

### 6.2 Número de referencia obligatorio

La terminal y las transferencias arrojan un número de referencia que
Aronium no guardaba. En BRILLO:

- Un pago con `tarjeta` o `transferencia` **no se puede guardar sin
  referencia** (`PagoConReferencia.referencia` es obligatorio). Aplica
  igual a ventas de caja, depósitos de apartado, liquidaciones y pagos
  de comisiones.
- `referenciasPago/{metodo}_{referencia}` se crea en la misma transacción
  que el pago. Si esa referencia ya existe, la caja avisa en qué folio se
  usó, en lugar de registrar dos veces el mismo cobro.
- Los pagos anteriores a BRILLO que no tienen referencia (historial de
  Aronium, "Pago en local" de los apartados actuales) se marcan como
  `PagoHistorico` (`historico: true`) en vez de inventarles una.

### 6.3 Migración completa del historial

Se migra **todo**, incluidas las ventas pasadas: las comisiones, el rango
de las líderes, el Reto de Constancia y las rifas se calculan sobre
compras anteriores. `scripts/importar-aronium.js` procesa tres
exportaciones de Aronium (Excel/CSV), en este orden:

1. **Productos y existencias** → `productos` + movimientos `carga_inicial`.
2. **Emprendedoras** (requisitos 20.2) → se empatan con las personas que
   ya existen en BRILLO por teléfono o nombre.
3. **Ventas** → `Venta` con `origen: 'importada_aronium'` y
   `importacion.folioAronium`. Para cada venta hay que resolver la
   compradora, el material de cada artículo (normal vs. souvenir) y la
   líder vigente en esa fecha.

Cada archivo es un lote (`ImportacionAronium`) que queda **en revisión**
antes de aplicarse: muestra cuántas filas se importan, cuáles se saltan
por duplicadas y cuáles necesitan resolverse a mano (una clienta que no
empata, un producto sin categoría). Reimportar el mismo archivo no
duplica nada.

**Impacto en el código actual:** hoy `js/compras-modelo.js` (que alimenta
Comisiones, Plan MW, Reto y rifas) solo cuenta piezas de apartado
liquidadas. Hay que hacer que también lea `ventas` (POS e importadas);
si no, el historial migrado no contaría para nada.

**Corte de cambio:** hacer el cambio en un cierre de caja, con conteo
físico el mismo día. Las ventas de Aronium posteriores a la exportación
se importan en un último lote antes de empezar a cobrar en BRILLO.

## 7. Pendientes por confirmar

1. **Exportaciones de Aronium.** Necesito un archivo de ejemplo de cada
   exportación (productos, clientas, ventas — aunque sean pocas filas)
   para escribir el importador con las columnas reales. En particular:
   ¿la exportación de ventas trae el detalle por artículo o solo el total
   por ticket? Sin detalle, la separación normal/souvenirs del historial
   habría que capturarla o estimarla.
2. **Desde cuándo** migrar el historial de ventas (¿todo lo que tenga
   Aronium, o desde una fecha?).
3. **Plan Blaze.** Si se activa, la verificación de PIN y el cálculo de
   comisiones pueden moverse a Cloud Functions (más robusto).
