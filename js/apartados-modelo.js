// MW JOYERIA - Modelo compartido de ventanas de apartado
// TEMPORAL: localStorage simula la persistencia hasta integrar Firestore.
//
// LÓGICA DEL DEPÓSITO (ventana de apartado):
// El depósito de $50+ respalda TODA la ventana (no una pieza
// individual), y el apartado se liquida o cancela completo, no por
// pieza — o pagan/desapartan todo, o nada.
// - Se registra una sola vez al abrir la ventana (o se reutiliza un
//   crédito guardado de una ventana anterior de la misma persona). El
//   plazo de vencimiento empieza a correr desde que se confirma el
//   depósito, no desde que se solicitó la pieza.
// - Mientras existan piezas activas, el depósito no se toca.
// - Cuando se LIQUIDA el apartado completo (se pagan todas las piezas
//   activas juntas), se pregunta: aplicar el depósito a esa compra, o
//   guardarlo como crédito para la próxima vez.
// - Cuando se CANCELA el apartado completo (no hubo compra), el
//   depósito se guarda como crédito automáticamente, sin preguntar.
// - Que la ventana llegue a su fecha de vencimiento NO pierde nada
//   automáticamente: solo se muestra como "vencida" (piezas y
//   depósito intactos, se puede seguir liquidando con normalidad).
//   El depósito solo se pierde si Staff decide "Desapartar" — después
//   de contactar por Whatsapp y no obtener respuesta — que cancela
//   las piezas activas restantes y pierde el depósito por completo.

const APARTADOS_MODELO_STORAGE_KEY = 'mw-apartados-modelo-v1';
const CREDITOS_MODELO_STORAGE_KEY = 'mw-creditos-modelo-v1';
let DEPOSITO_BASE = 50;

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

  const diasNormalConfigurado = obtenerValorVigente('apartado', 'ventana_normal_dias');
  if (typeof diasNormalConfigurado === 'number') CATEGORIAS_APARTADO.normal.dias = diasNormalConfigurado;

  const diasForaneaConfigurado = obtenerValorVigente('apartado', 'ventana_foranea_dias');
  if (typeof diasForaneaConfigurado === 'number') CATEGORIAS_APARTADO.foranea.dias = diasForaneaConfigurado;
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

function obtenerVentanasApartado() {
  try {
    const guardadas = localStorage.getItem(APARTADOS_MODELO_STORAGE_KEY);
    if (guardadas === null) {
      // Primera vez que se pide el registro: se siembra con compras de
      // ejemplo ya liquidadas (igual que obtenerPersonas() siembra su
      // propio registro) para que Comisiones/Plan MW tengan datos reales
      // que mostrar en vez de $0 en todos lados.
      const sembradas = typeof construirVentanasApartadoEjemplo === 'function' ? construirVentanasApartadoEjemplo() : [];
      guardarVentanasApartado(sembradas);
      return sembradas;
    }
    const ventanas = JSON.parse(guardadas);
    return Array.isArray(ventanas) ? ventanas : [];
  } catch (error) {
    return [];
  }
}

function guardarVentanasApartado(ventanas) {
  localStorage.setItem(APARTADOS_MODELO_STORAGE_KEY, JSON.stringify(ventanas));
}

function obtenerCreditosApartado() {
  try {
    const creditos = JSON.parse(localStorage.getItem(CREDITOS_MODELO_STORAGE_KEY));
    return (creditos && typeof creditos === 'object' && !Array.isArray(creditos)) ? creditos : {};
  } catch (error) {
    return {};
  }
}

function guardarCreditosApartado(creditos) {
  localStorage.setItem(CREDITOS_MODELO_STORAGE_KEY, JSON.stringify(creditos));
}

function obtenerCreditoDisponible(usuarioId) {
  const creditos = obtenerCreditosApartado();
  return Number(creditos[usuarioId] || 0);
}

function establecerCredito(usuarioId, monto) {
  const creditos = obtenerCreditosApartado();
  if (monto > 0) {
    creditos[usuarioId] = monto;
  } else {
    delete creditos[usuarioId];
  }
  guardarCreditosApartado(creditos);
}

// Dato de ejemplo: de las dos cuentas de sesión de prueba (Emprendedora
// y Líder — ver personas-ejemplo.js), 'me-emprendedora' ya tiene
// crédito guardado de un depósito anterior y 'me-lider' no — para poder
// probar con las cuentas de ejemplo los dos caminos de "Apartar" desde
// el catálogo: quien ya tiene depósito (se apartar directo) y quien
// tiene que pedirlo (pasa por "pendiente_deposito"). Se siembra UNA
// sola vez, igual que obtenerPersonas() siembra su propio registro —
// después de esto el crédito lo controla el uso real (se gasta, se
// vuelve a guardar al liquidar/cancelar), como el de cualquier persona.
(function sembrarCreditoDemoInicial() {
  if (typeof localStorage === 'undefined' || localStorage.getItem(CREDITOS_MODELO_STORAGE_KEY) !== null) return;
  guardarCreditosApartado({ 'me-emprendedora': DEPOSITO_BASE });
})();

// ⚠️ PRUEBA TEMPORAL — BÓRRAME: solo para probar en vivo "fecha real de
// los $8,000 del mes" (Reto de Constancia) con la cuenta de ejemplo
// 'me-emprendedora' (Claudia Ramírez). Agrega una compra normal ya
// liquidada de $8,000 fechada HOY, sin importar qué haya ya en
// localStorage (a diferencia de sembrarCreditoDemoInicial, no espera a
// que el registro esté vacío — por eso corre siempre, pero solo agrega
// la pieza una vez gracias al id fijo). Quitar este bloque completo
// cuando ya no se necesite.
(function sembrarCompraDePruebaOchoMil() {
  if (typeof localStorage === 'undefined') return;
  const ID_PRUEBA = 'VENT-PRUEBA-8000-CLAUDIA';
  const ventanas = obtenerVentanasApartado();
  if (ventanas.some(v => v.id === ID_PRUEBA)) return;
  const ahoraISO = new Date().toISOString();
  const pieza = crearApartadoPieza({
    id: 'PIEZA-PRUEBA-8000-CLAUDIA',
    producto: 'Pieza de prueba ($8,000)',
    material: 'oro-laminado',
    total: 8000,
    estado: 'liquidada',
    fechaSolicitud: ahoraISO,
    pagos: [{ monto: 8000, tipo: 'liquidacion', metodo: 'transferencia', referencia: null, fecha: ahoraISO }]
  });
  ventanas.push(crearVentanaApartado({
    id: ID_PRUEBA,
    usuarioId: 'me-emprendedora',
    usuarioNombre: 'Claudia Ramírez',
    telefono: '444 123 4567',
    categoria: 'normal',
    fechaInicio: ahoraISO,
    estado: 'cerrada',
    resolucionDeposito: 'no_aplica',
    apartados: [pieza]
  }));
  guardarVentanasApartado(ventanas);
})();


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

function crearVentanaApartado(datos = {}) {
  const regla = obtenerReglaCategoria(datos.categoria);
  const fechaInicio = datos.fechaInicio || new Date().toISOString();
  return {
    id: datos.id || `VENT-${Date.now()}`,
    usuarioId: datos.usuarioId || '',
    usuarioNombre: datos.usuarioNombre || '',
    telefono: datos.telefono || '',
    categoria: datos.categoria || 'normal',
    fechaInicio,
    fechaVencimiento: regla.dias
      ? new Date(new Date(fechaInicio).getTime() + regla.dias * 24 * 60 * 60 * 1000).toISOString()
      : null,
    depositoApartadoDisponible: Number(datos.depositoApartadoDisponible || 0),
    metodoDeposito: datos.metodoDeposito || null,
    referenciaDeposito: datos.referenciaDeposito || null,
    estado: datos.estado || (regla.requiereDeposito ? 'pendiente_deposito' : 'activa'),
    resolucionDeposito: datos.resolucionDeposito || null,
    apartados: Array.isArray(datos.apartados) ? datos.apartados : [],
    auditoria: Array.isArray(datos.auditoria) ? datos.auditoria : []
  };
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


// ============================================================
// CICLO DE VIDA
// ============================================================

// Abre una ventana nueva para una persona. Si ya tiene crédito
// guardado de una ventana anterior, lo reutiliza automáticamente y la
// ventana queda activa de inmediato (sin pedir depósito físico).
function abrirVentanaApartado(datosPersona, empleado) {

  const regla = obtenerReglaCategoria(datosPersona.categoria);
  const creditoPrevio = obtenerCreditoDisponible(datosPersona.usuarioId);

  // VIP no pide depósito, pero sí exige que Staff/Administrativo
  // confirme/apruebe manualmente cada apartado (Sección 5.5) — nace
  // pendiente de esa aprobación en vez de activa de inmediato.
  const estadoInicial = regla.requiereAprobacion
    ? 'pendiente_aprobacion'
    : ((!regla.requiereDeposito || creditoPrevio > 0) ? 'activa' : 'pendiente_deposito');

  const ventana = crearVentanaApartado({
    ...datosPersona,
    depositoApartadoDisponible: creditoPrevio,
    estado: estadoInicial,
    metodoDeposito: creditoPrevio > 0 ? 'credito_anterior' : null
  });

  if (creditoPrevio > 0) {
    establecerCredito(datosPersona.usuarioId, 0);
    ventana.auditoria.push(registrarAuditoriaVentana('Ventana abierta con crédito previo reutilizado', empleado));
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

// El monto mínimo son $50, pero algunas personas transfieren más — el
// monto completo recibido queda como depósito disponible de la ventana.
// El plazo de vencimiento se cuenta a partir de este momento (no desde
// que se solicitó la pieza).
function confirmarDepositoVentana(ventana, { monto, metodo, referencia }, empleado) {

  const montoFinal = Number(monto) || DEPOSITO_BASE;
  const regla = obtenerReglaCategoria(ventana.categoria);
  const ahora = new Date();

  ventana.depositoApartadoDisponible = montoFinal;
  ventana.metodoDeposito = metodo || null;
  ventana.referenciaDeposito = referencia || null;
  ventana.estado = 'activa';
  ventana.fechaInicio = ahora.toISOString();
  ventana.fechaVencimiento = regla.dias
    ? new Date(ahora.getTime() + regla.dias * 24 * 60 * 60 * 1000).toISOString()
    : null;
  ventana.auditoria.push(registrarAuditoriaVentana(`Depósito de $${montoFinal} confirmado`, empleado));

  return ventana;

}

// Descuenta la existencia real de la variante seleccionada (Sección 4.3
// — cantidad por combinación color+talla) antes de crear la pieza. Si ya
// no hay existencia (otra persona se adelantó, o el catálogo cambió
// mientras se llenaba el formulario), no crea nada y regresa el error.
function agregarPiezaAVentana(ventana, datosPieza, empleado) {

  if (typeof descontarStockVariante === 'function') {
    const resultado = descontarStockVariante(datosPieza.productoId, datosPieza.varianteId);
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
function restaurarStockPiezasCanceladas(piezas) {
  if (typeof restaurarStockVariante !== 'function') return;
  piezas.forEach(pieza => restaurarStockVariante(pieza.productoId, pieza.varianteId));
}

// Liquida (paga) TODAS las piezas activas de la ventana juntas — el
// apartado se paga completo, no por pieza. `monto` es el total ya
// decidido por la interfaz (si se va a aplicar el depósito, debe venir
// con ese descuento restado). Regresa si hace falta preguntar qué
// hacer con el depósito (siempre que quede disponible, porque esta
// acción deja la ventana sin piezas activas).
function liquidarVentanaCompleta(ventana, { monto, metodo, referencia }, empleado) {

  const piezasActivas = obtenerPiezasActivas(ventana);
  if (!piezasActivas.length) return null;

  const fecha = new Date().toISOString();

  piezasActivas.forEach(pieza => {
    pieza.pagos.push({ monto: pieza.saldo, tipo: 'liquidacion', metodo: metodo || null, referencia: referencia || null, fecha });
    pieza.saldo = 0;
    pieza.estado = 'liquidada';
  });

  ventana.auditoria.push(registrarAuditoriaVentana(
    `Apartado liquidado por completo (${piezasActivas.length} pieza${piezasActivas.length === 1 ? '' : 's'}) — $${monto}`,
    empleado
  ));

  const requiereResolucionDeposito = ventana.depositoApartadoDisponible > 0;

  if (!requiereResolucionDeposito) {
    cerrarVentana(ventana, 'no_aplica');
  }

  return { requiereResolucionDeposito };

}

// Resuelve el depósito de una ventana que se quedó sin piezas activas
// por PAGO (no por cancelación). decision: 'aplicar' | 'credito'.
// Debe llamarse DESPUÉS de liquidarVentanaCompleta cuando esta reporte
// requiereResolucionDeposito=true (si se eligió "aplicar", el efectivo
// cobrado en liquidarVentanaCompleta ya debió venir con el descuento
// restado).
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
    ventana.depositoApartadoDisponible = 0;
    ventana.auditoria.push(registrarAuditoriaVentana(`Depósito de $${monto} guardado como crédito`, empleado));
  } else {
    cerrarVentana(ventana, 'no_aplica');
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
          origen: 'emprendedora_lider'
        });
      }

    }

  });

  if (huboCambios) guardarVentanasApartado(ventanas);

}
