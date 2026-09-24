// MW JOYERÍA — Motor de compras reales (Secciones 4, 7 y 8)
//
// Deriva "compra" de cada persona a partir de las piezas de apartado ya
// LIQUIDADAS (pagadas) — una pieza apartada pero sin pagar todavía NO
// cuenta para ningún cálculo (decisión de negocio confirmada: nadie
// gana rango/comisión/constancia/rifa por algo que ni siquiera se pagó).
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
function fechaLiquidacionPieza(pieza) {
  if (pieza.estado !== 'liquidada' || !pieza.pagos?.length) return null;
  return pieza.pagos[pieza.pagos.length - 1].fecha || null;
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

// Recorre TODAS las piezas liquidadas de una persona y aplica un
// filtro de fecha (recibe el ISO de liquidación) — evita repetir el
// mismo doble-forEach en cada función pública de este archivo.
function _acumularComprasLiquidadasPersona(personaId, filtroFecha) {
  const ventanas = obtenerVentanasApartado().filter(v => v.usuarioId === personaId);
  let normal = 0;
  let souvenir = 0;
  ventanas.forEach(v => {
    (v.apartados || []).forEach(pieza => {
      const fecha = fechaLiquidacionPieza(pieza);
      if (!fecha || !filtroFecha(fecha)) return;
      const monto = Number(pieza.total || 0);
      if (pieza.material === 'souvenirs') souvenir += monto; else normal += monto;
    });
  });
  return { normal, souvenir, total: normal + souvenir };
}

// Compras liquidadas de UNA persona en UN mes calendario completo.
function obtenerComprasLiquidadasPersonaMes(personaId, mesKey) {
  return _acumularComprasLiquidadasPersona(personaId, fecha => mesKeyDeFecha(fecha) === mesKey);
}

// Compras liquidadas de UNA persona en UN sub-periodo quincenal del Plan
// MW (p1 = días 1–15, p2 = 16–fin de mes), dentro de un mes calendario.
function obtenerComprasLiquidadasPersonaSubPeriodo(personaId, mesKey, subPeriodo) {
  return _acumularComprasLiquidadasPersona(personaId, fecha => {
    if (mesKeyDeFecha(fecha) !== mesKey) return false;
    const dia = diaDeFecha(fecha);
    return subPeriodo === 'p1' ? dia <= 15 : dia > 15;
  });
}

// Compras liquidadas de UNA persona desde una fecha ISO hasta hoy —
// ventana rodante en días (no mes calendario), a diferencia de las dos
// funciones de arriba. Usada por js/alertas-inactividad-modelo.js para
// la alerta de "N semanas sin compra mínima" hacia las líderes.
function obtenerComprasLiquidadasPersonaDesde(personaId, fechaDesdeISO) {
  return _acumularComprasLiquidadasPersona(personaId, fecha => fecha >= fechaDesdeISO);
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
