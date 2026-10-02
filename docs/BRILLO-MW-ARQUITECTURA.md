# BRILLO MW — Arquitectura del monorepo

**B**ase de **R**egistro de **I**nventarios, **L**íderes, **L**iquidaciones y
**O**ficinas MW. Una sola app (este repositorio) que se publica en tres
modos: **web** (portal público y clientas), **escritorio** (PC de caja,
Tauri → `.exe`) y **tablet** (piso de venta, Capacitor → `.apk`/`.ipa`),
todas contra el mismo proyecto de Firebase (`moonwolf-portal`).

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

Lo que **no existe** todavía: ventas/POS, PIN de Staff, custom claims,
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
│   └── staff/staff-depositos.html   ← NUEVO: captura de depósitos con firma
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
| `staff` | Staff (Caja) | POS, cobros, depósitos, altas/bajas de inventario — **cada acción firmada con PIN** |
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

## 4. Firma con Nombre + PIN en dispositivo compartido

Requisito: la caja/tablet mantiene la sesión abierta, pero cada acción
registrable (venta, cancelación, depósito, liquidación, alta/baja de
inventario, consulta de nómina propia) pide Nombre + PIN de 4-6 dígitos.

**Riesgo a evitar:** guardar un hash del PIN en Firestore y compararlo en
el navegador. Con solo 10 000-1 000 000 combinaciones, cualquiera con la
sesión abierta podría leer el hash y probarlas todas en segundos.

**Diseño recomendado (funciona en el plan gratuito Spark):**

1. Cada empleado de Staff tiene **su propia cuenta de Firebase Auth**
   (`staff-ana@pin.mwjoyeria.local`) cuya contraseña deriva de su PIN. El
   dispositivo entra con una cuenta de **mostrador** (`claims.mostrador`)
   que solo puede *leer* lo necesario.
2. Al confirmar una acción, `js/firma-pin.js` inicia sesión con el PIN en
   una **segunda instancia** de Firebase (`firebase.initializeApp(cfg, 'firma')`)
   — sin tocar la sesión del mostrador — y **escribe el documento con esa
   instancia**. Después cierra esa sesión.
3. Las reglas exigen que toda escritura registrable venga del propio
   empleado: `request.auth.uid == request.resource.data.firma.empleadoUid`.
   La trazabilidad deja de depender de que el cliente "diga" quién fue.
4. Firebase Auth aplica su propio límite de intentos fallidos, y solo
   Administrativo restablece el PIN (requisitos 19.2) con el Admin SDK.

Alternativa: verificar el PIN en una Cloud Function (`functions/`), que
exige el plan **Blaze**. El repo hoy evita Blaze a propósito (ver
`SETUP-FIREBASE.md`), por eso no es la opción por defecto.

Firebase Auth exige contraseñas de al menos 6 caracteres; para PIN de 4-5
dígitos la contraseña se deriva como `"mw-" + PIN` (el prefijo no aporta
seguridad, solo cumple la longitud — la protección real es el límite de
intentos del servidor).

---

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

## 6. Decisiones abiertas para el negocio

1. **POS vs. Aronium.** Los requisitos v8 (Sección 20) dicen que **Aronium
   sigue siendo la caja registradora y la fuente de verdad del
   inventario**, sin integración. Un POS dentro de BRILLO con impresora y
   escáner cambia eso: ¿BRILLO reemplaza a Aronium, o convive y el POS solo
   registra ventas a emprendedoras/líderes? El modelo `Venta` ya soporta
   ambos casos (`origen: 'pos' | 'compra_directa_aronium'`), pero el flujo
   de inventario depende de esta respuesta.
2. **Staff con cuenta compartida.** Los requisitos dicen "8 personas, cuenta
   compartida con registro de nombre por acción"; el diseño de §4 lo
   convierte en cuenta de mostrador + cuenta individual por PIN. Confirmar.
3. **Plan Blaze.** Si se activa, la verificación de PIN y el cálculo de
   comisiones pueden moverse a Cloud Functions (más robusto).
