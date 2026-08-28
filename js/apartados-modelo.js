// MW JOYERIA - Modelo compartido de ventanas de apartado
// TEMPORAL: localStorage simula la persistencia hasta integrar Firestore.

const APARTADOS_MODELO_STORAGE_KEY = 'mw-apartados-modelo-v1';
const CREDITOS_MODELO_STORAGE_KEY = 'mw-creditos-modelo-v1';
const DEPOSITO_BASE = 50;

const CATEGORIAS_APARTADO = {
  normal: { etiqueta: 'Normal', dias: 3, requiereDeposito: true },
  foranea: { etiqueta: 'Foranea', dias: 15, requiereDeposito: true },
  vip: { etiqueta: 'VIP', dias: null, requiereDeposito: false, requiereAprobacion: true }
};

const ESTADOS_APARTADO_MODELO = {
  pendiente_deposito: 'Pendiente de deposito',
  deposito_confirmado: 'Deposito confirmado',
  pendiente_aprobacion: 'Pendiente de aprobacion',
  activo: 'Apartado activo',
  pago_reportado: 'Pago reportado',
  liquidado: 'Liquidada',
  vencido: 'Vencido',
  cancelado: 'Cancelada'
};

const METODOS_PAGO_MODELO = {
  transferencia: 'Transferencia',
  local: 'Pago en local'
};

function obtenerReglaCategoria(categoria) {
  return CATEGORIAS_APARTADO[categoria] || CATEGORIAS_APARTADO.normal;
}

function crearVentanaApartado(datos = {}) {
  const regla = obtenerReglaCategoria(datos.categoria);
  const fechaInicio = datos.fechaInicio || null;
  return {
    id: datos.id || `VENT-${Date.now()}`,
    usuarioId: datos.usuarioId || '',
    usuarioNombre: datos.usuarioNombre || '',
    telefono: datos.telefono || '',
    categoria: datos.categoria || 'normal',
    fechaInicio,
    fechaVencimiento: regla.dias && fechaInicio
      ? new Date(new Date(fechaInicio).getTime() + regla.dias * 24 * 60 * 60 * 1000).toISOString()
      : null,
    depositoBase: DEPOSITO_BASE,
    montoDeposito: Number(datos.montoDeposito || 0),
    excedente: Math.max(0, Number(datos.montoDeposito || 0) - DEPOSITO_BASE),
    depositoEstado: regla.requiereDeposito ? 'pendiente' : 'no_requiere',
    metodoDeposito: null,
    referenciaDeposito: null,
    estado: datos.estado || 'pendiente_deposito',
    resolucionDeposito: null,
    apartados: Array.isArray(datos.apartados) ? datos.apartados : [],
    auditoria: Array.isArray(datos.auditoria) ? datos.auditoria : []
  };
}

function crearApartadoPieza(datos = {}) {
  const total = Number(datos.total ?? datos.precio ?? 0);
  return {
    id: datos.id || `PIEZA-${Date.now()}`,
    productoId: datos.productoId || '',
    producto: datos.producto || '',
    variante: datos.variante || '',
    precio: total,
    total,
    pagos: Array.isArray(datos.pagos) ? datos.pagos : [],
    saldo: Math.max(0, total - sumarPagos(datos.pagos)),
    estado: datos.estado || 'pendiente'
  };
}

function sumarPagos(pagos = []) {
  return pagos.reduce((total, pago) => total + Number(pago.monto || 0), 0);
}

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
    return Array.isArray(creditos) ? creditos : [];
  } catch (error) {
    return [];
  }
}

function guardarCreditosApartado(creditos) {
  localStorage.setItem(CREDITOS_MODELO_STORAGE_KEY, JSON.stringify(creditos));
}
