# Auditoría de preparación para Firebase Auth + Firestore

Fecha de revisión: 2026-09-09

## Alcance y conclusión ejecutiva

Se revisaron las 44 páginas HTML y los 73 módulos JavaScript del portal, incluyendo páginas públicas, login y los portales de Emprendedora, Líder, Staff, RH y Administración. No se conectó Firebase ni se modificó la interfaz visual.

**Conclusión:** el portal tiene una interfaz reutilizable y varios modelos de dominio con funciones de lectura, validación, escritura e historial, pero **no está listo para conectar Firebase de forma segura**. La razón principal no es visual: la fuente de datos está distribuida entre constantes `*_EJEMPLO`, semillas dentro de modelos y claves independientes de `localStorage`. Al reemplazar una de ellas por Firestore, otras seguirían sembrando o leyendo datos demo.

Actualmente no existe Firebase SDK, configuración de Firebase, Firebase Auth, listener de sesión, guardia de rutas ni regla de Firestore. El login solo enlaza directamente a cinco portales y declara explícitamente que es una vista de prueba en [login.html](login.html#L39).

## Inventario de datos demo y persistencia temporal

### Semillas explícitas

| Dominio | Archivos demo/modelo principales | Datos encontrados |
|---|---|---|
| Catálogo público | [js/catalogo-productos-ejemplo.js](js/catalogo-productos-ejemplo.js#L1), [js/productos-ejemplo.js](js/productos-ejemplo.js#L1), [js/catalogo-modelo.js](js/catalogo-modelo.js#L1) | Productos, categorías, materiales, colores y descuentos |
| Catálogo Staff/RH/Admin | [js/staff-catalogo-ejemplo.js](js/staff-catalogo-ejemplo.js#L1), `staff-catalogo.js`, `rh-catalogo.js`, `admin-catalogo.js` | Usuarios, productos y filtros; comparten `mw_staff_catalogo_demo` |
| Personas | [js/personas-ejemplo.js](js/personas-ejemplo.js#L1) | Emprendedoras, líderes, perfiles, rangos, estadísticas y relaciones |
| Cuentas internas | [js/cuentas-internas-modelo.js](js/cuentas-internas-modelo.js#L1) | Staff, RH y Admin con usuario y contraseña de prueba |
| Nómina | [js/nomina-modelo.js](js/nomina-modelo.js#L1) | Empleados, conceptos, periodos, filas, ajustes, solicitudes y estados |
| Apartados | [js/apartados-ejemplo.js](js/apartados-ejemplo.js#L1), [js/staff-apartados-ejemplo.js](js/staff-apartados-ejemplo.js#L1), [js/apartados-modelo.js](js/apartados-modelo.js#L1) | Ventana de depósito, piezas, créditos, clientes y datos bancarios |
| Actividades Staff | [js/actividades-staff-modelo.js](js/actividades-staff-modelo.js#L1) | Catálogo, asignaciones, sorteo y bitácora de estados |
| Lista de deseos/resurtido | [js/deseos-ejemplo.js](js/deseos-ejemplo.js#L1), [js/lista-deseos-modelo.js](js/lista-deseos-modelo.js#L1) | Solicitudes, piezas, resurtidos e historial |
| Solicitudes | [js/solicitudes-modelo.js](js/solicitudes-modelo.js#L1), `solicitudes-ui.js` | Alta/baja, inscripción, aprobación, rechazo y notificaciones |
| Comisiones | [js/comisiones-modelo.js](js/comisiones-modelo.js#L1), [js/lider-cuenta-ejemplo.js](js/lider-cuenta-ejemplo.js#L1) | Ajustes, historial, pagos, bonos, porcentajes y borradores |
| Calendario/eventos | [js/eventos-ejemplo.js](js/eventos-ejemplo.js#L1), [js/eventos-modelo.js](js/eventos-modelo.js#L1), `calendario-tabla-ejemplo.js` | Eventos y usuarios de autorización |
| Notificaciones | [js/notificaciones-ejemplo.js](js/notificaciones-ejemplo.js#L1), [js/notificaciones-modelo.js](js/notificaciones-modelo.js#L1) | Bandejas por rol, lectura, enlace y destinatario |
| Cuenta y equipo | [js/cuenta-ejemplo.js](js/cuenta-ejemplo.js#L1), [js/lider-cuenta-ejemplo.js](js/lider-cuenta-ejemplo.js#L1), [js/equipo-ejemplo.js](js/equipo-ejemplo.js#L1) | Perfil, rifa, constancia, equipo y comisiones |
| Configuración/auditoría | [js/configuracion-modelo.js](js/configuracion-modelo.js#L1), [js/auditoria-modelo.js](js/auditoria-modelo.js#L1) | Versiones de configuración, borradores y bitácora |

### Claves de `localStorage` detectadas

Se encontraron persistencias simuladas para `personas`, `cuentas-internas`, catálogo, apartados, créditos, actividades, auditoría, eventos, comisiones, configuración, nómina, solicitudes, lista de deseos, resurtido y notificaciones. El patrón común es `obtener...()` -> intentar `JSON.parse(localStorage...)` -> si no hay datos, construir una semilla -> guardar la semilla. Ejemplos representativos: [js/personas-ejemplo.js](js/personas-ejemplo.js#L189), [js/nomina-modelo.js](js/nomina-modelo.js#L78), [js/lista-deseos-modelo.js](js/lista-deseos-modelo.js#L52) y [js/notificaciones-modelo.js](js/notificaciones-modelo.js#L28).

Este patrón es útil para el prototipo, pero es incompatible con el requisito de exclusividad de datos reales si no se reemplaza por una fuente única con modos explícitos.

## A. LISTO PARA FIREBASE

No hay páginas listas para producción Firebase Auth + Firestore. Sí hay piezas **reutilizables como presentación o contrato de dominio**:

- Las páginas usan una sola interfaz por módulo y por rol; no existen copias `*-firebase.html`.
- Las tablas, tarjetas, filtros y modales reciben resultados de funciones de renderizado, por lo que la presentación puede conservarse si se conserva el shape de cada DTO.
- Muchos módulos ya tienen operaciones nombradas (`obtener`, `crear`, `editar`, `actualizarEstado`, `guardar`) que pueden convertirse en repositorios sin rehacer el HTML.
- Hay validaciones de dominio y estados internos en listas de deseos, resurtidos, actividades, nómina, comisiones y solicitudes.
- Hay historial append-only conceptual para auditoría, estados de nómina, actividades y lista de deseos.
- Las relaciones más importantes ya tienen intención de usar IDs, por ejemplo `personaId`, `liderId`, `listaDeseosId` y `empleadoNominaId`; deben eliminarse los fallbacks por nombre.
- Los reportes/PDF se construyen desde plantillas DOM en [portal/admin/admin-actividad-staff.html](portal/admin/admin-actividad-staff.html#L236) y scripts como `admin-actividad-staff.js`, `admin-nomina.js` y `admin-comisiones.js`. Su diseño puede mantenerse si reciben DTOs normalizados.

Esto significa que la migración puede ser incremental por repositorios, pero no que la conexión consista en cambiar una clave de almacenamiento.

## B. NECESITA AJUSTES

### 1. Fuente de datos y ciclo de carga

Falta un módulo único, por ejemplo `js/data-source.js`, con contratos como:

```js
const MODO_DEMO = true;
const dataSource = MODO_DEMO ? demoSource : firestoreSource;
```

Cada método debe resolver `{ status: 'loading' | 'ready' | 'empty' | 'error', data, error }` o un equivalente consistente. La página no debe llamar directamente a una semilla ni mostrarla mientras la consulta real está pendiente. Hoy no existe el estado `loading` y los modelos siembran datos al leer.

La fuente demo debe estar aislada en un módulo y solo el selector debe conocer `MODO_DEMO`. Los controladores de página no deben importar o consultar `*_EJEMPLO` directamente.

### 2. Autenticación y perfil

[js/cuentas-internas-modelo.js](js/cuentas-internas-modelo.js#L1) mezcla cuenta, contraseña, nombre, teléfono, correo, rol y acceso en un registro demo. Además [js/personas-ejemplo.js](js/personas-ejemplo.js#L22) guarda contraseñas dentro de perfiles. Con Firebase:

- Auth debe ser la única fuente de `uid`, email/password, sesión y estado de autenticación.
- Firestore debe guardar `users/{uid}` o `personas/{uid}` con nombre, teléfono, rol, número de cuenta, relaciones y estado de negocio.
- Nunca se debe leer, mostrar ni guardar la contraseña actual en Firestore.
- Los documentos actuales deben migrarse a `uid` real; `me-emprendedora`, `me-lider`, `staff01`, etc. solo sirven como IDs demo.

### 3. Guardias y roles

El login actual permite navegar por URL sin autenticación. No se encontró listener `onAuthStateChanged`, validación de rol en entrada ni control de acceso real. Ocultar botones no protege datos ni escrituras.

Debe haber una guardia común que espere la sesión, cargue el perfil por `uid`, verifique `rol` y redirija si no coincide. Las acciones sensibles también deben validar permisos en la capa de datos y en reglas de Firestore. Roles mínimos: `staff`, `rh`, `admin`, `emprendedora`, `lider`.

### 4. IDs y relaciones

Hay muchos IDs fabricados con `Date.now()` o `Date.now()+Math.random()`: eventos, notificaciones, auditoría, actividades, productos, solicitudes, piezas, cuentas internas, empleados y conceptos. Ejemplos: [js/actividades-staff-modelo.js](js/actividades-staff-modelo.js#L157), [js/lista-deseos-modelo.js](js/lista-deseos-modelo.js#L96), [js/nomina-modelo.js](js/nomina-modelo.js#L110) y [js/solicitudes-modelo.js](js/solicitudes-modelo.js#L100).

En Firestore el ID debe ser `doc.id` o un ID generado por Firestore. Las acciones deben llevar ese valor en `data-id` y no reconstruirlo desde nombre, usuario o fila visual.

Hay un fallback especialmente frágil en actividades: [js/actividades-staff-modelo.js](js/actividades-staff-modelo.js#L224) relaciona una cuenta con nómina por nombre si no existe `empleadoNominaId`. Debe ser una relación obligatoria por ID y fallar con mensaje si está rota.

### 5. Fechas y estados

El código usa una mezcla de ISO strings, `YYYY-MM-DD`, fechas escritas en las semillas y `Date.now()`. Ejemplos de formateo manual en [js/portal-common.js](js/portal-common.js#L207) y cálculos semanales en [js/actividades-staff-modelo.js](js/actividades-staff-modelo.js#L185).

Debe existir `toDateSafe(value)` que acepte Firestore `Timestamp`, `Date`, ISO y fecha de negocio solo en los límites del adaptador. El dominio debe trabajar con fechas normalizadas y la vista debe ser la única que formatea.

Los estados internos están mejor encaminados en modelos nuevos, pero no son uniformes entre módulos: personas usa `activa/inactiva/baja`, nómina usa `activo/inactivo`, y varios mapas exponen directamente etiquetas con mayúsculas. Definir enums/keys canónicas en un módulo compartido y mapas de presentación separados.

### 6. Formularios y escrituras

La mayoría de formularios sí modifican `localStorage`, pero eso no equivale a persistencia real ni a transacción. Los cambios de teléfono/foto en [js/portal-common.js](js/portal-common.js#L140) son explícitamente simulados y no se guardan. El catálogo, calendario, cuentas, nómina, apartados y solicitudes crean registros localmente y deben cambiar a `addDoc`, `setDoc`, `updateDoc` o transacciones según el caso.

Cada escritura debe seguir: validar DTO -> comprobar rol -> persistir -> volver a consultar o actualizar el estado con la respuesta persistida -> renderizar. Los errores de escritura deben conservarse en la interfaz y no dejar una fila optimista falsa.

### 7. Vacíos, errores y datos incompletos

Hay `|| []`, `|| {}` y accesos directos a propiedades en muchos renderizadores. Eso evita algunos errores, pero no existe un contrato global para `undefined`, `null`, `NaN`, campos opcionales, cero resultados ni error de consulta. Deben añadirse estados vacíos por tabla/lista y normalizadores por módulo antes de interpolar HTML.

## C. RIESGO DE DATOS DEMO

Riesgo **crítico** si se conecta Firestore sin refactor:

1. `notificaciones-modelo.js`, `lista-deseos-modelo.js`, `personas-ejemplo.js`, `nomina-modelo.js`, `actividades-staff-modelo.js` y otros modelos reconstruyen semillas cuando la clave local está vacía.
2. [js/portal-common.js](js/portal-common.js#L63) cae a `NOTIFICACIONES_EJEMPLO` si el modelo compartido no existe y [js/portal-common.js](js/portal-common.js#L222) renderiza `EVENTOS_EJEMPLO` directamente.
3. Varias páginas cargan simultáneamente `notificaciones-ejemplo.js` y `notificaciones-modelo.js`; cargar el modelo no impide que el fallback estático exista.
4. `staff-catalogo.js`, `rh-catalogo.js`, `admin-catalogo.js` comparten una clave demo y leen el array inicial si no hay almacenamiento, por lo que un catálogo real no sustituiría automáticamente todos los consumidores.
5. `apartados.js` inicializa el estado desde `APARTADOS_EJEMPLO` y `VENTANA_EJEMPLO`; no espera una consulta externa.
6. Cuenta, líder, equipo y paneles de roles usan constantes `*_EJEMPLO` sin una capa de fuente real.
7. La ruta login no autentica y permite acceder a vistas con datos demo directamente.

La condición obligatoria para producción debe ser: `MODO_DEMO === false` no importa ningún dato demo, no ejecuta fallback a semillas y un resultado vacío de Firestore devuelve `[]`, no datos iniciales.

## D. RIESGO DE INTEGRIDAD

- **IDs duplicados o no estables:** `Date.now()` puede colisionar en escrituras rápidas y no representa el ID del documento.
- **Pérdida por read-modify-write:** casi todos los modelos cargan un array completo, mutan y vuelven a guardar. Dos usuarios pueden sobrescribirse. Firestore requiere operaciones por documento, transacciones o `arrayUnion` donde proceda.
- **Historial no atómico:** cambio de estado y registro de auditoría se guardan en operaciones separadas. Deben ser batch/transaction cuando deban ser inseparables.
- **Relaciones incompletas:** deseos guarda `personaId` pero también un snapshot de nombre; actividades puede caer a nombre; nómina y cuentas mantienen registros separados y solo parcialmente vinculados.
- **Productos no normalizados:** algunas solicitudes guardan `producto` como texto y no `productoId`/`varianteId`; no se podrá garantizar que el resurtido apunte al producto real.
- **Fechas como texto:** ordenar o filtrar strings con formatos distintos puede producir resultados incorrectos y no permite consultas eficientes por rango.
- **Contraseña expuesta:** los ejemplos contienen contraseñas literales y la API `verificarCredencialInterna` las compara desde almacenamiento del navegador. Esto debe desaparecer completamente con Auth.
- **Borrado vs baja:** la intención de conservar historial es correcta, pero `eliminarPersona` y `eliminarCuentaInterna` borran documentos locales. En backend debe definirse baja lógica y solo permitir borrado administrativo explícito, con referencias/historial protegidos.
- **PDF con datos de pantalla:** los reportes se generan a partir del DOM. Deben recibir un snapshot DTO validado, no depender de que una tabla haya terminado de renderizar ni de nombres visibles.

## E. RIESGO DE PERMISOS

Los controladores suelen decidir qué botones mostrar y algunos modelos validan el rol recibido por parámetro, pero ese parámetro también puede ser fabricado desde el navegador. No es seguridad.

| Operación | Roles esperados | Protección requerida |
|---|---|---|
| Catálogo y precios | Staff/RH/Admin según escritura | Lectura pública solo si corresponde; escritura por rol y auditoría |
| Apartados y confirmaciones de pago | Emprendedora/Líder, Staff, RH, Admin según transición | Transición de estado en backend; comprobar propietario y documento relacionado |
| Nómina | RH prepara; Admin valida/paga | Reglas por rol y transacciones; salarios nunca públicos |
| Comisiones/bonos | Líder consulta; Admin calcula/ajusta/paga | Cálculo y montos confiables solo en backend o callable protegido |
| Alta/baja e inscripción | Staff/RH solicita; Admin aprueba | Auth + perfil + historial; no crear acceso solo con un objeto cliente |
| INE/documentos | Usuario dueño, RH/Admin autorizado | Storage protegido, no campos públicos ni URLs abiertas |
| Configuración/usuarios | Admin | Custom claims o perfil verificado más reglas; nunca solo botones ocultos |
| Auditoría | Escritura automática; lectura Admin | Append-only; el cliente no debe poder borrar ni falsear autor |

## F. ESTRUCTURA FIRESTORE NECESARIA

La siguiente propuesta conserva los módulos y formas de la interfaz, pero sustituye arrays completos por documentos identificables:

```text
users/{uid}
  uid, email, rol, estadoAcceso, personaId, empleadoId, createdAt, updatedAt

personas/{personaId}
  authUid, tipo, nombre, apellidos, telefono, correo, numeroCuenta,
  liderId, invitadaPorId, categoria, estado, fechaAlta, rangoActualKey,
  constancia, rifa, stats, ascensoPendiente, recompensaPendiente

empleados/{empleadoId}
  authUid, numeroEmpleado, nombreSnapshot, cargo, fechaInicio, fechaBaja,
  salarioBase, pagoHoraExtra, estado, metodoPago, fotoPath

productos/{productoId}
  sku, nombre, descripcion, categoria, material, calidad, color, precio,
  existencias, activo, imagenPaths, createdAt, updatedAt

apartados/{apartadoId}
  personaId, liderId, piezas[], total, estado, ventanaId, fechaInicio,
  fechaVencimiento, metodoPago, comprobantes[], createdAt, updatedAt

ventanasApartado/{ventanaId}
  nombre, iniciaAt, terminaAt, estado, configuradoPorId

actividadesCatalogo/{actividadId}
  nombre, zona, periodicidad, activo, createdAt, updatedAt

actividadesStaff/{actividadId}
  semanaKey, actividadCatalogoId, empleadoId, zona, periodicidad, dias,
  estado, enteradoAt, firmadoAt, firmadoPorId, createdAt, updatedAt

historialActividadesStaff/{historialId}
  actividadId, estadoAnterior, estadoNuevo, encargadoAnteriorId,
  encargadoNuevoId, usuarioId, createdAt

listaDeseos/{solicitudId}
  destinatario, personaId, piezas[{productoId, varianteId, cantidad, observaciones}],
  estado, creadoPorId, creadoPorRol, fechaCreacion, comentarioEstado

solicitudesResurtido/{solicitudId}
  productoId, varianteId, cantidadSugerida, comentario, estado,
  solicitadoPorId, fechaSolicitud, observaciones[]

solicitudes/{solicitudId}
  tipo, solicitanteId, personaPropuestaId, estado, datosSolicitud,
  revisadoPorId, revisadoAt, motivo, createdAt, updatedAt

nominaConceptos/{conceptoId}
  nombre, tipo, activo, fijo, createdAt, updatedAt

nominaPeriodos/{periodoId}
  iniciaAt, terminaAt, estado, preparadoPorId, validadoPorId, pagadoAt,
  totalPercepciones, totalDeducciones, totalNeto, createdAt, updatedAt

nominaPeriodos/{periodoId}/empleados/{empleadoId}
  conceptos[], percepciones, deducciones, neto, estado, observaciones

comisiones/{comisionId}
  liderId, periodoKey, niveles[], porcentajesSnapshot, subtotal, bonos,
  iva, total, estado, calculadoAt, aprobadoPorId, pagadoAt

configuracion/{configId}
  version, plan, comisiones, apartados, notificaciones, sistema, createdAt,
  createdById, vigente

eventos/{eventoId}
  titulo, descripcion, iniciaAt, terminaAt, hora, lugar, activo, createdAt

notificaciones/{notificacionId}
  paraId, rolDestino, tipo, mensaje, link, leida, registroRelacionadoTipo,
  registroRelacionadoId, createdAt, leidaAt

auditoria/{auditoriaId}
  modulo, accion, registroTipo, registroId, usuarioId, rol, descripcion,
  before, after, createdAt
```

Reglas generales: usar `createdAt/serverTimestamp()` y `updatedAt/serverTimestamp()`, guardar IDs en relaciones, mantener snapshots de nombre solo para historial/presentación, y no duplicar contraseñas ni secretos.

### Consultas que deberán paginarse

Emprendedoras/líderes, productos, apartados, nómina, comisiones, actividades, solicitudes, auditoría, historial y notificaciones pueden crecer sin límite. Deben usar `limit`, `orderBy`, cursores `startAfter` y filtros en Firestore. Catálogo y calendarios pueden empezar con una consulta limitada, pero no deben asumir que toda la colección cabe en memoria.

## G. CAMBIOS NECESARIOS ANTES DE CONECTAR FIREBASE

1. Crear `data-source.js`/repositorios por dominio y un `MODO_DEMO` único. El modo real debe prohibir cualquier fallback demo.
2. Mover todas las semillas a un directorio demo aislado y dejar de cargarlas desde las páginas cuando `MODO_DEMO` sea falso.
3. Normalizar los DTO de cada módulo: campos obligatorios, opcionales, estados, IDs y fechas.
4. Implementar `auth-service.js`: login real, logout, `onAuthStateChanged`, sesión pendiente, usuario autenticado y rol.
5. Separar `users/{uid}` de `personas/{personaId}` y `empleados/{empleadoId}`. Eliminar contraseñas de perfiles y demos que puedan llegar a producción.
6. Implementar guardias de rol por página y validación de autorización antes de cada escritura sensible.
7. Reemplazar IDs de `Date.now()` por IDs de documento Firestore y propagar esos IDs en `data-id`, modales, botones, enlaces y reportes.
8. Reemplazar relaciones por nombre por `personaId`, `liderId`, `empleadoId`, `productoId`, `solicitudId` y `usuarioId`; eliminar el fallback por nombre de actividades.
9. Crear utilidades de fecha para `Timestamp`, `Date` e ISO únicamente en la frontera; cambiar filtros y cálculos a fechas normalizadas.
10. Unificar estados internos en keys minúsculas y separar `label`/clase CSS en mapas de presentación.
11. Añadir estados `loading`, `empty` y `error` a todas las tablas, tarjetas, dashboard, notificaciones, calendario y páginas de cuenta. Mientras carga Firebase no debe renderizar demo.
12. Migrar escrituras de arrays a documentos individuales, batches y transacciones donde haya estado + historial + notificación.
13. Diseñar índices Firestore para filtros por rol/usuario, estado, periodo, fecha, semana, producto y relaciones.
14. Cambiar notificaciones a consultas por `paraId` y `rolDestino`, con `leidaAt` y `registroRelacionadoId`; nunca mostrar la bandeja completa por rol solamente.
15. Hacer que PDFs y reportes reciban DTOs reales ya cargados, incluyendo periodo, empleados, niveles, encargados y estados, sin leer nombres del DOM como fuente de verdad.
16. Agregar pruebas de contrato para cada repositorio: cero registros, uno, muchos, campos opcionales, Timestamp, error, permisos y no mezcla demo/real.
17. Probar explícitamente `MODO_DEMO=true` y `MODO_DEMO=false` con colecciones vacías. El segundo caso debe mostrar vacío, nunca sembrar registros.
18. Definir migración de datos demo fuera del cliente, asignando IDs reales y eliminando campos de contraseña antes de cargar cualquier colección.

## Prueba de aceptación

Antes de declarar la integración terminada, para cada módulo debe poder ejecutarse este flujo:

```text
MODO_DEMO = true  -> misma interfaz + semillas aisladas
MODO_DEMO = false -> Auth real + Firestore real + solo documentos reales
colección vacía   -> estado vacío, sin semillas
consulta lenta    -> estado de carga, sin flash demo
error de consulta -> estado de error y reintento
acción sensible   -> rol válido + ID real + escritura persistida + auditoría
```

El criterio final es visual y de datos: una misma página y los mismos componentes deben renderizar exactamente la misma estructura, pero en modo real solo con documentos de Firestore y con reglas de seguridad activas.