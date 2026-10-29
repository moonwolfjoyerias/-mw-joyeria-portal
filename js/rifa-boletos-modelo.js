// MW JOYERÍA — Boletos de la Rifa del mes (folio + fecha de sorteo)
//
// Fusión de la Lista A (repo mi-equipo): antes el portal solo decía
// "llevas N boletos" (js/cuenta.js) sin ningún folio ni fecha de sorteo
// oficial. Esto NO cambia quién gana boletos ni cuántos — sigue viniendo
// de persona.rifa.boletosPorMes (js/plan-mw-admin.js, calculado de
// compras reales) — solo le pone folio consecutivo y fecha de sorteo a
// cada boleto ya ganado, para poder imprimirlos como boleto físico.
//
// Folios: una vez que un boleto se numera, ese folio NUNCA cambia — si
// alguien gana boletos extra después (nueva compra en el mismo mes), se
// le agregan folios nuevos al final, nunca se renumera a nadie.
//
// FIRESTORE (oct-2026): los folios de cada mes viven en `rifaBoletos/{AAAA-MM}`
// ({ boletos: [...] }), así son los mismos en cualquier equipo. Los folios
// nuevos se agregan en una transacción sobre lo que ya hay en el servidor
// (dos administradoras a la vez no repiten folio). La primera vez, los
// folios que este navegador ya tenía (quizá ya impresos) se suben tal cual.
// Sin Firebase (modo demo) sigue en localStorage.

const RIFA_BOLETOS_STORAGE_KEY = 'mw-rifa-boletos-folios-v1';
const RIFA_BOLETOS_COLECCION = 'rifaBoletos';
let RIFA_BOLETOS_CACHE = null; // mesKey → boletos (con Firebase real)

const MESES_RIFA_BOLETOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function _registroBoletosLocal() {
  try {
    const datos = JSON.parse(localStorage.getItem(RIFA_BOLETOS_STORAGE_KEY));
    return (datos && typeof datos === 'object' && !Array.isArray(datos)) ? datos : {};
  } catch (error) {
    return {};
  }
}

function _rifaBoletosEnFirestore() {
  return typeof dbFirestore !== 'undefined' && Boolean(dbFirestore);
}

function obtenerRegistroBoletosRifa() {
  if (_rifaBoletosEnFirestore()) return JSON.parse(JSON.stringify(RIFA_BOLETOS_CACHE || {}));
  return _registroBoletosLocal();
}

function guardarRegistroBoletosRifa(registro, mesKey) {
  if (!_rifaBoletosEnFirestore()) {
    localStorage.setItem(RIFA_BOLETOS_STORAGE_KEY, JSON.stringify(registro));
    return;
  }
  if (!mesKey) return;
  RIFA_BOLETOS_CACHE = RIFA_BOLETOS_CACHE || {};
  RIFA_BOLETOS_CACHE[mesKey] = registro[mesKey];
  // En el servidor se vuelve a asignar sobre lo que ya tiene (transacción):
  // nunca se renumera un folio que ya existía.
  const ref = dbFirestore.collection(RIFA_BOLETOS_COLECCION).doc(mesKey);
  dbFirestore.runTransaction(async tx => {
    const doc = await tx.get(ref);
    const enServidor = doc.exists && Array.isArray(doc.data().boletos) ? doc.data().boletos : [];
    const boletos = _asignarFoliosRifa(enServidor, mesKey);
    if (textoEstableFirestore(boletos) !== textoEstableFirestore(enServidor)) tx.set(ref, { boletos, mesKey });
    return boletos;
  }).then(boletos => {
    RIFA_BOLETOS_CACHE[mesKey] = boletos;
  }).catch(error => {
    console.error('No se pudieron guardar los folios de la rifa:', error);
    if (typeof mostrarToast === 'function') mostrarToast('No se pudieron guardar los folios de la rifa en el servidor. Vuelve a cargar la página antes de imprimir.');
  });
}

async function cargarRifaBoletosRepo() {
  if (!_rifaBoletosEnFirestore()) return;
  const inicio = Date.now();
  while (!(typeof obtenerSesionActiva === 'function' && obtenerSesionActiva()) && Date.now() - inicio < 15000) await new Promise(r => setTimeout(r, 150));
  try {
    const snap = await dbFirestore.collection(RIFA_BOLETOS_COLECCION).get();
    RIFA_BOLETOS_CACHE = {};
    snap.docs.forEach(d => { RIFA_BOLETOS_CACHE[d.id] = Array.isArray(d.data().boletos) ? d.data().boletos : []; });
    // Folios que este navegador ya tenía (antes de Firestore): se suben tal cual.
    const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
    if (sesion && sesion.rol === 'admin') {
      const locales = _registroBoletosLocal();
      const faltan = Object.keys(locales).filter(mes => !RIFA_BOLETOS_CACHE[mes] && Array.isArray(locales[mes]) && locales[mes].length);
      if (faltan.length) {
        const lote = dbFirestore.batch();
        faltan.forEach(mes => { lote.set(dbFirestore.collection(RIFA_BOLETOS_COLECCION).doc(mes), { boletos: locales[mes], mesKey: mes }); RIFA_BOLETOS_CACHE[mes] = locales[mes]; });
        await lote.commit();
      }
    }
  } catch (error) {
    console.error('No se pudieron cargar los folios de la rifa:', error);
    RIFA_BOLETOS_CACHE = RIFA_BOLETOS_CACHE || {};
  }
}

const rifaBoletosListo = cargarRifaBoletosRepo();

// Fecha oficial de sorteo de los boletos ganados en `mesKey`: día 15 del
// mes SIGUIENTE (regla real del Plan MW, igual que la del cierre de
// Constancia/Comisiones).
function fechaSorteoRifaMes(mesKey) {
  const [anio, mes] = mesKey.split('-').map(Number);
  const mesSiguiente = mes === 12 ? 1 : mes + 1;
  const anioSiguiente = mes === 12 ? anio + 1 : anio;
  return new Date(anioSiguiente, mesSiguiente - 1, 15);
}

function formatearFechaSorteoRifaMes(mesKey) {
  const fecha = fechaSorteoRifaMes(mesKey);
  return `15 de ${MESES_RIFA_BOLETOS[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

// Mes calendario anterior a `mesKey` — el mes que ya cerró y cuyo sorteo
// cae el día 15 de `mesKey` (ver fechaSorteoRifaMes). Los boletos
// imprimibles siempre son de este mes anterior, nunca del mes en curso
// (que todavía se sigue acumulando y no está listo para imprimir).
function mesKeyAnteriorRifaBoletos(mesKey) {
  const [anio, mes] = mesKey.split('-').map(Number);
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anioAnterior = mes === 1 ? anio - 1 : anio;
  return `${anioAnterior}-${String(mesAnterior).padStart(2, '0')}`;
}

// Genera/actualiza los boletos numerados de un mes a partir de los
// boletos YA GANADOS (persona.rifa.boletosPorMes[mesKey]) — nunca
// inventa boletos nuevos, solo les pone folio. Si se vuelve a llamar
// (ej. alguien ganó un boleto extra por una compra nueva), agrega solo
// los folios que faltan, sin tocar los que ya existían.
// Boletos ganados por una persona en `mesKey`: para un mes ya cerrado
// se usa el conteo final (persona.rifa.boletosPorMes, congelado por
// procesarCierresMensualesPlanMW). Para el mes EN CURSO ese cierre
// todavía no corre — se calcula en vivo con la misma fórmula que ya usa
// js/cuenta.js ("¡Llevas N boletos!"), sobre las compras normales ya
// liquidadas de este mes, para no mostrar siempre 0 mientras el mes
// sigue abierto.
function calcularBoletosGanadosMes(persona, mesKey) {
  const mesActual = typeof mesKeyActualComprasModelo === 'function' ? mesKeyActualComprasModelo() : mesKey;

  if (mesKey < mesActual) {
    return (persona.rifa && persona.rifa.boletosPorMes && persona.rifa.boletosPorMes[mesKey]) || 0;
  }

  if (typeof obtenerComprasLiquidadasPersonaMes !== 'function') return 0;
  const meta = (typeof obtenerValorVigente === 'function' && obtenerValorVigente('rifa', 'meta_mensual')) || (typeof META_RIFA_MENSUAL !== 'undefined' ? META_RIFA_MENSUAL : 3000);
  const montoPorBoletoExtra = (typeof obtenerValorVigente === 'function' && obtenerValorVigente('rifa', 'monto_por_boleto_extra')) || (typeof MONTO_POR_BOLETO_EXTRA_RIFA !== 'undefined' ? MONTO_POR_BOLETO_EXTRA_RIFA : 1000);
  const comprasNormalesMes = obtenerComprasLiquidadasPersonaMes(persona.id, mesKey).normal;
  if (comprasNormalesMes < meta) return 0;
  return 1 + Math.floor((comprasNormalesMes - meta) / montoPorBoletoExtra);
}

// Agrega a `boletosExistentes` los folios que falten (nunca renumera).
function _asignarFoliosRifa(boletosExistentes, mesKey) {
  const boletosMes = boletosExistentes.map(b => ({ ...b }));
  const yaAsignados = {};
  boletosMes.forEach(b => { yaAsignados[b.personaId] = (yaAsignados[b.personaId] || 0) + 1; });

  let siguienteFolio = boletosMes.reduce((max, b) => Math.max(max, b.folio), 0) + 1;

  const personas = obtenerPersonas()
    .filter(p => p.estado !== 'baja' && calcularBoletosGanadosMes(p, mesKey) > 0)
    .sort((a, b) => nombreCompletoPersona(a).localeCompare(nombreCompletoPersona(b)));

  personas.forEach(persona => {
    const totalGanados = calcularBoletosGanadosMes(persona, mesKey);
    const yaTiene = yaAsignados[persona.id] || 0;
    for (let i = yaTiene; i < totalGanados; i++) {
      boletosMes.push({
        folio: siguienteFolio,
        personaId: persona.id,
        personaNombre: nombreCompletoPersona(persona),
        mesKey,
        asignadoEn: new Date().toISOString()
      });
      siguienteFolio++;
    }
  });

  boletosMes.sort((a, b) => a.folio - b.folio);
  return boletosMes;
}

function sincronizarBoletosRifaMes(mesKey) {
  const registro = obtenerRegistroBoletosRifa();
  const antes = registro[mesKey] || [];
  const boletosMes = _asignarFoliosRifa(antes, mesKey);
  if (boletosMes.length !== antes.length) {
    registro[mesKey] = boletosMes;
    guardarRegistroBoletosRifa(registro, mesKey);
  }
  return boletosMes;
}

function obtenerBoletosRifaMes(mesKey) {
  return sincronizarBoletosRifaMes(mesKey);
}

// Boletos agrupados por persona, con su rango de folios — para la vista
// resumen (una fila por persona en vez de una fila por boleto).
function obtenerResumenBoletosPorPersonaRifaMes(mesKey) {
  const boletos = obtenerBoletosRifaMes(mesKey);
  const porPersona = {};
  boletos.forEach(b => {
    porPersona[b.personaId] = porPersona[b.personaId] || { personaId: b.personaId, personaNombre: b.personaNombre, boletos: [] };
    porPersona[b.personaId].boletos.push(b);
  });
  return Object.values(porPersona).sort((a, b) => a.personaNombre.localeCompare(b.personaNombre));
}

// ============================================================
// BOLETO IMPRIMIBLE (ficha HTML, para el PDF compactado de "Descargar
// todos") — Lista A, fusión con mi-equipo. Rectangular, esquinas poco
// redondeadas, colores MW Joyería. Trae DOS folios:
//  - "Local": posición del boleto dentro de los boletos de ESA persona
//    (1, 2, 3...) — se calcula al armar el PDF, no se guarda.
//  - "General": el folio consecutivo de siempre (boleto.folio), en la
//    esquina inferior derecha — el número del boleto entre TODOS los
//    de ese mes.
// ============================================================

function construirHTMLBoletoRifaImprimible(boleto, folioLocal) {
  const mesLabelCrudo = `${MESES_RIFA_BOLETOS[Number(boleto.mesKey.split('-')[1]) - 1]} ${boleto.mesKey.split('-')[0]}`;
  const mesLabel = mesLabelCrudo.charAt(0).toUpperCase() + mesLabelCrudo.slice(1);
  const nombre = escapeHTMLPersonas(boleto.personaNombre);

  return `
    <div style="position:relative;width:100%;height:100%;box-sizing:border-box;border:2px solid #5E1A8A;border-radius:14px;background:#ffffff;padding:14px 16px;font-family:Georgia,'Times New Roman',serif;overflow:hidden;">
      <div style="font-size:9px;letter-spacing:1.6px;color:#C9A227;font-weight:700;">MOONWOLF JOYERÍA</div>
      <div style="font-size:16px;color:#5E1A8A;font-weight:700;margin-top:3px;">Rifa Mensual</div>
      <div style="font-size:10.5px;color:#6B6270;margin-top:5px;">${escapeHTMLPersonas(mesLabel)}</div>
      <div style="font-size:14px;color:#312044;font-weight:700;margin-top:9px;max-width:78%;">${nombre}</div>
      <div style="font-size:10px;color:#8a7f93;margin-top:2px;">${nombre} ${folioLocal}</div>
      <div style="position:absolute;right:14px;bottom:10px;font-size:19px;font-weight:700;color:#5E1A8A;">${boleto.folio}</div>
    </div>
  `;
}

// Una hoja tamaño Carta con hasta 10 boletos (2 columnas × 5 filas).
// `folioLocalPorFolio` es un Map<folioGeneral, folioLocal> ya calculado
// por quien arma el PDF completo (ver generarPDFBoletosRifa en
// js/admin-plan-mw.js).
function construirHTMLHojaBoletosRifa(boletosHoja, folioLocalPorFolio) {
  const celdas = boletosHoja
    .map(b => construirHTMLBoletoRifaImprimible(b, folioLocalPorFolio.get(b.folio)))
    .join('');

  return `
    <div style="width:850px;height:1100px;box-sizing:border-box;padding:40px;background:#ffffff;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(5,1fr);gap:18px 22px;">
      ${celdas}
    </div>
  `;
}
