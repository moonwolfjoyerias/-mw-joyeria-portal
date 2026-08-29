// MW JOYERIA - Modelo compartido de ventanas de apartado
// TEMPORAL: localStorage simula la persistencia hasta integrar Firestore.
//
// LÓGICA DEL DEPÓSITO (ventana de apartado):
// El depósito de $50 respalda TODA la ventana (no una pieza individual).
// - Se registra una sola vez al abrir la ventana (o se reutiliza un
//   crédito guardado de una ventana anterior de la misma persona).
// - Mientras existan piezas activas, el depósito no se toca.
// - Cuando ya no quedan piezas activas:
//     - Si la ventana se cerró porque se PAGÓ la última pieza, se
//       pregunta: aplicar el depósito a esa compra, o guardarlo como
//       crédito para la próxima vez.
//     - Si se cerró porque se CANCELÓ la última pieza (no hubo
//       compra), el depósito se guarda como crédito automáticamente,
//       sin preguntar.
// - Si la ventana VENCE con piezas activas, esas piezas se cancelan y
//   el depósito completo se pierde (no genera crédito).

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
    resolucionDeposito: null,
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

function confirmarDepositoVentana(ventana, { metodo, referencia }, empleado) {

  ventana.depositoApartadoDisponible = DEPOSITO_BASE;
  ventana.metodoDeposito = metodo || null;
  ventana.referenciaDeposito = referencia || null;
  ventana.estado = 'activa';
  ventana.auditoria.push(registrarAuditoria(`Depósito de $${DEPOSITO_BASE} confirmado`, empleado));

  return ventana;

}

function agregarPiezaAVentana(ventana, datosPieza, empleado) {

  const pieza = crearApartadoPieza(datosPieza);
  ventana.apartados.push(pieza);
  ventana.auditoria.push(registrarAuditoria(`Pieza agregada: ${pieza.producto}`, empleado));

  return pieza;

}

// Responde ANTES de cobrar: si se liquida esta pieza ahora mismo,
// ¿sería la última pieza activa de una ventana con depósito
// disponible? Si es así, la interfaz debe preguntar primero "aplicar
// a esta compra o guardar como crédito", porque la respuesta cambia
// cuánto debe pagar la persona (con "aplicar", se cobran $50 menos).
function necesitaResolucionDeposito(ventana, piezaId) {

  if (ventana.depositoApartadoDisponible <= 0) return false;

  const otrasActivas = obtenerPiezasActivas(ventana).filter(p => p.id !== piezaId);

  return otrasActivas.length === 0;

}

// Liquida (paga) una pieza por el monto ya decidido (si se va a
// aplicar el depósito, `monto` debe venir con ese descuento restado).
// Regresa si la ventana se quedó sin piezas activas, para que la
// interfaz cierre la ventana (resolverDepositoVentana si había
// depósito pendiente de decisión, o cerrarVentana si no aplicaba).
function liquidarPiezaVentana(ventana, piezaId, { monto, metodo, referencia }, empleado) {

  const pieza = ventana.apartados.find(p => p.id === piezaId);
  if (!pieza) return null;

  pieza.pagos.push({ monto, tipo: 'liquidacion', metodo: metodo || null, referencia: referencia || null, fecha: new Date().toISOString() });
  pieza.saldo = Math.max(0, pieza.total - sumarPagos(pieza.pagos));
  pieza.estado = 'liquidada';

  ventana.auditoria.push(registrarAuditoria(`Pieza liquidada: ${pieza.producto}`, empleado));

  const esUltimaPieza = obtenerPiezasActivas(ventana).length === 0;

  if (esUltimaPieza && ventana.depositoApartadoDisponible <= 0) {
    cerrarVentana(ventana, 'no_aplica');
  }

  return { pieza, esUltimaPieza };

}

// Resuelve el depósito de una ventana que se quedó sin piezas activas
// por PAGO (no por cancelación). decision: 'aplicar' | 'credito'.
// Debe llamarse DESPUÉS de liquidarPiezaVentana cuando esta reporte
// esUltimaPieza=true y la ventana todavía tenía depósito disponible
// (si se eligió "aplicar", el efectivo cobrado en liquidarPiezaVentana
// ya debió venir con el descuento restado — aquí se registra el
// depósito como el pago restante, para que el saldo quede en $0).
function resolverDepositoVentana(ventana, decision, empleado, piezaId = null) {

  const monto = ventana.depositoApartadoDisponible;

  if (decision === 'aplicar') {

    const pieza = piezaId
      ? ventana.apartados.find(p => p.id === piezaId)
      : ventana.apartados.filter(p => p.estado === 'liquidada').at(-1);

    if (pieza) {
      pieza.pagos.push({ monto, tipo: 'credito_deposito', metodo: null, referencia: null, fecha: new Date().toISOString() });
      pieza.saldo = Math.max(0, pieza.total - sumarPagos(pieza.pagos));
    }

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

// Cancela una pieza (desapartar). Cancelar NUNCA consume ni aplica el
// depósito. Si esta era la última pieza activa, la ventana se cierra
// y el depósito (si había) se guarda como crédito automáticamente.
function cancelarPiezaVentana(ventana, piezaId, empleado) {

  const pieza = ventana.apartados.find(p => p.id === piezaId);
  if (!pieza) return null;

  pieza.estado = 'cancelada';
  ventana.auditoria.push(registrarAuditoria(`Pieza cancelada: ${pieza.producto}`, empleado));

  if (obtenerPiezasActivas(ventana).length === 0) {

    if (ventana.depositoApartadoDisponible > 0) {
      const monto = ventana.depositoApartadoDisponible;
      establecerCredito(ventana.usuarioId, monto);
      cerrarVentana(ventana, 'credito');
      ventana.depositoApartadoDisponible = 0;
      ventana.auditoria.push(registrarAuditoria(`Sin piezas activas tras cancelación — depósito de $${monto} guardado como crédito`, empleado));
    } else {
      cerrarVentana(ventana, 'no_aplica');
    }

  }

  return pieza;

}

function cerrarVentana(ventana, resolucion) {
  ventana.estado = 'cerrada';
  ventana.resolucionDeposito = resolucion;
}

// Recorre las ventanas activas/pendientes y vence las que ya
// cumplieron su plazo con piezas activas: se cancelan esas piezas y
// se pierde el depósito completo (no genera crédito).
function revisarVencimientoVentanas(ventanas, empleado = { nombre: 'Sistema' }) {

  const ahora = Date.now();

  ventanas.forEach(ventana => {

    if (!['activa', 'pendiente_deposito'].includes(ventana.estado)) return;
    if (!ventanaEstaVencida(ventana, ahora)) return;

    const activas = obtenerPiezasActivas(ventana);

    if (activas.length > 0) {
      activas.forEach(pieza => { pieza.estado = 'cancelada'; });
      ventana.auditoria.push(registrarAuditoria(`Ventana vencida — ${activas.length} pieza(s) cancelada(s), depósito perdido`, empleado));
    }

    ventana.depositoApartadoDisponible = 0;
    ventana.estado = 'vencida';
    ventana.resolucionDeposito = 'perdido';

  });

  return ventanas;

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
