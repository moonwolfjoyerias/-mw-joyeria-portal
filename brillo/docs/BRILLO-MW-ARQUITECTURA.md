# BRILLO MW — Arquitectura

**B**ase de **R**egistro de **I**nventarios, **L**íderes, **L**iquidaciones y
**O**ficinas MW. Apps de **escritorio** (PC de caja, Tauri → `.exe`) y
**tablet** (piso de venta, Capacitor → `.apk`/`.ipa`) que trabajan **de la
mano de la página web**, contra el mismo proyecto de Firebase
(`moonwolf-portal`), sin invadirla.

## 0. Regla de convivencia con la página web

> **BRILLO no modifica la página web.** Ningún archivo fuera de `brillo/`
> se crea, mueve o edita sin autorización expresa. Cuando algo de BRILLO
> necesite un cambio en la página, se documenta aquí como **pendiente de
> autorización** y no se hace.

En la práctica:

- **Código:** todo BRILLO vive en `brillo/`, con su propio `package.json`,
  dependencias y build. No reutiliza `js/`, `css/` ni `scripts/` de la
  página (puede copiar reglas de negocio, pero no importarlas).
- **Datos:** BRILLO **lee** las colecciones de la página (`users`,
  `personas`, `productos`, `ventanasApartado`) tal como ella las guarda
  (`src/types/pagina.ts`) y **escribe solo en colecciones propias** con
  prefijo `brillo` (`COLECCIONES_BRILLO` en `src/types/brillo.ts`).
- **Formas de datos:** si la página cambia un campo, `pagina.ts` se ajusta
  a ella. BRILLO nunca agrega campos a documentos de la página.

Decisiones confirmadas:

- **BRILLO reemplaza a Aronium** como caja e inventario (ver §7).
- **Staff conserva la cuenta compartida**, con Nombre + PIN por acción (§5).
- **Sin CFDI**; se reemplaza el reporte de Aronium (§7.1).
- **Referencia obligatoria** en tarjeta y transferencia (§7.2).
- **Se migra todo el historial** de Aronium, incluidas ventas (§7.3).

---

## 1. Lo que ya existe en la página (análisis)

| Área | Archivos | Notas |
|---|---|---|
| Sitio público | `index.html`, `catalogo-publico.html`, `colecciones.html`, `nosotros.html`, `contacto.html`, `ventajas-plan.html`, `login.html` | HTML estático, sin framework |
| Portal por rol | `portal/{admin,encargado,staff,lider,emprendedora}/*.html` (44 páginas) | `encargado` = rol **RH** de los requisitos |
| Lógica | `js/` — 117 archivos, ~39 mil líneas, scripts globales | `*-modelo.js` (reglas) + `*-firestore-sync.js` (caché + Firestore) |
| Firebase | `js/firebase-config.js`, `js/firebase-init.js` (SDK *compat* por CDN) | Ya conectado a Firestore/Auth reales |
| Reglas | `firestore.rules` (~40 colecciones + "denegar todo lo demás") | El rol se lee de `users/{uid}.rol` |
| Build | `scripts/build.mjs` (esbuild) → `dist/` | Recorre **todas** las carpetas buscando `.html` |

Reglas de negocio que la página ya resuelve y que BRILLO debe respetar
(se leen sus datos, no se duplican):

- **Variantes Modelo → Color → Talla:** `productos/{id}.variantes[]` con `colorOro`, `talla`, `stock`.
- **Descuento de mayoreo:** `descuento` por producto; souvenirs sin % fijo.
- **Foránea / VIP:** `personas/{id}.categoria` (`normal` | `foranea` | `vip`) — no son banderas `isVip`/`isForanea` sueltas; `pagina.ts` las deriva con `esVip()` / `esForanea()`.
- **Ventanas de depósito, comisiones, nómina:** `ventanasApartado`, `comisiones*`, `nomina*`.

---

## 2. Estructura de `brillo/`

```
mw-joyeria-portal/
├── (página web — sin cambios)
└── brillo/
    ├── package.json, tsconfig.json   ← proyecto independiente
    ├── docs/BRILLO-MW-ARQUITECTURA.md
    ├── src/
    │   ├── types/pagina.ts           ← documentos de la página (solo lectura)
    │   ├── types/brillo.ts           ← colecciones propias de BRILLO
    │   ├── firebase/                 ← init propio del SDK (mismo proyecto)
    │   ├── pos/, caja/, inventario/, reportes/, firma-pin/
    │   └── hardware/                 ← escáner USB, impresión de tickets
    ├── apps/
    │   ├── escritorio/src-tauri/     ← Tauri v2 (.exe)
    │   └── tablet/                   ← Capacitor (android/, ios/)
    └── scripts/importar-aronium.ts   ← migración inicial
```

Hoy existen `package.json`, `tsconfig.json`, `docs/` y `src/types/`.

### ⚠️ Pendiente de autorización: el build de la página y `brillo/`

`scripts/build.mjs` de la página recorre **todas** las carpetas del
repositorio buscando `.html` (solo se salta `node_modules`, `dist`, `.git`
y `scripts`). En cuanto BRILLO tenga sus propias pantallas `.html`, el
build de la página las metería en su `dist/`. Hoy no pasa nada porque
`brillo/` no tiene ningún `.html` (comprobado: el build de la página da
el mismo resultado que antes).

Antes de crear la primera pantalla hay que elegir:

- **A.** Agregar `'brillo'` a la lista de carpetas que salta
  `scripts/build.mjs` (una línea en un archivo de la página).
- **B.** Mover BRILLO a su **propio repositorio** — cero contacto con la
  página.

Además: **¿cómo se publica la página?** Si se sirve directo desde este
repositorio (por ejemplo GitHub Pages sobre la raíz), `brillo/` también
quedaría accesible públicamente. Eso inclinaría la balanza hacia **B**.

---

## 3. Datos compartidos: el choque que hay que resolver

La página guarda `productos` y `ventanasApartado` **reescribiendo la
colección completa** desde la copia que tiene en memoria, y **borra
cualquier documento que no conozca** (`sincronizarCatalogoConFirestore`
en `js/catalogo-firestore-sync.js`, `sincronizarVentanasConFirestore`
en `js/apartados-firestore-sync.js`). Por eso:

- Si BRILLO descontara stock en `productos` al vender, el siguiente
  guardado del catálogo en la página (con su copia vieja) **devolvería
  el stock anterior**.
- Si BRILLO creara o modificara una ventana de apartado, la página la
  **sobrescribiría o borraría**.
- Por la misma razón BRILLO tampoco puede agregar campos a un producto
  (código de barras): por eso existe `brilloProductosExtra`.

Mientras no se decida otra cosa, **BRILLO no escribe en ninguna
colección de la página**. Eso deja tres cosas sin resolver, cada una
con su pendiente de autorización:

| Necesidad de BRILLO | Por qué choca | Opción que **sí** toca la página | Opción sin tocarla |
|---|---|---|---|
| Descontar stock al vender (BRILLO como inventario real) | La página reescribe `productos` | Que la página guarde solo el producto que cambió y no borre lo que no conoce | BRILLO solo registra movimientos; Staff ajusta el stock en el catálogo de la página, como hoy con Aronium |
| Cobrar depósitos y liquidar apartados en caja | La página reescribe `ventanasApartado` | Igual que arriba, en apartados | Se siguen cobrando desde la página |
| Que las ventas de caja e importadas cuenten para comisiones, Plan MW, Reto y rifas | La página solo cuenta apartados liquidados (`js/compras-modelo.js`) | Que la página también lea `brilloVentas` | Ninguna: sin esto, ni las ventas nuevas ni el historial migrado cuentan |

Y una más, de infraestructura:

- **Reglas de seguridad.** `firestore.rules` termina en "denegar todo lo
  demás", así que las colecciones `brillo*` quedan bloqueadas hasta
  agregarles reglas. Firestore usa **un solo archivo de reglas por base
  de datos**, compartido con la página. Opciones: agregar bloques nuevos
  solo para `brillo*` en ese archivo (sin tocar los existentes), o crear
  una **base de datos Firestore aparte** (`brillo`) en el mismo proyecto,
  con sus propias reglas — hay que verificar si el plan actual lo permite.

---

## 4. Roles y control de acceso

BRILLO lee el rol de `users/{uid}.rol`, igual que la página (sin custom
claims: fijarlos obligaría a cambiar `firestore.rules`).

| Rol | Etiqueta | En BRILLO |
|---|---|---|
| `admin` | Administrativo | Todo; reportes; ajustar y congelar valores calculados |
| `encargado` | **RH** | Consulta de nómina; catálogo y calendario |
| `staff` | Staff (Caja) | POS, cortes de caja, inventario — **cuenta compartida; cada acción con Nombre + PIN** |
| `lider` | Líder | No usa las apps de caja/tablet (sigue en la página) |
| `emprendedora` | Emprendedora | No usa las apps de caja/tablet (sigue en la página) |

---

## 5. Firma con Nombre + PIN (cuenta compartida de Staff)

La caja/tablet mantiene abierta la sesión compartida de Staff; cada
acción registrable (venta, cancelación, inventario, apertura/corte de
caja, consulta de nómina propia) pide Nombre + PIN de 4-6 dígitos.

1. **`brilloPinesStaff/{empleadoId}`** guarda un hash PBKDF2-SHA256 con sal
   propia por empleado (`PinStaff`) — nunca el PIN en claro. Solo
   Administrativo lo crea o restablece (requisitos 19.2).
2. El modal (`brillo/src/firma-pin/`) calcula el hash con WebCrypto y lo
   compara. Tras 5 fallos seguidos se bloquea 15 minutos y se avisa a
   Administración.
3. La acción se guarda con una `FirmaEmpleado` (`empleadoId`, nombre,
   `sesionUid`, dispositivo, fecha) y queda en `brilloBitacora`
   (no se puede editar ni borrar).

**Límite conocido (aceptado por ahora):** como las 8 personas comparten
la cuenta, el servidor no puede comprobar quién tecleó el PIN. El PIN
evita que un compañero firme por otro desde la pantalla normal, pero no
frena a alguien con conocimientos técnicos. Si algún día hace falta
trazabilidad que valga en una disputa, se puede reforzar sin cambiar el
modelo de datos más allá de la firma.

---

## 6. Apps multiplataforma

Las apps **no empaquetan la página**: cargan las pantallas propias de
BRILLO desde `brillo/`. La página web sigue siendo el portal de
emprendedoras, líderes y clientas.

### 6.1 Escritorio — Tauri v2 (`brillo/apps/escritorio/`)

- `.exe` de la PC de caja, abre directo en el POS.
- **Impresora térmica:** comando Rust que genera ESC/POS y lo manda a la
  impresora (USB/serie o RAW al spooler de Windows).
- **Lector de código de barras USB:** funciona como teclado; se detectan
  ráfagas de teclas terminadas en Enter y se busca el código en
  `brilloProductosExtra`. No necesita código nativo.
- Compilar el `.exe` requiere Windows (o CI con `windows-latest`).

### 6.2 Tablet — Capacitor (`brillo/apps/tablet/`)

- `.apk`/`.ipa` del piso de venta, interfaz táctil.
- El `.ipa` requiere macOS + Xcode.

### 6.3 Firebase en las apps

- Mismo proyecto que la página, con su propia inicialización del SDK
  (empaquetado, no por CDN, para que la caja abra sin internet).
- **Cobro sin internet:** Firestore con persistencia local encola las
  ventas y las sube al volver la red; los folios se generan por
  dispositivo (`prefijoFolio` + consecutivo).
- Agregar en **Authentication → Dominios autorizados**: `tauri.localhost`
  y `localhost` (configuración de Firebase, no archivo de la página).

---

## 7. BRILLO como reemplazo de Aronium

| Función de Aronium | En BRILLO | Tipo |
|---|---|---|
| Cobro en caja | POS en escritorio/tablet | `Venta` (`origen: 'pos'`) |
| Ticket impreso | Impresora térmica vía Tauri | `Venta.folio` |
| Inventario físico | Historial de movimientos (ver §3) | `MovimientoInventario` |
| Apertura y corte de caja | Turno por dispositivo | `TurnoCaja` |
| Historial de ventas | Historial migrado + ventas nuevas | `Venta`, `ImportacionAronium` |
| Reporte de ventas y comisiones | Reporte por periodo | `ReporteVentasPeriodo` |

### 7.1 Sin facturación electrónica

No hay CFDI. El reporte que hoy sale de Aronium se reemplaza con
`ReporteVentasPeriodo`, dentro de la app de BRILLO: ventas totales,
ingresos por efectivo/tarjeta/transferencia con sus referencias,
depósitos, comisiones pagadas por líder y diferencias de cortes de caja.
Al cerrar un periodo se guarda una copia fija en `brilloReportesVentas`.
(Depósitos de apartado y comisiones pagadas se **leen** de la página.)

### 7.2 Número de referencia obligatorio

- Un pago con tarjeta o transferencia en BRILLO no se guarda sin su
  referencia (`PagoConReferencia.referencia` es obligatorio).
- `brilloReferenciasPago/{metodo}_{referencia}` evita capturar dos veces
  la misma referencia: la caja avisa en qué folio se usó.
- Pagos anteriores sin referencia (Aronium) quedan como `PagoHistorico`.

### 7.3 Migración completa del historial

`brillo/scripts/importar-aronium.ts` procesa tres exportaciones de
Aronium (Excel/CSV), en lotes revisables (`ImportacionAronium`) que no se
duplican al reimportar:

1. **Productos y existencias** — a `brilloProductosExtra` y movimientos
   `carga_inicial`. Dar de alta productos en `productos` es escribir en
   la página: queda sujeto a la decisión de §3.
2. **Emprendedoras** — solo se **empatan** con `personas` de la página
   (por teléfono o nombre) para ligar las ventas; no se crean cuentas.
3. **Ventas** — a `brilloVentas` con `origen: 'importada_aronium'`.

Para que el historial cuente en comisiones y recompensas hace falta la
tercera fila de la tabla de §3.

---

## 8. Pendientes

**De autorización (tocan la página):**

1. Build de la página y `brillo/` (§2): opción A o B, y cómo se publica la página.
2. Stock y apartados (§3): ¿la página puede pasar a guardar solo lo que cambió?
3. Comisiones y recompensas (§3): ¿la página puede leer `brilloVentas`?
4. Reglas de Firestore para `brillo*` (§3): bloques nuevos en `firestore.rules` o base de datos aparte.

**De información:**

5. Un archivo de ejemplo de cada exportación de Aronium (productos,
   clientas, ventas), y si la de ventas trae detalle por artículo.
6. Desde qué fecha migrar las ventas.
