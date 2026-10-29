// MW JOYERIA - Modelo compartido de ventanas de apartado
//
// FASE 2 (Firebase): la persistencia real (Firestore si hay config, si
// no localStorage) vive en js/apartados-firestore-sync.js, cargado
// justo antes que este archivo — ver la sección PERSISTENCIA más abajo.
// Todo lo demás en este archivo (reglas de negocio, ciclo de vida) es
// exactamente igual que antes, síncrono.
//
// LÓGICA DEL DEPÓSITO (ventana de apartado):
// El depósito de $50+ respalda TODA la ventana (no una pieza
// individual) — se registra una sola vez al abrir y solo se resuelve
// (aplicarlo a una compra, o guardarlo como crédito) cuando la ventana
// se queda sin NINGUNA pieza activa, sea porque se liquidaron todas o
// porque se canceló el apartado completo.
// - Se registra una sola vez al abrir la ventana (o se reutiliza un
//   crédito guardado de una ventana anterior de la misma persona). El
//   plazo de vencimiento empieza a correr desde que se confirma el
//   depósito, no desde que se solicitó la pieza.
// - Mientras existan piezas activas, el depósito no se toca (salvo el
//   excedente sobre $50, que se puede aplicar antes de liquidar nada —
//   ver aplicarExcedenteDeposito).
// - CARRITO: liquidarPiezasSeleccionadas permite pagar una o varias
//   piezas activas elegidas SIN cerrar la ventana, mientras queden
//   otras piezas activas sin pagar — el depósito sigue intacto y el
//   vencimiento no cambia (decisión de negocio: antes el apartado solo
//   se podía liquidar completo de un jalón). Si la selección cubre
//   TODAS las piezas activas que quedaban, se comporta exactamente
//   igual que liquidar el apartado completo siempre hizo: pregunta qué
//   hacer con el depósito y cierra la ventana (Staff/Encargado/Admin
//   le pasan los ids de TODAS las piezas activas para ese caso).
// - CANCELAR el apartado sigue siendo todo o nada (no hay "cancelar
//   una pieza suelta") — nunca aplica el depósito a una compra, lo
//   guarda como crédito automáticamente, sin preguntar.
// - Que la ventana llegue a su fecha de vencimiento NO pierde nada
//   automáticamente: solo se muestra como "vencida" (piezas y
//   depósito intactos, se puede seguir liquidando con normalidad).
//   El depósito solo se pierde si Staff decide "Desapartar" — después
//   de contactar por Whatsapp y no obtener respuesta — que cancela
//   las piezas activas restantes y pierde el depósito por completo.

let DEPOSITO_BASE = 50;
// Las foráneas depositan más para empezar a apartar (su ventana dura
// más días). Admin → Configuración también es dueña de este valor.
let DEPOSITO_FORANEA = 200;

const CATEGORIAS_APARTADO = {
  normal: { etiqueta: 'Normal', dias: 3, requiereDeposito: true },
  foranea: { etiqueta: 'Foránea', dias: 15, requiereDeposito: true },
  vip: { etiqueta: 'VIP', dias: null, requiereDeposito: false, requiereAprobacion: true }
};

// Admin → Configuración es dueña de estos tres valores (ver
// js/configuracion-modelo.js). Si esa página está cargada aquí, se usan
// sus valores vigentes hoy; si no, esta página sigue igual que siempre.
// Solo aplica a ventanas NUEVAS — una ventana ya abierta conserva la
// fecha de vencimiento que ya se le calculó.
if (typeof obtenerValorVigente === 'function') {
  const depositoConfigurado = obtenerValorVigente('apartado', 'deposito_base');
  if (typeof depositoConfigurado === 'number') DEPOSITO_BASE = depositoConfigurado;

  const depositoForaneaConfigurado = obtenerValorVigente('apartado', 'deposito_foranea');
  if (typeof depositoForaneaConfigurado === 'number') DEPOSITO_FORANEA = depositoForaneaConfigurado;

  const diasNormalConfigurado = obtenerValorVigente('apartado', 'ventana_normal_dias');
  if (typeof diasNormalConfigurado === 'number') CATEGORIAS_APARTADO.normal.dias = diasNormalConfigurado;

  const diasForaneaConfigurado = obtenerValorVigente('apartado', 'ventana_foranea_dias');
  if (typeof diasForaneaConfigurado === 'number') CATEGORIAS_APARTADO.foranea.dias = diasForaneaConfigurado;
}

// Depósito mínimo para empezar a apartar según la etiqueta de la
// cuenta (Normal/Foránea). VIP no deposita, pero si llegara a dejar
// algo se trata como el de una Normal.
function depositoMinimoCategoria(categoria) {
  return categoria === 'foranea' ? DEPOSITO_FORANEA : DEPOSITO_BASE;
}

function depositoMinimoVentana(ventana) {
  return depositoMinimoCategoria(ventana && ventana.categoria);
}

// Estados de la VENTANA (no de cada pieza).
const ESTADOS_VENTANA_MODELO = {
  pendiente_deposito: 'Pendiente de depósito',
  pendiente_aprobacion: 'Pendiente de aprobación VIP',
  activa: 'Ventana activa',
  vencida: 'Vencida — depósito perdido',
  cerrada: 'Cerrada'
};

// Estados de cada PIEZA dentro de una ventana.
const ESTADOS_PIEZA_MODELO = {
  activa: 'Activa',
  liquidada: 'Liquidada',
  cancelada: 'Cancelada'
};

const METODOS_PAGO_MODELO = {
  transferencia: 'Transferencia',
  local: 'Pago en local'
};

function obtenerReglaCategoria(categoria) {
  return CATEGORIAS_APARTADO[categoria] || CATEGORIAS_APARTADO.normal;
}

function sumarPagos(pagos = []) {
  return pagos.reduce((total, pago) => total + Number(pago.monto || 0), 0);
}


// ============================================================
// PERSISTENCIA
// ============================================================
//
// FASE 2 (Firebase): estas cuatro funciones son envoltorios SÍNCRONOS
// sobre la caché en memoria de js/apartados-firestore-sync.js
// (APARTADOS_CACHE/CREDITOS_CACHE) — ese archivo se carga ANTES que
// este y hace la lectura/escritura real (Firestore si hay config real,
// localStorage si no), de forma asíncrona. Por eso el resto de este
// archivo (y todos sus callers) puede seguir llamándolas como si
// fueran síncronas, sin ningún otro cambio.

function obtenerVentanasApartado() {
  return APARTADOS_CACHE;
}

function guardarVentanasApartado(ventanas) {
  guardarVentanasRepo(ventanas);
}

function obtenerCreditosApartado() {
  return CREDITOS_CACHE;
}

function guardarCreditosApartado(creditos) {
  guardarCreditosRepo(creditos);
}

function obtenerCreditoDisponible(usuarioId) {
  const creditos = obtenerCreditosApartado();
  return Number(creditos[usuarioId] || 0);
}

function establecerCredito(usuarioId, monto) {
  const creditos = { ...obtenerCreditosApartado() };
  if (monto > 0) {
    creditos[usuarioId] = monto;
  } else {
    delete creditos[usuarioId];
  }
  guardarCreditosApartado(creditos);
}


// ============================================================
// CREAR ENTIDADES
// ============================================================

function crearApartadoPieza(datos = {}) {
  const total = Number(datos.total ?? datos.precio ?? 0);
  return {
    id: datos.id || `PIEZA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    productoId: datos.productoId || '',
    varianteId: datos.varianteId || '',
    producto: datos.producto || '',
    variante: datos.variante || '',
    // Color de oro del producto al momento de apartar — mismo criterio
    // que "material" abajo: se congela aquí porque ya no vive en la
    // variante (ver catalogo-variantes-modelo.js) y es la única forma en
    // que Staff/Encargado/Admin lo ven al revisar un apartado ya hecho.
    colorOro: datos.colorOro || '',
    // Material del producto al momento de apartar (Sección 4) — es la
    // base real para saber si esta pieza es Souvenir o normal; nunca
    // se recalcula después, aunque el producto cambie de categoría.
    material: datos.material || null,
    precio: total,
    total,
    pagos: Array.isArray(datos.pagos) ? datos.pagos : [],
    saldo: Math.max(0, total - sumarPagos(datos.pagos)),
    estado: datos.estado || 'activa',
    fechaSolicitud: datos.fechaSolicitud || new Date().toISOString()
  };
}

// LOG-06 de la auditoría: separa el depósito en dos partes — el PISO
// ($50, o $200 si es foránea — ver depositoMinimoVentana; congelado,
// solo se resuelve al cerrar la ventana por completo, igual que
// siempre) y el EXCEDENTE sobre el piso (utilizable en cualquier
// pago mientras la ventana sigue activa — ver aplicarExcedenteDeposito).
// depositoApartadoDisponible se conserva como el TOTAL (piso+excedente)
// — varias pantallas ya lo muestran o comparan contra 0 — pero ya nunca
// se asigna directo: siempre se deriva aquí a partir de los otros dos,
// para que ambos números nunca queden desincronizados del total.
function fijarDepositoVentana(ventana, montoTotal) {
  const total = Number(montoTotal) || 0;
  const minimo = depositoMinimoVentana(ventana);
  ventana.depositoPiso = Math.min(total, minimo);
  ventana.depositoExcedente = Math.max(0, total - minimo);
  ventana.depositoApartadoDisponible = ventana.depositoPiso + ventana.depositoExcedente;
}

function crearVentanaApartado(datos = {}) {
  const regla = obtenerReglaCategoria(datos.categoria);
  const fechaInicio = datos.fechaInicio || new Date().toISOString();
  const ventana = {
    id: datos.id || `VENT-${Date.now()}`,
    usuarioId: datos.usuarioId || '',
    usuarioNombre: datos.usuarioNombre || '',
    telefono: datos.telefono || '',
    categoria: datos.categoria || 'normal',
    fechaInicio,
    fechaVencimiento: regla.dias
      ? new Date(new Date(fechaInicio).getTime() + regla.dias * 24 * 60 * 60 * 1000).toISOString()
      : null,
    metodoDeposito: datos.metodoDeposito || null,
    referenciaDeposito: datos.referenciaDeposito || null,
    estado: datos.estado || (regla.requiereDeposito ? 'pendiente_deposito' : 'activa'),
    resolucionDeposito: datos.resolucionDeposito || null,
    apartados: Array.isArray(datos.apartados) ? datos.apartados : [],
    auditoria: Array.isArray(datos.auditoria) ? datos.auditoria : []
  };
  fijarDepositoVentana(ventana, datos.depositoApartadoDisponible);
  return ventana;
}

// Permite usar el excedente del depósito (lo que pasa de $50) en un
// pago AHORA, mientras la ventana sigue activa — sin esperar a que se
// liquide o cierre por completo. El piso de $50 nunca se toca aquí,
// solo el excedente. Se aplica contra el saldo de las piezas activas,
// en el orden en que aparecen, hasta agotar el excedente o el saldo
// pendiente (lo que pase primero).
function aplicarExcedenteDeposito(ventana, empleado) {
  const disponible = Number(ventana.depositoExcedente || 0);
  if (disponible <= 0) return { ok: false, error: 'No hay excedente de depósito disponible para aplicar.' };

  const piezasActivas = obtenerPiezasActivas(ventana).filter(p => p.saldo > 0);
  if (!piezasActivas.length) return { ok: false, error: 'No hay saldo pendiente en piezas activas para aplicar el excedente.' };

  let restante = disponible;
  const fecha = new Date().toISOString();
  piezasActivas.forEach(pieza => {
    if (restante <= 0) return;
    const aplicado = Math.min(restante, pieza.saldo);
    pieza.pagos.push({ monto: aplicado, tipo: 'excedente_aplicado', metodo: null, referencia: null, fecha });
    pieza.saldo -= aplicado;
    restante -= aplicado;
  });

  const aplicadoTotal = disponible - restante;
  ventana.depositoExcedente = restante;
  ventana.depositoApartadoDisponible = ventana.depositoPiso + ventana.depositoExcedente;

  ventana.auditoria.push(registrarAuditoriaVentana(
    `Excedente de depósito aplicado: $${aplicadoTotal} a saldo pendiente` + (restante > 0 ? ` ($${restante} sin aplicar — ya no quedó saldo pendiente)` : ''),
    empleado
  ));

  return { ok: true, aplicado: aplicadoTotal, restante };
}


// ============================================================
// DATOS DE EJEMPLO — COMPRAS YA LIQUIDADAS (agosto/septiembre 2026)
// ============================================================
//
// Sirve para que Admin → Comisiones y Admin → Plan MW tengan compras
// reales que mostrar (antes de esto no existía ninguna compra
// sembrada y todo se veía en $0). Cubre tres casos reales pedidos:
// - ana-torres (Oro): SÍ alcanza el mínimo de su rango los dos meses.
// - maria-camila-sanchez (Plata): en agosto solo alcanza Plata; en
//   septiembre su equipo ya alcanza Oro — el ascenso se confirma con
//   fecha de septiembre (ver historialLogros en personas-ejemplo.js),
//   así que Comisiones muestra su bono de rango sin pagar ese mes.
// - me-lider (Plata): NO alcanza el mínimo de su rango ningún mes —
//   su equipo se quedó corto a propósito (ver personas-ejemplo.js).
// Cada entrada es una compra normal (material 'oro-laminado', nunca
// souvenir) ya liquidada de un solo pago, fechada en el sub-periodo
// que le corresponde (p1 = día 10, p2 = día 20/22 del mes).
function _compraLiquidadaEjemplo(idx, usuarioId, usuarioNombre, telefono, monto, fechaISO) {
  if (!monto) return null;
  const pieza = crearApartadoPieza({
    id: `PIEZA-EJ-${idx}`,
    producto: 'Pieza de catálogo',
    material: 'oro-laminado',
    total: monto,
    estado: 'liquidada',
    fechaSolicitud: fechaISO,
    pagos: [{ monto, tipo: 'liquidacion', metodo: 'transferencia', referencia: null, fecha: fechaISO }]
  });
  return crearVentanaApartado({
    id: `VENT-EJ-${idx}`,
    usuarioId,
    usuarioNombre,
    telefono,
    categoria: 'normal',
    fechaInicio: fechaISO,
    estado: 'cerrada',
    resolucionDeposito: 'no_aplica',
    apartados: [pieza]
  });
}

function construirVentanasApartadoEjemplo() {

  const FECHA_AGO_P1 = '2026-08-10T15:00:00.000Z';
  const FECHA_AGO_P2 = '2026-08-22T15:00:00.000Z';
  const FECHA_SEP_P1 = '2026-09-10T15:00:00.000Z';
  const FECHA_SEP_P2 = '2026-09-20T15:00:00.000Z';

  // [usuarioId, usuarioNombre, telefono, montoAgoP1, montoAgoP2, montoSepP1, montoSepP2]
  const COMPRAS = [
    // --- Equipo de ana-torres (Oro) — cumple los dos meses ---
    ['ana-torres', 'Ana Torres', '444 111 2233', 1800, 1700, 1900, 2000],
    ['maria-fernanda', 'María Fernanda Gómez Ruiz', '444 123 4567', 4250, 4250, 4250, 4250],
    ['sofia-hernandez', 'Sofía Hernández', '444 234 5678', 4250, 4250, 4250, 4250],
    ['paola-gonzalez', 'Paola González', '444 567 8901', 4250, 4250, 4250, 4250],

    // --- Equipo de maria-camila-sanchez (Plata → Oro en septiembre) ---
    ['maria-camila-sanchez', 'María Camila Sánchez Calles', '444 222 3344', 1600, 1550, 1800, 1700],
    ['valeria-ramirez', 'Valeria Ramírez', '444 345 6789', 1800, 1800, 6500, 6500],
    ['daniela-martinez', 'Daniela Martínez', '444 456 7890', 1600, 1600, 6500, 6500],
    ['regina-flores', 'Regina Flores', '444 901 2345', 1600, 1600, 6500, 6500],
    ['itzel-navarro', 'Itzel Navarro', '444 902 3456', 3500, 3000, 6500, 6500],
    ['karla-torres', 'Karla Torres Beltrán', '444 890 1234', 4000, 4500, 700, 0],
    ['monica-diaz', 'Mónica Díaz', '444 903 4567', 550, 0, 700, 0],
    ['brenda-salazar', 'Brenda Salazar', '444 904 5678', 0, 0, 700, 0],
    ['cynthia-mora', 'Cynthia Mora', '444 905 6789', 0, 0, 700, 0],
    ['leslie-pineda', 'Leslie Pineda', '444 906 7890', 0, 0, 700, 0],
    // andrea-castillo queda inactiva (sin compras) los dos meses.

    // --- Equipo de me-lider (Plata) — NO alcanza el mínimo ningún mes ---
    ['me-lider', 'Líder', '444 987 6543', 800, 600, 900, 1000],
    ['gabriela-vega', 'Gabriela Vega', '444 907 8901', 2000, 1800, 1900, 2100],
    ['renata-campos', 'Renata Campos', '444 908 9012', 1500, 1000, 1200, 1400],
    ['ximena-duarte', 'Ximena Duarte', '444 909 0123', 600, 0, 0, 700]
  ];

  const ventanas = [];
  let idx = 0;

  COMPRAS.forEach(([usuarioId, usuarioNombre, telefono, agoP1, agoP2, sepP1, sepP2]) => {
    [[agoP1, FECHA_AGO_P1], [agoP2, FECHA_AGO_P2], [sepP1, FECHA_SEP_P1], [sepP2, FECHA_SEP_P2]].forEach(([monto, fecha]) => {
      idx++;
      const ventana = _compraLiquidadaEjemplo(idx, usuarioId, usuarioNombre, telefono, monto, fecha);
      if (ventana) ventanas.push(ventana);
    });
  });

  return ventanas;

}

// ============================================================
// CONSULTAS SOBRE UNA VENTANA
// ============================================================

function obtenerPiezasActivas(ventana) {
  return ventana.apartados.filter(p => p.estado === 'activa');
}

function ventanaEstaVencida(ventana, ahora = Date.now()) {
  return !!ventana.fechaVencimiento && ahora >= new Date(ventana.fechaVencimiento).getTime();
}

// Ventana de esta persona a la que se le pueden sumar piezas nuevas:
// una que espera su depósito o la aprobación VIP, o una activa que
// TODAVÍA NO VENCE. Una ventana vencida sigue en estado 'activa' hasta
// que Staff la desaparta (vencer es solo un aviso), así que antes las
// piezas nuevas caían en esa ventana vencida en vez de abrir una nueva.
function buscarVentanaParaApartar(ventanas, usuarioId) {
  return ventanas.find(v => v.usuarioId === usuarioId && (
    v.estado === 'pendiente_deposito' ||
    v.estado === 'pendiente_aprobacion' ||
    (v.estado === 'activa' && !ventanaEstaVencida(v))
  ));
}

// Antes de abrir una ventana nueva: las ventanas vencidas de esta
// persona que ya no tienen piezas activas (todo se pagó o se quitó) se
// cierran, y su depósito pasa a crédito — así la ventana nueva lo
// reutiliza en vez de pedir otro depósito (ver abrirVentanaApartado).
// Las vencidas que todavía tienen piezas sin pagar se quedan como están
// para que Staff contacte o desaparte; la ventana nueva va aparte.
function cerrarVentanasVencidasSinPiezas(ventanas, usuarioId, empleado) {
  const cerradas = [];
  ventanas.forEach((ventana) => {
    if (ventana.usuarioId !== usuarioId || ventana.estado !== 'activa' || !ventanaEstaVencida(ventana)) return;
    if (obtenerPiezasActivas(ventana).length) return;
    const monto = Number(ventana.depositoApartadoDisponible || 0);
    if (monto > 0) {
      establecerCredito(usuarioId, obtenerCreditoDisponible(usuarioId) + monto);
      cerrarVentana(ventana, 'credito');
      ventana.depositoPiso = 0;
      ventana.depositoExcedente = 0;
      ventana.depositoApartadoDisponible = 0;
      ventana.auditoria.push(registrarAuditoriaVentana(`Ventana vencida sin piezas pendientes — depósito de $${monto} guardado como crédito para su nuevo apartado`, empleado));
    } else {
      cerrarVentana(ventana, 'no_aplica');
      ventana.auditoria.push(registrarAuditoriaVentana('Ventana vencida sin piezas pendientes — cerrada al abrir un apartado nuevo', empleado));
    }
    cerradas.push(ventana);
  });
  return cerradas;
}


// ============================================================
// CICLO DE VIDA
// ============================================================

// Abre una ventana nueva para una persona. Si ya tiene crédito
// guardado de una ventana anterior, lo reutiliza automáticamente y la
// ventana queda activa de inmediato (sin pedir depósito físico) —
// siempre que alcance el depósito mínimo de su etiqueta. Si no alcanza
// (ej. $50 de crédito y ahora es foránea, que pide $200), el crédito
// se aplica igual y la ventana espera solo la diferencia.
function abrirVentanaApartado(datosPersona, empleado) {

  const regla = obtenerReglaCategoria(datosPersona.categoria);
  const creditoPrevio = obtenerCreditoDisponible(datosPersona.usuarioId);
  const creditoAlcanza = creditoPrevio >= depositoMinimoCategoria(datosPersona.categoria || 'normal');

  // VIP no pide depósito, pero sí exige que Staff/Administrativo
  // confirme/apruebe manualmente cada apartado (Sección 5.5) — nace
  // pendiente de esa aprobación en vez de activa de inmediato.
  const estadoInicial = regla.requiereAprobacion
    ? 'pendiente_aprobacion'
    : ((!regla.requiereDeposito || creditoAlcanza) ? 'activa' : 'pendiente_deposito');

  const ventana = crearVentanaApartado({
    ...datosPersona,
    depositoApartadoDisponible: creditoPrevio, // fijarDepositoVentana() separa esto en piso/excedente
    estado: estadoInicial,
    metodoDeposito: creditoPrevio > 0 ? 'credito_anterior' : null
  });

  if (creditoPrevio > 0) {
    establecerCredito(datosPersona.usuarioId, 0);
    ventana.auditoria.push(registrarAuditoriaVentana(
      ventana.estado === 'pendiente_deposito'
        ? `Ventana abierta con crédito previo de $${creditoPrevio} — faltan $${depositoMinimoVentana(ventana) - creditoPrevio} para completar el depósito mínimo`
        : 'Ventana abierta con crédito previo reutilizado',
      empleado
    ));
  } else {
    ventana.auditoria.push(registrarAuditoriaVentana('Ventana creada', empleado));
  }

  return ventana;

}

// Aprobación manual del apartado VIP (Sección 5.5) — deja la ventana
// activa, exactamente como si nunca hubiera requerido depósito.
function aprobarVentanaVip(ventana, empleado) {
  ventana.estado = 'activa';
  ventana.auditoria.push(registrarAuditoriaVentana('Apartado VIP aprobado', empleado));
  return ventana;
}

// BUG/mejora reportada tras lanzar a producción: el número de
// referencia de una transferencia (comprobante real del banco) se
// podía repetir sin aviso — por error, o por reusar el comprobante de
// otra persona. Revisa TODA la tienda: el depósito de cada ventana
// (referenciaDeposito) y cada pago de liquidación de cada pieza de
// cada ventana (pagos[].referencia) — nunca solo la ventana actual.
// Revisión de oct-2026: se compara sin espacios ni mayúsculas/minúsculas
// ("ab 12" = "AB12"), igual que BRILLO MW.
function normalizarReferenciaPago(referencia) {
  return String(referencia || '').trim().toUpperCase().replace(/\s+/g, '');
}

function existeReferenciaDuplicada(referencia) {
  const buscada = normalizarReferenciaPago(referencia);
  if (!buscada) return false;
  return obtenerVentanasApartado().some(v =>
    normalizarReferenciaPago(v.referenciaDeposito) === buscada ||
    (v.apartados || []).some(pieza => (pieza.pagos || []).some(pago => normalizarReferenciaPago(pago.referencia) === buscada))
  );
}

// Registro compartido con BRILLO MW (brilloReferenciasPago/<metodo>_<REF>):
// ahí quedan las transferencias cobradas en la caja y en los apartados de
// BRILLO. Una referencia usada en un lado ya no se acepta en el otro.
const REFERENCIAS_PAGO_COLECCION = 'brilloReferenciasPago';

async function referenciaYaUsada(referencia, metodo = 'transferencia') {
  if (existeReferenciaDuplicada(referencia)) return true;
  if (typeof dbFirestore === 'undefined' || !dbFirestore) return false;
  try {
    const doc = await dbFirestore.collection(REFERENCIAS_PAGO_COLECCION).doc(`${metodo}_${normalizarReferenciaPago(referencia)}`).get();
    return doc.exists;
  } catch (error) {
    return false; // sin permiso o sin red: se queda la revisión local
  }
}

function registrarReferenciaPago(referencia, metodo, ventana) {
  const ref = normalizarReferenciaPago(referencia);
  if (!ref || metodo !== 'transferencia' || typeof dbFirestore === 'undefined' || !dbFirestore) return;
  dbFirestore.collection(REFERENCIAS_PAGO_COLECCION).doc(`${metodo}_${ref}`).set({
    metodo, referencia: ref, documento: `ventanasApartado/${ventana.id}`, folio: ventana.id, origen: 'pagina', fecha: new Date().toISOString()
  }).catch(() => { /* la ventana ya guarda la referencia; esto es el respaldo compartido */ });
}

// Lo que falta depositar para que una ventana pendiente se active: el
// mínimo de su etiqueta ($50 normal, $200 foránea) menos el crédito
// previo que ya trae aplicado (ver abrirVentanaApartado).
function depositoFaltanteVentana(ventana) {
  const yaAplicado = ventana.estado === 'pendiente_deposito' ? Number(ventana.depositoApartadoDisponible || 0) : 0;
  return Math.max(0, depositoMinimoVentana(ventana) - yaAplicado);
}

// El monto mínimo es el de su etiqueta ($50, o $200 si es foránea),
// pero algunas personas transfieren más — el monto completo recibido
// queda como depósito disponible de la ventana (sumado al crédito
// previo que ya tuviera aplicado). El plazo de vencimiento se cuenta a
// partir de este momento (no desde que se solicitó la pieza).
function confirmarDepositoVentana(ventana, { monto, metodo, referencia }, empleado) {

  const montoFinal = Number(monto) || depositoFaltanteVentana(ventana);
  const regla = obtenerReglaCategoria(ventana.categoria);
  const ahora = new Date();
  const creditoAplicado = ventana.estado === 'pendiente_deposito' ? Number(ventana.depositoApartadoDisponible || 0) : 0;

  fijarDepositoVentana(ventana, creditoAplicado + montoFinal);
  ventana.metodoDeposito = metodo || null;
  ventana.referenciaDeposito = referencia || null;
  registrarReferenciaPago(referencia, metodo, ventana);
  ventana.estado = 'activa';
  ventana.fechaInicio = ahora.toISOString();
  ventana.fechaVencimiento = regla.dias
    ? new Date(ahora.getTime() + regla.dias * 24 * 60 * 60 * 1000).toISOString()
    : null;
  ventana.auditoria.push(registrarAuditoriaVentana(`Depósito de $${montoFinal} confirmado${referencia ? ` — referencia ${referencia}` : ''}`, empleado));

  // Antes solo el apartado VIP avisaba; con depósito, ella no sabía
  // cuándo quedaban apartadas sus piezas hasta volver a entrar.
  if (typeof agregarNotificacion === 'function') {
    agregarNotificacion({
      texto: `Confirmamos tu depósito de $${montoFinal}: tus piezas ya quedaron apartadas.`,
      link: 'apartados',
      paraId: ventana.usuarioId,
      rolDestino: 'emprendedora_lider'
    });
  }

  return ventana;

}

// Cuando Admin cambia la etiqueta de una persona (Normal / Foránea /
// VIP, en Emprendedoras/Líderes), sus apartados abiertos toman esa
// categoría con sus reglas:
// - Activo → Normal/Foránea: vence a los días de la categoría contados
//   desde el depósito (si alguien puso una fecha personalizada a mano,
//   esa se respeta). Si venía de VIP sin depósito, pasa a pendiente de
//   depósito (el plazo corre al confirmarlo, como en cualquier
//   apartado nuevo).
// - Activo → VIP: ya no vence.
// - Pendiente de depósito → VIP: pendiente de aprobación VIP (no
//   deposita, pero Staff la aprueba).
// - Pendiente de aprobación VIP → Normal/Foránea: pendiente de depósito.
// - Pendiente de depósito con crédito previo que ya alcanza el mínimo
//   de la etiqueta nueva (ej. $50 al pasar de Foránea a Normal): activa.
// - Un apartado activo que pasa a Foránea NO pide completar los $200:
//   su depósito ya se confirmó con la regla de antes.
// Regresa las ventanas que cambiaron.
function sincronizarCategoriaVentanasPersona(personaId, categoriaNueva, empleado) {

  const reglaNueva = CATEGORIAS_APARTADO[categoriaNueva];
  if (!reglaNueva) return [];
  const cambiadas = [];

  obtenerVentanasApartado().forEach((ventana) => {
    if (ventana.usuarioId !== personaId || ventana.categoria === categoriaNueva) return;
    if (!['activa', 'pendiente_deposito', 'pendiente_aprobacion'].includes(ventana.estado)) return;

    const categoriaAnterior = ventana.categoria || 'normal';
    const estadoAnterior = ventana.estado;
    const vencimientoAnterior = ventana.fechaVencimiento;
    ventana.categoria = categoriaNueva;

    const tieneDeposito = Number(ventana.depositoApartadoDisponible) > 0 || Number(ventana.depositoPiso) > 0;
    if (reglaNueva.requiereAprobacion) {
      if (ventana.estado === 'pendiente_deposito') ventana.estado = 'pendiente_aprobacion';
      ventana.fechaVencimiento = null;
    } else if (ventana.estado === 'pendiente_aprobacion') {
      ventana.estado = 'pendiente_deposito';
      ventana.fechaVencimiento = null;
    } else if (ventana.estado === 'pendiente_deposito') {
      // Crédito previo que no alcanzaba para foránea ($200) pero sí
      // alcanza el mínimo de la etiqueta nueva: se activa ya.
      if (Number(ventana.depositoApartadoDisponible || 0) >= depositoMinimoCategoria(categoriaNueva)) {
        fijarDepositoVentana(ventana, ventana.depositoApartadoDisponible);
        ventana.estado = 'activa';
        ventana.fechaInicio = new Date().toISOString();
        ventana.fechaVencimiento = calcularNuevoVencimientoVentana(ventana, categoriaNueva);
      }
    } else if (ventana.estado === 'activa') {
      if (reglaNueva.requiereDeposito && !tieneDeposito) {
        ventana.estado = 'pendiente_deposito';
        ventana.fechaVencimiento = null;
      } else if (!(ventana.vencimientoAjustado && ventana.vencimientoAjustado.modo === 'personalizada')) {
        ventana.fechaVencimiento = calcularNuevoVencimientoVentana(ventana, categoriaNueva);
      }
    }
    if (ventana.fechaVencimiento && (!vencimientoAnterior || new Date(ventana.fechaVencimiento) > new Date(vencimientoAnterior))) {
      delete ventana.avisoVencimiento1DiaEnviado;
      delete ventana.avisoVencimiento2HorasEnviado;
    }

    const etiqueta = (c) => (CATEGORIAS_APARTADO[c] || CATEGORIAS_APARTADO.normal).etiqueta;
    const detalle = ventana.estado !== estadoAnterior
      ? ` — ahora ${ESTADOS_VENTANA_MODELO[ventana.estado].toLowerCase()}`
      : (ventana.fechaVencimiento !== vencimientoAnterior
        ? (ventana.fechaVencimiento ? ` — ahora vence el ${new Date(ventana.fechaVencimiento).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}` : ' — ya no vence')
        : '');
    ventana.auditoria.push(registrarAuditoriaVentana(`Categoría cambiada de ${etiqueta(categoriaAnterior)} a ${etiqueta(categoriaNueva)} (cambio en la cuenta de la persona)${detalle}`, empleado));
    cambiadas.push(ventana);
  });

  return cambiadas;

}

// Staff/Encargado/Admin cambian a mano la fecha de vencimiento de una
// ventana activa (Apartados → "Cambiar fecha"):
// - modo 'normal' / 'foranea': la ventana se toma como de esa categoría
//   y vence a los días de esa categoría contados desde que se confirmó
//   el depósito (fechaInicio), igual que al confirmarlo.
// - modo 'personalizada': vence al final del día elegido (fechaISO,
//   'AAAA-MM-DD').
// Si la nueva fecha queda más adelante, los avisos de "vence en 1 día /
// 2 horas" se vuelven a mandar cuando toque.
function calcularNuevoVencimientoVentana(ventana, modo, fechaISO) {
  if (modo === 'personalizada') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaISO || ''))) return null;
    const [a, m, d] = fechaISO.split('-').map(Number);
    return new Date(a, m - 1, d, 23, 59, 0, 0).toISOString();
  }
  const regla = CATEGORIAS_APARTADO[modo];
  if (!regla || !regla.dias) return null;
  const inicio = ventana.fechaInicio ? new Date(ventana.fechaInicio) : new Date();
  return new Date(inicio.getTime() + regla.dias * 24 * 60 * 60 * 1000).toISOString();
}

function cambiarVencimientoVentana(ventana, { modo, fechaISO }, empleado) {

  if (!ventana || ventana.estado !== 'activa') return { ok: false, error: 'Solo se puede cambiar la fecha de un apartado activo.' };
  const nueva = calcularNuevoVencimientoVentana(ventana, modo, fechaISO);
  if (!nueva) return { ok: false, error: modo === 'personalizada' ? 'Elige una fecha.' : 'Ese plazo no es válido.' };
  if (modo === 'personalizada' && new Date(nueva).getTime() <= Date.now()) {
    return { ok: false, error: 'La fecha personalizada tiene que ser de hoy en adelante.' };
  }

  const anterior = ventana.fechaVencimiento;
  const categoriaAnterior = ventana.categoria;
  ventana.fechaVencimiento = nueva;
  if (modo === 'normal' || modo === 'foranea') ventana.categoria = modo;
  ventana.vencimientoAjustado = { modo, fecha: new Date().toISOString(), usuario: empleado.nombre };
  if (!anterior || new Date(nueva) > new Date(anterior)) {
    delete ventana.avisoVencimiento1DiaEnviado;
    delete ventana.avisoVencimiento2HorasEnviado;
  }

  const formato = (iso) => iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : 'sin fecha';
  const motivo = modo === 'personalizada'
    ? 'fecha personalizada'
    : `plazo ${CATEGORIAS_APARTADO[modo].etiqueta.toLowerCase()} (${CATEGORIAS_APARTADO[modo].dias} días)${categoriaAnterior !== modo ? ` — ahora es ${CATEGORIAS_APARTADO[modo].etiqueta}` : ''}`;
  ventana.auditoria.push(registrarAuditoriaVentana(`Fecha de vencimiento cambiada del ${formato(anterior)} al ${formato(nueva)} (${motivo})`, empleado));

  return { ok: true, anterior, nueva, motivo };

}

// Descuenta la existencia real de la variante seleccionada (Sección 4.3
// — cantidad por combinación color+talla) antes de crear la pieza. Si ya
// no hay existencia (otra persona se adelantó, o el catálogo cambió
// mientras se llenaba el formulario), no crea nada y regresa el error.
async function agregarPiezaAVentana(ventana, datosPieza, empleado) {

  if (typeof descontarStockVariante === 'function') {
    const resultado = await descontarStockVariante(datosPieza.productoId, datosPieza.varianteId);
    if (!resultado.ok) return { ok: false, error: resultado.error };
  }

  // El material se toma del catálogo real en este momento (no del
  // formulario, que no lo pide) — es la fuente de verdad para separar
  // Souvenir de compra normal en comisiones/constancia/rifas/activa.
  const material = typeof obtenerCatalogoStaffStorage === 'function'
    ? (obtenerCatalogoStaffStorage().find(p => p.id === datosPieza.productoId)?.material || null)
    : null;

  const pieza = crearApartadoPieza({ ...datosPieza, material });
  ventana.apartados.push(pieza);
  ventana.auditoria.push(registrarAuditoriaVentana(`Pieza agregada: ${pieza.producto}`, empleado));

  return { ok: true, pieza };

}

// Contraparte de agregarPiezaAVentana — restaura la existencia de la
// variante de cada pieza que se cancela, para que el inventario no
// quede perdido para siempre.
async function restaurarStockPiezasCanceladas(piezas) {
  if (typeof restaurarStockVariante !== 'function') return;
  await Promise.all(piezas.map(pieza => restaurarStockVariante(pieza.productoId, pieza.varianteId)));
}

// CARRITO: liquida (paga) solo las piezas ACTIVAS elegidas (piezaIds),
// permitiendo pagar una parte del apartado sin cerrar la ventana si
// quedan otras piezas activas sin pagar. `monto` es el total ya
// decidido por la interfaz (la suma de los saldos de las piezas
// elegidas — si se va a aplicar el depósito, debe venir con ese
// descuento restado) — solo se usa para la bitácora, el pago real de
// cada pieza siempre es su propio saldo completo (no hay abono parcial
// a una pieza individual). Si al terminar YA NO queda ninguna pieza
// activa en la ventana, se comporta exactamente igual que liquidar el
// apartado completo siempre hizo: puede requerir resolver el depósito
// (ver resolverDepositoVentana) y cierra la ventana.
function liquidarPiezasSeleccionadas(ventana, piezaIds, { monto, metodo, referencia }, empleado) {

  const idsElegidos = new Set(piezaIds);
  const piezasActivas = obtenerPiezasActivas(ventana);
  const piezasElegidas = piezasActivas.filter(p => idsElegidos.has(p.id));
  if (!piezasElegidas.length) return null;

  const fecha = new Date().toISOString();

  piezasElegidas.forEach(pieza => {
    pieza.pagos.push({ monto: pieza.saldo, tipo: 'liquidacion', metodo: metodo || null, referencia: referencia || null, fecha });
    if (referencia) registrarReferenciaPago(referencia, metodo, ventana);
    pieza.saldo = 0;
    pieza.estado = 'liquidada';
  });

  const siguenActivas = piezasActivas.length - piezasElegidas.length;

  // El aviso "ya pagué" de la Emprendedora/Líder (ver js/apartados.js)
  // queda atendido por las piezas que se acaban de liquidar; si eligió
  // otras que siguen activas, el aviso se queda solo con esas.
  if (ventana.fechaDeclaracionPago) {
    const pendientes = (Array.isArray(ventana.piezasDeclaradasPago) ? ventana.piezasDeclaradasPago : [])
      .filter(id => !idsElegidos.has(id) && piezasActivas.some(p => p.id === id));
    if (pendientes.length && siguenActivas > 0) {
      ventana.piezasDeclaradasPago = pendientes;
    } else {
      delete ventana.fechaDeclaracionPago;
      delete ventana.montoDeclaradoPago;
      delete ventana.piezasDeclaradasPago;
    }
  }

  ventana.auditoria.push(registrarAuditoriaVentana(
    (siguenActivas > 0
      ? `${piezasElegidas.length} pieza${piezasElegidas.length === 1 ? '' : 's'} liquidada${piezasElegidas.length === 1 ? '' : 's'} del carrito (quedan ${siguenActivas} activa${siguenActivas === 1 ? '' : 's'})`
      : `Apartado liquidado por completo (${piezasElegidas.length} pieza${piezasElegidas.length === 1 ? '' : 's'})`
    ) + ` — $${monto}${referencia ? ` — referencia ${referencia}` : ''}`,
    empleado
  ));

  if (siguenActivas > 0) {
    return { requiereResolucionDeposito: false, ventanaCerrada: false };
  }

  const requiereResolucionDeposito = ventana.depositoApartadoDisponible > 0;

  if (!requiereResolucionDeposito) {
    cerrarVentana(ventana, 'no_aplica');
  }

  return { requiereResolucionDeposito, ventanaCerrada: !requiereResolucionDeposito };

}

// Resuelve el depósito de una ventana que se quedó sin piezas activas
// por PAGO (no por cancelación). decision: 'aplicar' | 'credito'.
// Debe llamarse DESPUÉS de liquidarPiezasSeleccionadas cuando esta
// reporte requiereResolucionDeposito=true (si se eligió "aplicar", el
// efectivo cobrado en liquidarPiezasSeleccionadas ya debió venir con el
// descuento restado).
function resolverDepositoVentana(ventana, decision, empleado) {

  const monto = ventana.depositoApartadoDisponible;

  if (decision === 'aplicar') {
    cerrarVentana(ventana, 'aplicado');
    ventana.auditoria.push(registrarAuditoriaVentana(`Depósito de $${monto} aplicado a la compra`, empleado));
  } else {
    establecerCredito(ventana.usuarioId, monto);
    cerrarVentana(ventana, 'credito');
    ventana.auditoria.push(registrarAuditoriaVentana(`Depósito de $${monto} guardado como crédito`, empleado));
  }

  ventana.depositoPiso = 0;
  ventana.depositoExcedente = 0;
  ventana.depositoApartadoDisponible = 0;

  return ventana;

}

// Cancela TODAS las piezas activas de la ventana juntas (desapartar el
// apartado completo, no por pieza). Cancelar NUNCA aplica el depósito
// a una compra — si queda depósito disponible, se guarda como crédito
// automáticamente, sin preguntar.
function cancelarVentanaCompleta(ventana, empleado) {

  const piezasActivas = obtenerPiezasActivas(ventana);
  if (!piezasActivas.length) return null;

  piezasActivas.forEach(pieza => { pieza.estado = 'cancelada'; });
  restaurarStockPiezasCanceladas(piezasActivas);

  ventana.auditoria.push(registrarAuditoriaVentana(
    `Apartado cancelado por completo (${piezasActivas.length} pieza${piezasActivas.length === 1 ? '' : 's'})`,
    empleado
  ));

  if (ventana.depositoApartadoDisponible > 0) {
    const monto = ventana.depositoApartadoDisponible;
    establecerCredito(ventana.usuarioId, monto);
    cerrarVentana(ventana, 'credito');
    ventana.depositoPiso = 0;
    ventana.depositoExcedente = 0;
    ventana.depositoApartadoDisponible = 0;
    ventana.auditoria.push(registrarAuditoriaVentana(`Depósito de $${monto} guardado como crédito`, empleado));
  } else {
    cerrarVentana(ventana, 'no_aplica');
  }

  return piezasActivas;

}

// Quita UNA pieza activa del apartado (por ejemplo, ya no hay existencia
// física de ella). A diferencia de cancelar, NO regresa existencia al
// catálogo: la pieza no está en el local. Lo que ya se le hubiera
// abonado (excedente aplicado) vuelve al excedente del depósito. Si era
// la última pieza activa, la ventana se cierra igual que al cancelar: el
// depósito se guarda como crédito, porque la clienta no tuvo la culpa.
function quitarPiezaDeApartado(ventana, piezaId, motivo, empleado) {

  const pieza = obtenerPiezasActivas(ventana).find(p => p.id === piezaId);
  if (!pieza) return null;

  const abonado = (pieza.pagos || []).reduce((suma, pago) => suma + Number(pago.monto || 0), 0);

  pieza.estado = 'cancelada';
  pieza.retiro = { motivo, fecha: new Date().toISOString(), usuario: empleado?.nombre || 'Sistema' };

  ventana.auditoria.push(registrarAuditoriaVentana(`Pieza quitada del apartado: ${pieza.producto} — motivo: ${motivo}`, empleado));

  if (abonado > 0) {
    ventana.depositoExcedente = Number(ventana.depositoExcedente || 0) + abonado;
    ventana.depositoApartadoDisponible = Number(ventana.depositoPiso || 0) + ventana.depositoExcedente;
    ventana.auditoria.push(registrarAuditoriaVentana(`$${abonado} ya abonados a esa pieza regresaron al depósito`, empleado));
  }

  let ventanaCerrada = false;
  if (!obtenerPiezasActivas(ventana).length) {
    ventanaCerrada = true;
    if (ventana.depositoApartadoDisponible > 0) {
      const monto = ventana.depositoApartadoDisponible;
      establecerCredito(ventana.usuarioId, monto);
      cerrarVentana(ventana, 'credito');
      ventana.depositoPiso = 0;
      ventana.depositoExcedente = 0;
      ventana.depositoApartadoDisponible = 0;
      ventana.auditoria.push(registrarAuditoriaVentana(`Depósito de $${monto} guardado como crédito`, empleado));
    } else {
      cerrarVentana(ventana, 'no_aplica');
    }
  }

  return { pieza, ventanaCerrada };

}

// "No depositó": la ventana nunca recibió su depósito, así que se cancela
// completa. A diferencia de quitar pieza, las piezas sí existen en el
// local, así que su existencia regresa al catálogo.
function cancelarVentanaSinDeposito(ventana, empleado) {

  const piezasActivas = obtenerPiezasActivas(ventana);
  piezasActivas.forEach(pieza => { pieza.estado = 'cancelada'; });
  restaurarStockPiezasCanceladas(piezasActivas);

  cerrarVentana(ventana, 'sin_deposito');
  ventana.auditoria.push(registrarAuditoriaVentana(
    `Apartado cancelado: no se recibió el depósito (${piezasActivas.length} pieza${piezasActivas.length === 1 ? '' : 's'} regresaron al inventario)`,
    empleado
  ));

  // Crédito previo que no alcanzó el mínimo (ver abrirVentanaApartado):
  // era suyo de antes, así que vuelve a quedar como crédito.
  const creditoAplicado = Number(ventana.depositoApartadoDisponible || 0);
  if (creditoAplicado > 0) {
    establecerCredito(ventana.usuarioId, obtenerCreditoDisponible(ventana.usuarioId) + creditoAplicado);
    ventana.depositoPiso = 0;
    ventana.depositoExcedente = 0;
    ventana.depositoApartadoDisponible = 0;
    ventana.auditoria.push(registrarAuditoriaVentana(`Crédito previo de $${creditoAplicado} devuelto como crédito`, empleado));
  }

  return piezasActivas;

}

function cerrarVentana(ventana, resolucion) {
  ventana.estado = 'cerrada';
  ventana.resolucionDeposito = resolucion;
}

// Cierra por completo una ventana vencida SIN respuesta al contacto
// por Whatsapp: cancela las piezas activas restantes y el depósito se
// pierde por completo (no genera crédito). A diferencia de vencer, que
// es solo un aviso visual, esto sí es una acción definitiva.
function desapartarVentanaVencida(ventana, empleado) {

  const piezasActivas = obtenerPiezasActivas(ventana);
  piezasActivas.forEach(pieza => { pieza.estado = 'cancelada'; });
  restaurarStockPiezasCanceladas(piezasActivas);

  const montoPerdido = ventana.depositoApartadoDisponible;
  ventana.depositoPiso = 0;
  ventana.depositoExcedente = 0;
  ventana.depositoApartadoDisponible = 0;
  ventana.estado = 'vencida';
  ventana.resolucionDeposito = 'perdido';

  ventana.auditoria.push(registrarAuditoriaVentana(
    montoPerdido > 0
      ? `Apartado desapartado por vencimiento — depósito de $${montoPerdido} perdido`
      : 'Apartado desapartado por vencimiento',
    empleado
  ));

  return ventana;

}

// Identificador estable a partir del nombre, para poder encontrar el
// crédito guardado de una persona la próxima vez que se le abra una
// ventana (en Fase 3 esto sería el id real de su cuenta).
function slugUsuarioId(nombre) {
  return String(nombre || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function obtenerIniciales(nombre) {
  return String(nombre || '')
    .split(' ')
    .filter(Boolean)
    .map(parte => parte[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function registrarAuditoriaVentana(texto, empleado) {
  return { texto, usuario: empleado?.nombre || 'Sistema', fecha: new Date().toISOString() };
}

// ============================================================
// AVISO A ADMINISTRACIÓN — APARTADOS VENCIDOS
// ============================================================

// Avisa a Administración una sola vez por ventana cuando su plazo ya
// venció (marca avisoVencimientoEnviado para no repetir el aviso cada
// vez que se revisa) — ver js/admin-apartados.js. Vencer no cancela
// nada por sí solo (ver nota arriba de ESTADOS_VENTANA_MODELO); esto
// solo es el aviso para que Administración decida contactar o desapartar.
// Mismo id que pone BRILLO (avisosDeVencimiento en src/apartados/modelo.ts).
function idAvisoVencimiento(tipo, ventana) {
  return `NOTIF-${tipo}-${ventana.id}-${ventana.fechaVencimiento ? new Date(ventana.fechaVencimiento).getTime() : 0}`;
}

function verificarApartadosVencidosPendientes() {

  const ventanas = obtenerVentanasApartado();
  let huboCambios = false;

  ventanas.forEach(ventana => {

    if (ventana.estado === 'activa' && ventanaEstaVencida(ventana) && !ventana.avisoVencimientoEnviado) {

      ventana.avisoVencimientoEnviado = true;
      huboCambios = true;

      if (typeof agregarNotificacion === 'function' && (typeof estaEventoNotifActivo !== 'function' || estaEventoNotifActivo('apartado_vencido'))) {
        const piezas = obtenerPiezasActivas(ventana).length;
        agregarNotificacion({
          texto: `El apartado de ${piezas} pieza${piezas === 1 ? '' : 's'} de ${ventana.usuarioNombre} ya venció.`,
          link: `admin-apartados.html?buscar=${encodeURIComponent(ventana.usuarioNombre)}`,
          rolDestino: 'admin',
          origen: 'emprendedora_lider',
          idFijo: idAvisoVencimiento('vencido', ventana)
        });
      }

    }

  });

  if (huboCambios) guardarVentanasApartado(ventanas);

}

// NOTIF-01 de la auditoría: aviso PREVENTIVO a la propia Emprendedora/
// Líder antes de que su ventana venza — lo único que existía antes
// (verificarApartadosVencidosPendientes, arriba) avisaba a Admin
// cuando la ventana YA había vencido, nunca antes y nunca a la dueña
// del apartado. Dos avisos, cada uno una sola vez (mismo patrón de
// bandera que avisoVencimientoEnviado): 1 día antes y 2 horas antes.
function verificarApartadosPorVencerPendientes() {

  const ventanas = obtenerVentanasApartado();
  let huboCambios = false;
  const ahora = Date.now();
  const UN_DIA_MS = 24 * 60 * 60 * 1000;
  const DOS_HORAS_MS = 2 * 60 * 60 * 1000;

  ventanas.forEach(ventana => {

    if (ventana.estado !== 'activa' || !ventana.fechaVencimiento) return;
    const faltan = new Date(ventana.fechaVencimiento).getTime() - ahora;
    if (faltan <= 0) return; // ya vencida — eso ya lo cubre verificarApartadosVencidosPendientes

    const piezas = obtenerPiezasActivas(ventana).length;
    if (!piezas) return;

    if (faltan <= UN_DIA_MS && !ventana.avisoVencimiento1DiaEnviado) {
      ventana.avisoVencimiento1DiaEnviado = true;
      huboCambios = true;
      if (typeof agregarNotificacion === 'function') {
        agregarNotificacion({
          texto: `Tu apartado de ${piezas} pieza${piezas === 1 ? '' : 's'} vence en menos de 1 día — si no se liquida o renueva, se pierde.`,
          link: 'apartados',
          paraId: ventana.usuarioId,
          rolDestino: 'emprendedora_lider',
          idFijo: idAvisoVencimiento('vence1d', ventana)
        });
      }
    }

    if (faltan <= DOS_HORAS_MS && !ventana.avisoVencimiento2HorasEnviado) {
      ventana.avisoVencimiento2HorasEnviado = true;
      huboCambios = true;
      if (typeof agregarNotificacion === 'function') {
        agregarNotificacion({
          texto: `Tu apartado de ${piezas} pieza${piezas === 1 ? '' : 's'} vence en menos de 2 horas.`,
          link: 'apartados',
          paraId: ventana.usuarioId,
          rolDestino: 'emprendedora_lider',
          idFijo: idAvisoVencimiento('vence2h', ventana)
        });
      }
    }

  });

  if (huboCambios) guardarVentanasApartado(ventanas);

}

// Arranca la carga real (Firestore o localStorage) — se hace aquí, no
// en apartados-firestore-sync.js, porque la semilla de ejemplo y la
// prueba de $8,000 necesitan crearVentanaApartado/crearApartadoPieza/
// construirVentanasApartadoEjemplo, definidas arriba en este mismo
// archivo. Cada página que use datos de apartados debe esperar esto
// una vez antes de su primer render — igual que ya hace
// catalogoRepoListo para Catálogo.
// Las páginas que calculan compras (rango, comisiones, rifa…) esperan
// esta promesa antes de calcular — también espera a las compras de
// Aronium cuando la página las carga (compras-aronium-firestore-sync.js),
// para no calcular con los apartados una quincena que ya tiene archivo.
const apartadosRepoListo = Promise.all([
  cargarApartadosRepo(),
  typeof comprasAroniumListo !== 'undefined' ? comprasAroniumListo : null,
  // Y a las compras confirmadas por BRILLO (compras-brillo-firestore-sync.js).
  typeof comprasBrilloListo !== 'undefined' ? comprasBrilloListo : null,
  // Y a Configuración (comisiones, metas…), que en algunas páginas se carga
  // después de este archivo: se espera a que estén todos los scripts.
  new Promise(listo => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', listo, { once: true }) : listo()))
    .then(() => Promise.all([
      typeof configuracionListo !== 'undefined' ? configuracionListo : null,
      typeof rifaBoletosListo !== 'undefined' ? rifaBoletosListo : null
    ]))
]).then(([ventanas]) => ventanas);
