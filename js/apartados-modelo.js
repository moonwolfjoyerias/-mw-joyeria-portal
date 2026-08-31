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
const DEPOSITO_BASE = 50;

const CATEGORIAS_APARTADO = {
  normal: { etiqueta: 'Normal', dias: 3, requiereDeposito: true },
  foranea: { etiqueta: 'Foránea', dias: 15, requiereDeposito: true },
  vip: { etiqueta: 'VIP', dias: null, requiereDeposito: false, requiereAprobacion: true }
};

// Estados de la VENTANA (no de cada pieza).
const ESTADOS_VENTANA_MODELO = {
  pendiente_deposito: 'Pendiente de depósito',
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
    const ventanas = JSON.parse(localStorage.getItem(APARTADOS_MODELO_STORAGE_KEY));
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


// ============================================================
// CREAR ENTIDADES
// ============================================================

function crearApartadoPieza(datos = {}) {
  const total = Number(datos.total ?? datos.precio ?? 0);
  return {
    id: datos.id || `PIEZA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    productoId: datos.productoId || '',
    producto: datos.producto || '',
    variante: datos.variante || '',
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

  const ventana = crearVentanaApartado({
    ...datosPersona,
    depositoApartadoDisponible: creditoPrevio,
    estado: (!regla.requiereDeposito || creditoPrevio > 0) ? 'activa' : 'pendiente_deposito',
    metodoDeposito: creditoPrevio > 0 ? 'credito_anterior' : null
  });

  if (creditoPrevio > 0) {
    establecerCredito(datosPersona.usuarioId, 0);
    ventana.auditoria.push(registrarAuditoria('Ventana abierta con crédito previo reutilizado', empleado));
  } else {
    ventana.auditoria.push(registrarAuditoria('Ventana creada', empleado));
  }

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
  ventana.auditoria.push(registrarAuditoria(`Depósito de $${montoFinal} confirmado`, empleado));

  return ventana;

}

function agregarPiezaAVentana(ventana, datosPieza, empleado) {

  const pieza = crearApartadoPieza(datosPieza);
  ventana.apartados.push(pieza);
  ventana.auditoria.push(registrarAuditoria(`Pieza agregada: ${pieza.producto}`, empleado));

  return pieza;

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

  ventana.auditoria.push(registrarAuditoria(
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
    ventana.auditoria.push(registrarAuditoria(`Depósito de $${monto} aplicado a la compra`, empleado));
  } else {
    establecerCredito(ventana.usuarioId, monto);
    cerrarVentana(ventana, 'credito');
    ventana.auditoria.push(registrarAuditoria(`Depósito de $${monto} guardado como crédito`, empleado));
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

  ventana.auditoria.push(registrarAuditoria(
    `Apartado cancelado por completo (${piezasActivas.length} pieza${piezasActivas.length === 1 ? '' : 's'})`,
    empleado
  ));

  if (ventana.depositoApartadoDisponible > 0) {
    const monto = ventana.depositoApartadoDisponible;
    establecerCredito(ventana.usuarioId, monto);
    cerrarVentana(ventana, 'credito');
    ventana.depositoApartadoDisponible = 0;
    ventana.auditoria.push(registrarAuditoria(`Depósito de $${monto} guardado como crédito`, empleado));
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

  const montoPerdido = ventana.depositoApartadoDisponible;
  ventana.depositoApartadoDisponible = 0;
  ventana.estado = 'vencida';
  ventana.resolucionDeposito = 'perdido';

  ventana.auditoria.push(registrarAuditoria(
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

function registrarAuditoria(texto, empleado) {
  return { texto, usuario: empleado?.nombre || 'Sistema', fecha: new Date().toISOString() };
}
