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
// ⚠️ TEMPORAL: localStorage simula Firestore. Se reemplaza en Fase 3.

const RIFA_BOLETOS_STORAGE_KEY = 'mw-rifa-boletos-folios-v1';

const MESES_RIFA_BOLETOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function obtenerRegistroBoletosRifa() {
  try {
    const datos = JSON.parse(localStorage.getItem(RIFA_BOLETOS_STORAGE_KEY));
    return (datos && typeof datos === 'object' && !Array.isArray(datos)) ? datos : {};
  } catch (error) {
    return {};
  }
}

function guardarRegistroBoletosRifa(registro) {
  localStorage.setItem(RIFA_BOLETOS_STORAGE_KEY, JSON.stringify(registro));
}

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

function formatearFolioBoleto(numero) {
  return `MW-${String(numero).padStart(5, '0')}`;
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

function sincronizarBoletosRifaMes(mesKey) {
  const registro = obtenerRegistroBoletosRifa();
  const boletosMes = registro[mesKey] || [];
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
  registro[mesKey] = boletosMes;
  guardarRegistroBoletosRifa(registro);
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
// BOLETO IMPRIMIBLE (SVG tipo boleto físico) — Lista A, fusión con mi-equipo
// ============================================================

function escapeXMLBoletoRifa(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function construirSVGBoletoRifa(boleto) {
  const folioLabel = formatearFolioBoleto(boleto.folio);
  const mesLabel = `${MESES_RIFA_BOLETOS[Number(boleto.mesKey.split('-')[1]) - 1]} ${boleto.mesKey.split('-')[0]}`;
  const fechaSorteo = formatearFechaSorteoRifaMes(boleto.mesKey);
  const nombre = escapeXMLBoletoRifa(boleto.personaNombre);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="220" viewBox="0 0 600 220" font-family="Georgia, serif">
  <rect x="1" y="1" width="598" height="218" rx="12" fill="#ffffff" stroke="#5E1A8A" stroke-width="2"/>
  <rect x="1" y="1" width="420" height="218" rx="12" fill="#ffffff"/>
  <line x1="420" y1="1" x2="420" y2="219" stroke="#5E1A8A" stroke-width="1.5" stroke-dasharray="6,5"/>
  <circle cx="420" cy="1" r="10" fill="#f6f3f8" stroke="#5E1A8A" stroke-width="1.5"/>
  <circle cx="420" cy="219" r="10" fill="#f6f3f8" stroke="#5E1A8A" stroke-width="1.5"/>

  <text x="28" y="38" font-size="13" letter-spacing="2" fill="#C9A227" font-weight="bold">MOONWOLF JOYERÍA</text>
  <text x="28" y="62" font-size="20" fill="#5E1A8A" font-weight="bold">Boleto de la Rifa del mes</text>
  <text x="28" y="90" font-size="14" fill="#312044">Participante:</text>
  <text x="28" y="112" font-size="17" fill="#312044" font-weight="bold">${nombre}</text>
  <text x="28" y="140" font-size="13" fill="#6B6270">Mes de compra: ${escapeXMLBoletoRifa(mesLabel)}</text>
  <text x="28" y="160" font-size="13" fill="#6B6270">Sorteo oficial: ${escapeXMLBoletoRifa(fechaSorteo)}</text>
  <text x="28" y="196" font-size="11" fill="#a79bb0">Vale por una participación en la rifa mensual de MW Joyería.</text>

  <text x="510" y="70" font-size="11" fill="#6B6270" text-anchor="middle">FOLIO</text>
  <text x="510" y="112" font-size="22" fill="#5E1A8A" font-weight="bold" text-anchor="middle">${escapeXMLBoletoRifa(folioLabel)}</text>
  <text x="510" y="160" font-size="11" fill="#6B6270" text-anchor="middle">${escapeXMLBoletoRifa(mesLabel)}</text>
  <path d="M470 90 h80 M470 96 h80 M470 102 h80 M470 108 h80 M470 114 h80 M470 120 h80" stroke="#C9A227" stroke-width="1.4" opacity="0.45"/>
</svg>`;
}

function descargarSVGBoletoRifa(boleto) {
  const svg = construirSVGBoletoRifa(boleto);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `boleto-${formatearFolioBoleto(boleto.folio)}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
