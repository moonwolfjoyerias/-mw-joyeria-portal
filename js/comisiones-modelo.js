// MW JOYERÍA — Admin: Comisiones (motor de cálculo)
//
// Única fuente de cálculo de comisiones. Reutiliza:
// - COMISIONES_PCT (js/lider-cuenta-ejemplo.js) — MISMOS porcentajes por
//   nivel/rango que ya usa el Ticket de comisiones de la Líder. No se
//   inventan otros.
// - RANGOS_MW (js/lider-ejemplo.js) — mismos rangos reales.
// - calcularDescendenciaPersona (js/personas-ejemplo.js) — mismo
//   recorrido de equipo por liderId que usa Admin → Emprendedoras/Líderes.
// - historialLogros de cada persona (js/personas-ejemplo.js) — mismos
//   registros de ascenso de rango que ya usa Admin → Plan MW; aquí se
//   usan para saber qué rango tenía vigente cada líder al cierre del
//   mes anterior, y para detectar el bono por primera vez en un rango.
//
// ⚠️ NOTA DE ARQUITECTURA — dato que NO existía y tuve que introducir:
// el sistema no tenía un registro de compras por persona con fecha y
// con separación normal/souvenirs (solo existía un total agregado del
// mes en curso: persona.constancia.montoMesActual). Sin ese desglose no
// se puede aplicar la regla "los souvenirs no comisionan". Mientras no
// exista Firestore con compras reales, este archivo DERIVA un desglose
// determinístico (no aleatorio) a partir de montoMesActual — ver
// obtenerComprasPersonaPeriodo(). Es una aproximación clara y declarada,
// no una fuente de verdad distinta: en cuanto exista una colección real
// de compras, solo esta función necesita cambiar.
//
// ⚠️ TEMPORAL: localStorage simula Firestore. Se reemplaza en Fase 3.

const COMISIONES_AJUSTES_KEY = 'mw-comisiones-ajustes-v1';
const COMISIONES_HISTORIAL_KEY = 'mw-comisiones-historial-ajustes-v1';
const COMISIONES_BORRADOR_KEY = 'mw-comisiones-borrador-v1';
const COMISIONES_PAGOS_KEY = 'mw-comisiones-pagos-v1';
const COMISIONES_BONOS_KEY = 'mw-comisiones-bonos-v1';

const BONOS_RANGO = { plata: 2500, oro: 3500, diamante: 5000, corona: 10000 };

const IVA_DIVISOR = 1.16;

// ============================================================
// PERIODOS
// ============================================================

const MESES_COMISIONES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function obtenerPeriodoActualKey() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

function obtenerSubPeriodoActual() {
  return new Date().getDate() <= 15 ? 'p1' : 'p2';
}

function formatearPeriodoLabelComisiones(yyyyMM) {
  const [anio, mes] = yyyyMM.split('-').map(Number);
  const nombre = MESES_COMISIONES[mes - 1];
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}

// Rango de días + fecha de pago de cada sub-periodo (reglas fijas del
// Plan MW: Periodo 1 = días 1-15, paga el día 20 del mismo mes;
// Periodo 2 = día 16-fin de mes, paga el día 5 del mes siguiente).
function obtenerInfoSubPeriodo(periodoKey, subPeriodo) {

  const [anio, mes] = periodoKey.split('-').map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();

  if (subPeriodo === 'p1') {
    return {
      label: 'Periodo 1 · 1–15',
      rango: `1–15 de ${MESES_COMISIONES[mes - 1]}`,
      fechaPago: `20 de ${MESES_COMISIONES[mes - 1]} ${anio}`
    };
  }

  const mesPago = mes === 12 ? 1 : mes + 1;
  const anioPago = mes === 12 ? anio + 1 : anio;

  return {
    label: `Periodo 2 · 16–${ultimoDia}`,
    rango: `16–${ultimoDia} de ${MESES_COMISIONES[mes - 1]}`,
    fechaPago: `5 de ${MESES_COMISIONES[mesPago - 1]} ${anioPago}`
  };

}

// ============================================================
// RANGO APLICADO AL PERIODO (cierre del mes anterior)
// ============================================================

function calcularRangoAplicadoPeriodo(persona, periodoKey) {

  const inicioPeriodo = `${periodoKey}-01T00:00:00.000Z`;

  const ascensosAnteriores = (persona.historialLogros || [])
    .filter(l => l.tipo === 'ascenso_rango' && l.fecha < inicioPeriodo)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  if (ascensosAnteriores.length) {
    const ultimo = ascensosAnteriores[0];
    const fecha = new Date(ultimo.fecha);
    const mesCierre = `${MESES_COMISIONES[fecha.getMonth()]} ${fecha.getFullYear()}`;
    return { rangoKey: ultimo.rangoNuevo, origen: `cierre de ${mesCierre}` };
  }

  return { rangoKey: persona.rangoActualKey, origen: 'sin cambios de rango registrados todavía' };

}

// ============================================================
// COMPRAS DEL PERIODO (normal vs souvenirs) — ver nota de
// arquitectura al inicio del archivo.
// ============================================================

function hashSimplePersona(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function obtenerComprasPersonaPeriodo(persona, periodoKey, subPeriodo) {

  // Todavía no existe un histórico real de compras por periodo — solo
  // se puede derivar el periodo/sub-periodo ACTUAL a partir del total
  // del mes en curso ya usado en el resto del portal.
  if (periodoKey !== obtenerPeriodoActualKey()) {
    return { normal: 0, souvenir: 0 };
  }

  const total = Number(persona.constancia?.montoMesActual || 0);
  const fraccion = subPeriodo === 'p1' ? 0.55 : 0.45;
  const montoSubPeriodo = Math.round(total * fraccion);

  // Marca souvenirs de forma determinística (no aleatoria) para poder
  // demostrar la regla "los souvenirs no comisionan" con datos reales
  // y estables entre recargas, en vez de inventar una compra ficticia.
  const tieneSouvenir = hashSimplePersona(persona.id) % 3 === 0;
  const souvenir = tieneSouvenir ? Math.round(montoSubPeriodo * 0.12) : 0;
  const normal = montoSubPeriodo - souvenir;

  return { normal, souvenir };

}

// ============================================================
// AJUSTES MANUALES
// ============================================================

function construirClaveAjuste(liderId, personaId, periodoKey, subPeriodo) {
  return `${liderId}__${personaId}__${periodoKey}__${subPeriodo}`;
}

function obtenerAjustes() {
  try {
    const datos = JSON.parse(localStorage.getItem(COMISIONES_AJUSTES_KEY));
    return datos && typeof datos === 'object' ? datos : {};
  } catch (error) {
    return {};
  }
}

function guardarAjustes(ajustes) {
  localStorage.setItem(COMISIONES_AJUSTES_KEY, JSON.stringify(ajustes));
}

function obtenerAjuste(clave) {
  return obtenerAjustes()[clave] || null;
}

function guardarAjusteManual({ liderId, emprendedoraId, periodoKey, subPeriodo, valorCalculado, valorNuevo, motivo, usuarioAdminId, usuarioAdminNombre }) {

  const clave = construirClaveAjuste(liderId, emprendedoraId, periodoKey, subPeriodo);
  const ajustes = obtenerAjustes();
  const anterior = ajustes[clave];

  const registro = {
    tipo: 'ajusteComision',
    liderId,
    emprendedoraId,
    periodo: `${periodoKey}-${subPeriodo}`,
    valorCalculado,
    valorAnterior: anterior ? anterior.valorNuevo : valorCalculado,
    valorNuevo,
    motivo: motivo || '',
    usuarioAdminId,
    fecha: new Date().toISOString()
  };

  ajustes[clave] = registro;
  guardarAjustes(ajustes);
  registrarHistorialAjuste(registro);

  registrarAuditoriaAdmin({
    modulo: 'comisiones',
    accion: 'ajuste_manual',
    descripcion: `Ajuste de comisión (${registro.periodo}): $${registro.valorAnterior.toFixed(2)} → $${valorNuevo.toFixed(2)}${motivo ? ` — ${motivo}` : ''}`
  });

  return registro;

}

// Bitácora de ajustes — SOLO se agrega, nunca se borra ni se sobrescribe
// (a diferencia de obtenerAjustes(), que guarda solo el valor VIGENTE por
// clave). Esta es la fuente de "Trazabilidad": el historial completo de
// cada emprendedora/periodo, con la forma exacta pedida (tipo, liderId,
// emprendedoraId, periodo, valorCalculado, valorAnterior, valorNuevo,
// motivo, usuarioAdminId, fecha).
function obtenerHistorialAjustes() {
  try {
    const registros = JSON.parse(localStorage.getItem(COMISIONES_HISTORIAL_KEY));
    return Array.isArray(registros) ? registros : [];
  } catch (error) {
    return [];
  }
}

function registrarHistorialAjuste(registro) {
  const historial = obtenerHistorialAjustes();
  historial.push(registro);
  localStorage.setItem(COMISIONES_HISTORIAL_KEY, JSON.stringify(historial));
}

function obtenerHistorialAjustePersona(liderId, personaId, periodoKey, subPeriodo) {
  const periodo = `${periodoKey}-${subPeriodo}`;
  return obtenerHistorialAjustes()
    .filter(r => r.liderId === liderId && r.emprendedoraId === personaId && r.periodo === periodo)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function restaurarCalculoAutomatico({ liderId, emprendedoraId, periodoKey, subPeriodo, usuarioAdminId }) {

  const clave = construirClaveAjuste(liderId, emprendedoraId, periodoKey, subPeriodo);
  const ajustes = obtenerAjustes();
  if (!ajustes[clave]) return;

  const anterior = ajustes[clave];
  delete ajustes[clave];
  guardarAjustes(ajustes);

  registrarAuditoriaAdmin({
    modulo: 'comisiones',
    accion: 'restaurar_calculo',
    descripcion: `Se restauró el cálculo automático de comisión (${anterior.periodo}), antes ajustada a $${anterior.valorNuevo.toFixed(2)}`
  });

}

// ============================================================
// PAGOS
// ============================================================

function obtenerPagos() {
  try {
    const datos = JSON.parse(localStorage.getItem(COMISIONES_PAGOS_KEY));
    return datos && typeof datos === 'object' ? datos : {};
  } catch (error) {
    return {};
  }
}

function guardarPagos(pagos) {
  localStorage.setItem(COMISIONES_PAGOS_KEY, JSON.stringify(pagos));
}

function construirClavePago(liderId, periodoKey, subPeriodo) {
  return `${liderId}__${periodoKey}__${subPeriodo}`;
}

function obtenerEstadoPago(liderId, periodoKey, subPeriodo) {
  const pagos = obtenerPagos();
  return pagos[construirClavePago(liderId, periodoKey, subPeriodo)] || { estado: 'pendiente' };
}

function registrarPago({ liderId, periodoKey, subPeriodo, montoPagado, registradoPor }) {
  const pagos = obtenerPagos();
  const clave = construirClavePago(liderId, periodoKey, subPeriodo);
  pagos[clave] = {
    estado: 'pagada',
    fechaPago: new Date().toISOString(),
    registradoPor,
    montoPagado,
    periodo: `${periodoKey}-${subPeriodo}`
  };
  guardarPagos(pagos);

  registrarAuditoriaAdmin({
    modulo: 'comisiones',
    accion: 'registrar_pago',
    descripcion: `Pago de comisión registrado (${periodoKey}-${subPeriodo}) por $${Number(montoPagado).toFixed(2)}`
  });
}

// ============================================================
// BONO POR RANGO (primera vez únicamente)
// ============================================================

function obtenerBonos() {
  try {
    const datos = JSON.parse(localStorage.getItem(COMISIONES_BONOS_KEY));
    return datos && typeof datos === 'object' ? datos : {};
  } catch (error) {
    return {};
  }
}

function guardarBonos(bonos) {
  localStorage.setItem(COMISIONES_BONOS_KEY, JSON.stringify(bonos));
}

// Devuelve el bono correspondiente a este periodo (si el ascenso a un
// rango con bono ocurrió dentro del mes del periodo), o null si no
// aplica. "pagado" refiere al REGISTRO del bono, no a la comisión.
function obtenerBonoRangoPeriodo(persona, periodoKey) {

  const ascensoDelPeriodo = (persona.historialLogros || []).find(l =>
    l.tipo === 'ascenso_rango' && l.fecha.slice(0, 7) === periodoKey && BONOS_RANGO[l.rangoNuevo]
  );

  if (!ascensoDelPeriodo) return null;

  const clave = `${persona.id}__${ascensoDelPeriodo.rangoNuevo}`;
  const bonos = obtenerBonos();
  const registro = bonos[clave];

  return {
    rango: ascensoDelPeriodo.rangoNuevo,
    monto: BONOS_RANGO[ascensoDelPeriodo.rangoNuevo],
    fechaAscenso: ascensoDelPeriodo.fecha,
    pagado: !!registro,
    fechaPago: registro?.fechaPago || null,
    registradoPor: registro?.registradoPor || null,
    clave
  };

}

function registrarPagoBono(clave, registradoPor) {
  const bonos = obtenerBonos();
  bonos[clave] = { fechaPago: new Date().toISOString(), registradoPor };
  guardarBonos(bonos);

  registrarAuditoriaAdmin({
    modulo: 'comisiones',
    accion: 'pagar_bono_rango',
    descripcion: `Bono por rango registrado como pagado (${clave})`
  });
}

// ============================================================
// BORRADOR (autoguardado local, previo a "sincronizar")
// ============================================================

function obtenerBorrador() {
  try {
    const datos = JSON.parse(localStorage.getItem(COMISIONES_BORRADOR_KEY));
    return datos && typeof datos === 'object' ? datos : null;
  } catch (error) {
    return null;
  }
}

function guardarBorrador(pendiente) {
  localStorage.setItem(COMISIONES_BORRADOR_KEY, JSON.stringify({ ...pendiente, guardadoEn: new Date().toISOString() }));
}

function descartarBorrador() {
  localStorage.removeItem(COMISIONES_BORRADOR_KEY);
}

// ============================================================
// CÁLCULO POR PERSONA / NIVEL / LÍDER
// ============================================================

function calcularFilaComision(persona, nivel, pct, liderId, periodoKey, subPeriodo) {

  const compras = obtenerComprasPersonaPeriodo(persona, periodoKey, subPeriodo);
  const base = compras.normal / IVA_DIVISOR;
  const comisionCalculada = base * (pct / 100);

  const clave = construirClaveAjuste(liderId, persona.id, periodoKey, subPeriodo);
  const ajuste = obtenerAjuste(clave);
  const comisionFinal = ajuste ? ajuste.valorNuevo : comisionCalculada;

  return {
    persona,
    nivel,
    pct,
    compraNormal: compras.normal,
    compraSouvenir: compras.souvenir,
    base,
    comisionCalculada,
    comisionFinal,
    ajuste,
    clave
  };

}

function calcularComisionesLider(liderPersona, periodoKey, subPeriodo) {

  const { conNivel } = calcularDescendenciaPersona(liderPersona.id);
  const { rangoKey, origen } = calcularRangoAplicadoPeriodo(liderPersona, periodoKey);
  const pcts = COMISIONES_PCT[rangoKey] || COMISIONES_PCT.sin_rango;

  const niveles = [1, 2, 3, 4, 5].map(nivel => {
    const miembros = conNivel.filter(c => c.nivel === nivel).map(c => c.persona);
    const pct = pcts[nivel - 1] || 0;
    const filas = miembros.map(m => calcularFilaComision(m, nivel, pct, liderPersona.id, periodoKey, subPeriodo));
    const totalNivel = filas.reduce((s, f) => s + f.comisionFinal, 0);
    return { nivel, pct, filas, totalNivel };
  });

  const totalComision = niveles.reduce((s, n) => s + n.totalNivel, 0);
  const todasLasFilas = niveles.flatMap(n => n.filas);
  const personasConComision = todasLasFilas.filter(f => f.comisionFinal > 0).length;
  const personasSinComision = todasLasFilas.length - personasConComision;
  const compraConsiderada = todasLasFilas.reduce((s, f) => s + f.compraNormal, 0);
  const tieneAjustes = todasLasFilas.some(f => f.ajuste);
  const bono = obtenerBonoRangoPeriodo(liderPersona, periodoKey);
  const estadoPago = obtenerEstadoPago(liderPersona.id, periodoKey, subPeriodo);

  return {
    lider: liderPersona,
    rangoKey,
    origenRango: origen,
    niveles,
    totalComision,
    personasConComision,
    personasSinComision,
    compraConsiderada,
    tieneAjustes,
    bono,
    estadoPago,
    totalEquipo: conNivel.length
  };

}

function calcularTodasLasComisiones(periodoKey, subPeriodo) {
  return obtenerPersonas()
    .filter(p => p.tipo === 'lider')
    .map(lider => calcularComisionesLider(lider, periodoKey, subPeriodo));
}
