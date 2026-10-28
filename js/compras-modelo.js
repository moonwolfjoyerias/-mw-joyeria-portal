// MW JOYERÍA — Motor de compras reales (Secciones 4, 7 y 8)
//
// Deriva "compra" de cada persona de las compras de Aronium por quincena
// (fuente oficial, ver obtenerComprasLiquidadasPersonaSubPeriodo) y, en
// las quincenas sin archivo de Aronium, de las piezas de apartado ya
// LIQUIDADAS (pagadas) — una pieza apartada pero sin pagar todavía NO
// cuenta para ningún cálculo (decisión de negocio confirmada: nadie
// gana rango/comisión/constancia/rifa por algo que ni siquiera se pagó).
// Además, una pieza liquidada en la página cuenta hasta que BRILLO MW la
// confirma (ver fechaCompraPieza); las compras en la caja de BRILLO cuentan
// solas (js/compras-brillo-firestore-sync.js).
//
// Separa Souvenir de compra normal usando pieza.material (grabado al
// momento de apartar en apartados-modelo.js, tomado del catálogo real):
// Souvenirs SÍ cuentan para activa mensual / compra personal de líder /
// número de personas del equipo calificadas, pero NUNCA para producción
// grupal, comisión de líder, Reto de Constancia o Rifas (Sección 4).
//
// personaId aquí es el mismo id que usa personas-ejemplo.js — coincide
// con ventana.usuarioId porque ambos se derivan de slugUsuarioId(nombre).
//
// ⚠️ TEMPORAL: localStorage simula Firestore. Se reemplaza en Fase 3.

// Fecha efectiva de una pieza liquidada = fecha del ÚLTIMO pago que la
// saldó (por si hubo abonos, aunque hoy el apartado se liquida completo
// de una sola vez).
// Una pieza con compraLimpiada (Admin limpió el historial de compras de la
// persona, ver admin-emprendedoras.js) ya no cuenta como compra.
function fechaLiquidacionPieza(pieza) {
  if (pieza.estado !== 'liquidada' || pieza.compraLimpiada || !pieza.pagos?.length) return null;
  return pieza.pagos[pieza.pagos.length - 1].fecha || null;
}

// Fecha en que la pieza CUENTA como compra, o null si no cuenta: además de
// estar liquidada, BRILLO MW la tiene que haber confirmado (ver
// js/compras-brillo-firestore-sync.js); cuenta en la fecha que BRILLO
// decidió al confirmarla.
function fechaCompraPieza(ventana, pieza) {
  const liquidada = fechaLiquidacionPieza(pieza);
  if (!liquidada) return null;
  if (typeof confirmacionCompraPiezaBrillo !== 'function') return liquidada;
  const c = confirmacionCompraPiezaBrillo(ventana.id, pieza, liquidada);
  return c.cuenta ? c.fecha : null;
}

function mesKeyDeFecha(iso) {
  return iso ? iso.slice(0, 7) : null; // 'YYYY-MM'
}

// Mes/sub-periodo VIGENTES (hoy) — con nombre propio para no chocar
// con obtenerPeriodoActualKey()/obtenerSubPeriodoActual() de
// comisiones-modelo.js, que no siempre está cargado en las mismas
// páginas que este archivo.
function mesKeyActualComprasModelo() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

function subPeriodoActualComprasModelo() {
  return new Date().getDate() <= 15 ? 'p1' : 'p2';
}

function diaDeFecha(iso) {
  return iso ? Number(iso.slice(8, 10)) : null;
}

// Recorre TODAS las compras que cuentan de una persona (piezas liquidadas y
// confirmadas por BRILLO, más sus compras en la caja de BRILLO) y aplica un
// filtro de fecha (recibe el ISO en que cuenta) — evita repetir el mismo
// doble-forEach en cada función pública de este archivo.
function _acumularComprasLiquidadasPersona(personaId, filtroFecha) {
  const ventanas = obtenerVentanasApartado().filter(v => v.usuarioId === personaId);
  let normal = 0;
  let souvenir = 0;
  ventanas.forEach(v => {
    (v.apartados || []).forEach(pieza => {
      const fecha = fechaCompraPieza(v, pieza);
      if (!fecha || !filtroFecha(fecha)) return;
      const monto = Number(pieza.total || 0);
      if (pieza.material === 'souvenirs') souvenir += monto; else normal += monto;
    });
  });
  const caja = typeof comprasCajaBrilloPersona === 'function' ? comprasCajaBrilloPersona(personaId) : [];
  caja.forEach(c => {
    if (!filtroFecha(c.fechaCuenta)) return;
    normal += c.normal;
    souvenir += c.souvenir;
  });
  return { normal, souvenir, total: normal + souvenir };
}

// ARONIUM = FUENTE OFICIAL (ver js/compras-aronium-firestore-sync.js):
// en una quincena que ya tiene su archivo de Aronium, la compra de la
// persona es lo que dice Aronium (Efectivo + Terminal + Transferencia) —
// las piezas de apartado liquidadas en esa quincena ya vienen incluidas
// ahí (se cobran en la caja), así que NO se suman aparte. En las
// quincenas sin archivo se sigue usando lo de siempre: los apartados
// liquidados. Aronium no distingue souvenir de compra normal: todo cuenta
// como normal.
function _montoAroniumQuincena(personaId, mesKey, subPeriodo) {
  return typeof montoComprasAroniumQuincena === 'function' ? montoComprasAroniumQuincena(personaId, mesKey, subPeriodo) : null;
}

function _quincenaDeFecha(fecha) {
  return { mesKey: mesKeyDeFecha(fecha), subPeriodo: diaDeFecha(fecha) <= 15 ? 'p1' : 'p2' };
}

// Compras de UNA persona en UN sub-periodo quincenal del Plan MW (p1 =
// días 1–15, p2 = 16–fin de mes), dentro de un mes calendario.
function obtenerComprasLiquidadasPersonaSubPeriodo(personaId, mesKey, subPeriodo) {
  const aronium = _montoAroniumQuincena(personaId, mesKey, subPeriodo);
  if (aronium !== null) return { normal: aronium, souvenir: 0, total: aronium, fuente: 'aronium' };
  return _acumularComprasLiquidadasPersona(personaId, fecha => {
    if (mesKeyDeFecha(fecha) !== mesKey) return false;
    const dia = diaDeFecha(fecha);
    return subPeriodo === 'p1' ? dia <= 15 : dia > 15;
  });
}

// Compras de UNA persona en UN mes calendario completo (sus dos quincenas).
function obtenerComprasLiquidadasPersonaMes(personaId, mesKey) {
  const p1 = obtenerComprasLiquidadasPersonaSubPeriodo(personaId, mesKey, 'p1');
  const p2 = obtenerComprasLiquidadasPersonaSubPeriodo(personaId, mesKey, 'p2');
  return { normal: p1.normal + p2.normal, souvenir: p1.souvenir + p2.souvenir, total: p1.total + p2.total };
}

// Compras de UNA persona desde una fecha ISO hasta hoy — ventana rodante en
// días (no mes calendario), a diferencia de las dos funciones de arriba.
// Usada por js/alertas-inactividad-modelo.js para la alerta de "N semanas
// sin compra mínima" hacia las líderes. Una quincena con archivo de Aronium
// que termina en o después de la fecha cuenta completa (Aronium no trae
// fechas por compra).
function obtenerComprasLiquidadasPersonaDesde(personaId, fechaDesdeISO) {
  const delApartado = _acumularComprasLiquidadasPersona(personaId, fecha => {
    if (fecha < fechaDesdeISO) return false;
    const { mesKey, subPeriodo } = _quincenaDeFecha(fecha);
    return _montoAroniumQuincena(personaId, mesKey, subPeriodo) === null;
  });
  let aronium = 0;
  const importadas = typeof quincenasAroniumImportadas === 'function' ? quincenasAroniumImportadas() : [];
  importadas.forEach(clave => {
    const [anio, mes, sub] = clave.split('-');
    const mesKey = `${anio}-${mes}`;
    const { hasta } = typeof rangoFechasQuincenaAronium === 'function' ? rangoFechasQuincenaAronium(mesKey, sub) : { hasta: '' };
    if (hasta >= String(fechaDesdeISO).slice(0, 10)) aronium += _montoAroniumQuincena(personaId, mesKey, sub) || 0;
  });
  return { normal: delApartado.normal + aronium, souvenir: delApartado.souvenir, total: delApartado.total + aronium };
}

// Producción grupal de TODO el equipo (toda la descendencia, no solo
// directos) de un líder en un mes — solo compra NORMAL, nunca souvenir
// (Sección 4/7.2). Requiere personas-ejemplo.js (calcularDescendenciaPersona).
function obtenerProduccionGrupalLiderMes(liderId, mesKey) {
  if (typeof calcularDescendenciaPersona !== 'function') return 0;
  const { conNivel } = calcularDescendenciaPersona(liderId);
  return conNivel.reduce((suma, n) => suma + obtenerComprasLiquidadasPersonaMes(n.persona.id, mesKey).normal, 0);
}

// Umbrales reales del Plan MW (Sección 15/7.2) — no existían como
// constantes en ningún lado del código; se documentan aquí para que
// cualquier ajuste futuro se haga en un solo lugar.
const UMBRAL_ACTIVA_MENSUAL = 500;       // compra total (normal+souvenir) POR SUB-PERIODO para contar como "activa" ese sub-periodo
const UMBRAL_EQUIPO_CALIFICADO = 1500;   // compra total (normal+souvenir) del sub-periodo para contar como "calificada" — mismo monto que exige RANGOS_MW[x].compra a la propia líder

// Estadísticas reales de rango de un líder para un mes dado — sustituye
// a los campos estáticos persona.stats.* que antes se capturaban a
// mano. Tanto personasActivas como personasCalificadas exigen que cada
// persona del equipo llegue a su umbral en LOS DOS sub-periodos del mes
// (p1 y p2) — especificación del Plan MW (Sección 3/4): "la actividad
// debe evaluarse por periodo, no solamente por mes". Si a alguien del
// equipo le falta calificar en cualquiera de los dos periodos, no
// cuenta como activa/calificada ese mes. Son NÚMEROS de personas (no un
// %) — RANGOS_MW[x].personas/calificado exigen una cantidad fija sin
// importar el tamaño del equipo. subPeriodoVigente ya no se usa aquí
// (se deja en la firma por compatibilidad con quien la llama) — antes
// solo miraba el sub-periodo de hoy, lo cual dejaba pasar a personas
// que solo habían calificado/activado en uno de los dos.
function calcularStatsRangoLider(lider, mesKey, subPeriodoVigente) {
  if (typeof calcularDescendenciaPersona !== 'function') {
    return { personasActivas: 0, produccionGrupalMes: 0, personasCalificadas: 0, compraPersonalPeriodo1: 0, compraPersonalPeriodo2: 0 };
  }

  const { conNivel } = calcularDescendenciaPersona(lider.id);
  const equipo = conNivel.map(n => n.persona);

  let produccionGrupalMes = 0;
  let personasActivas = 0;
  let personasCalificadas = 0;

  equipo.forEach(p => {
    const comprasMes = obtenerComprasLiquidadasPersonaMes(p.id, mesKey);
    produccionGrupalMes += comprasMes.normal;

    const comprasP1 = obtenerComprasLiquidadasPersonaSubPeriodo(p.id, mesKey, 'p1');
    const comprasP2 = obtenerComprasLiquidadasPersonaSubPeriodo(p.id, mesKey, 'p2');
    if (comprasP1.total >= UMBRAL_ACTIVA_MENSUAL && comprasP2.total >= UMBRAL_ACTIVA_MENSUAL) personasActivas++;
    if (comprasP1.total >= UMBRAL_EQUIPO_CALIFICADO && comprasP2.total >= UMBRAL_EQUIPO_CALIFICADO) personasCalificadas++;
  });

  const p1 = obtenerComprasLiquidadasPersonaSubPeriodo(lider.id, mesKey, 'p1');
  const p2 = obtenerComprasLiquidadasPersonaSubPeriodo(lider.id, mesKey, 'p2');

  return {
    personasActivas,
    produccionGrupalMes,
    personasCalificadas,
    compraPersonalPeriodo1: p1.total,
    compraPersonalPeriodo2: p2.total
  };
}

// ============================================================
// PRODUCCIÓN POR LÍNEA — Regla del 50% (Plan MW, Sección 5)
// ============================================================
//
// Una "línea" es cada persona invitada DIRECTAMENTE por la líder
// (descendiente de nivel 1) junto con todo su equipo debajo — nunca
// más del 50% de los puntos que exige un rango puede venir de UNA sola
// línea. Esto NO afecta comisiones ni ningún otro cálculo: solo decide
// si la producción CUENTA para el requisito de producción de ese rango
// en particular (el tope es distinto para cada rango, porque es 50%
// del requisito de ESE rango — no un tope fijo).

// Producción normal del mes de cada línea (nivel 1 + toda su descendencia).
function calcularProduccionPorLineaLider(liderId, mesKey) {
  if (typeof calcularDescendenciaPersona !== 'function') return [];

  const { porLider } = calcularDescendenciaPersona(liderId);
  const lineas = porLider[liderId] || []; // hijos directos (nivel 1) = raíz de cada línea

  return lineas.map(raizLinea => {
    const { conNivel } = calcularDescendenciaPersona(raizLinea.id);
    const integrantesLinea = [raizLinea, ...conNivel.map(n => n.persona)];
    const produccion = integrantesLinea.reduce(
      (suma, p) => suma + obtenerComprasLiquidadasPersonaMes(p.id, mesKey).normal,
      0
    );
    return { liderLineaId: raizLinea.id, nombreLinea: typeof nombreCompletoPersona === 'function' ? nombreCompletoPersona(raizLinea) : raizLinea.nombre, produccion };
  });
}

// Producción "capada" al 50% del requisito de UN rango específico — se
// usa solo para decidir si se cumple el requisito de producción de ese
// rango. El excedente de una línea que se pasa del tope no se pierde:
// sigue existiendo para comisiones (produccionGrupalMes, sin tocar),
// solo no cuenta aquí para no dejar que una sola línea cargue sola con
// todo el rango.
function calcularProduccionCapadaParaRango(liderId, mesKey, produccionRequerida) {
  const lineas = calcularProduccionPorLineaLider(liderId, mesKey);
  const topePorLinea = produccionRequerida * 0.5;
  return lineas.reduce((suma, l) => suma + Math.min(l.produccion, topePorLinea), 0);
}
