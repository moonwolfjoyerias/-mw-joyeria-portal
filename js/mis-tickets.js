// MW JOYERÍA — Mis compras: buscar mis tickets (Emprendedora / Líder)
//
// Busca por fechas y por pieza (nombre o código) sin abrir todas sus
// compras: BRILLO guarda, por persona, UN documento por mes con el resumen
// de sus tickets (brilloTicketsPersona/{personaId}__{AAAA-MM}). Buscar lee
// un documento por mes del rango; ver un ticket lee solo esa venta
// (brilloVentas/{folio}) y la miniatura de cada pieza.
//
// Los apartados liquidados salen de las compras confirmadas que la página
// ya tiene en memoria (compras-brillo-firestore-sync.js): no cuestan
// lecturas extra.

const MIS_TICKETS_MAX_MESES = 24;
const _miniaturasMisTickets = new Map();

function _hoyMisTickets() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _mesesEntreMisTickets(desde, hasta) {
  const out = [];
  let [a, m] = desde.split('-').map(Number);
  const [a1, m1] = hasta.split('-').map(Number);
  while (a < a1 || (a === a1 && m <= m1)) {
    out.push(`${a}-${String(m).padStart(2, '0')}`);
    if (m === 12) { m = 1; a++; } else m++;
  }
  return out;
}

function _normalMisTickets(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function _personaMisTickets() {
  const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
  return sesion && sesion.personaId ? sesion.personaId : null;
}

function _diaLocalMisTickets(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _fechaMisTickets(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

function _dineroMisTickets(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function _miniaturaMisTickets(productoId) {
  if (!productoId || typeof dbFirestore === 'undefined' || !dbFirestore) return '';
  if (_miniaturasMisTickets.has(productoId)) return _miniaturasMisTickets.get(productoId);
  let src = '';
  try {
    const doc = await dbFirestore.collection('productosMiniaturas').doc(String(productoId)).get();
    src = doc.exists && doc.data().src ? doc.data().src : '';
  } catch (error) { /* sin foto */ }
  _miniaturasMisTickets.set(productoId, src);
  return src;
}

function renderBuscadorMisTickets() {
  const cont = document.getElementById('misTicketsBuscador');
  if (!cont) return;
  const hoy = _hoyMisTickets();
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  cont.innerHTML = `
    <div class="cfg-card mis-tickets">
      <h3 class="cfg-card-title">Buscar mis tickets</h3>
      <p class="cfg-card-sub">Busca por fechas, o por el nombre o código de una pieza. Toca un ticket para verlo con las fotos de tus piezas.</p>
      <form id="misTicketsForm" class="mis-tickets-filtros">
        <label>Desde<input type="date" id="misTicketsDesde" value="${inicioMes}" max="${hoy}"></label>
        <label>Hasta<input type="date" id="misTicketsHasta" value="${hoy}" max="${hoy}"></label>
        <label class="mis-tickets-pieza">Pieza (opcional)<input type="search" id="misTicketsTexto" placeholder="Ej. anillo luna o ANIX0001"></label>
        <button class="btn btn-primary" type="submit">Buscar</button>
      </form>
      <div id="misTicketsResultados"></div>
    </div>`;
  document.getElementById('misTicketsForm').addEventListener('submit', e => {
    e.preventDefault();
    buscarMisTickets();
  });
}

async function buscarMisTickets() {
  const res = document.getElementById('misTicketsResultados');
  const personaId = _personaMisTickets();
  const desde = document.getElementById('misTicketsDesde').value;
  const hasta = document.getElementById('misTicketsHasta').value;
  const texto = _normalMisTickets(document.getElementById('misTicketsTexto').value);
  if (!personaId || !res) return;
  if (!desde || !hasta || desde > hasta) {
    res.innerHTML = '<p class="cfg-card-sub">Revisa las fechas: "Desde" debe ser antes de "Hasta".</p>';
    return;
  }
  const meses = _mesesEntreMisTickets(desde, hasta);
  if (meses.length > MIS_TICKETS_MAX_MESES) {
    res.innerHTML = `<p class="cfg-card-sub">Busca en un rango de hasta ${MIS_TICKETS_MAX_MESES} meses.</p>`;
    return;
  }
  res.innerHTML = '<p class="cfg-card-sub">Buscando…</p>';

  const coincide = (nombre, codigo) => !texto || _normalMisTickets(`${nombre} ${codigo || ''}`).includes(texto);

  // Tickets de la tienda (BRILLO): un documento por mes.
  let tickets = [];
  let fallo = false;
  if (typeof dbFirestore !== 'undefined' && dbFirestore) {
    const docs = await Promise.all(meses.map(m =>
      dbFirestore.collection('brilloTicketsPersona').doc(`${personaId}__${m}`).get().catch(() => { fallo = true; return null; })
    ));
    tickets = docs.flatMap(d => (d && d.exists ? (d.data().tickets || []) : []))
      .filter(t => t.estado !== 'cancelada' && t.fechaDia >= desde && t.fechaDia <= hasta)
      .filter(t => !texto || _normalMisTickets(t.folio).includes(texto) || (t.piezas || []).some(p => coincide(p.nombre, p.codigo)));
  }

  // Apartados liquidados (ya confirmados por la tienda): sin lecturas extra.
  const apartados = (typeof registrosComprasBrilloPersona === 'function' ? registrosComprasBrilloPersona(personaId) : [])
    .filter(r => r.tipo === 'apartado' && r.estado === 'confirmada')
    .filter(r => { const dia = _diaLocalMisTickets(r.fechaLiquidacion || r.fechaCuenta); return dia >= desde && dia <= hasta; })
    .filter(r => coincide(r.producto, r.codigo));

  const items = [
    ...tickets.map(t => ({ tipo: 'ticket', fecha: t.fechaLocal, t })),
    ...apartados.map(r => ({ tipo: 'apartado', fecha: r.fechaLiquidacion || r.fechaCuenta, r }))
  ].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

  if (!items.length) {
    res.innerHTML = `<p class="cfg-card-sub">${fallo ? 'No se pudieron consultar algunos meses. Revisa tu conexión e inténtalo de nuevo.' : 'No encontramos compras con esa búsqueda.'}</p>`;
    return;
  }

  res.innerHTML = `<ul class="mis-tickets-lista">${items.map(it => {
    if (it.tipo === 'ticket') {
      const t = it.t;
      const piezas = (t.piezas || []).map(p => `${escapeHTML(p.nombre)}${p.cantidad > 1 ? ` ×${p.cantidad}` : ''}`).join(', ');
      return `<li><button type="button" class="mis-ticket" data-folio="${escapeHTML(t.folio)}">
        <span><strong>${_fechaMisTickets(t.fechaLocal)} · Ticket ${escapeHTML(t.folio)}</strong><small>${piezas || 'Sin piezas'}${t.cambioFisico ? ' · con cambio físico' : ''}</small></span>
        <strong>${_dineroMisTickets(t.total)}</strong></button></li>`;
    }
    const r = it.r;
    return `<li><div class="mis-ticket">
      <span><strong>${_fechaMisTickets(it.fecha)} · Apartado liquidado</strong><small>${escapeHTML(r.producto || 'Pieza')}</small></span>
      <strong>${_dineroMisTickets(r.monto)}</strong></div></li>`;
  }).join('')}</ul>`;

  res.querySelectorAll('[data-folio]').forEach(b => b.addEventListener('click', () => abrirTicketMisCompras(b.getAttribute('data-folio'))));
}

async function abrirTicketMisCompras(folio) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;
  box.innerHTML = '<p class="cfg-card-sub">Abriendo ticket…</p>';
  overlay.classList.add('open');
  const cerrar = () => overlay.classList.remove('open');
  let v = null;
  try {
    const doc = await dbFirestore.collection('brilloVentas').doc(folio).get();
    v = doc.exists ? doc.data() : null;
  } catch (error) { v = null; }
  if (!v) {
    box.innerHTML = '<button class="modal-close" data-close>&times;</button><p class="cfg-card-sub">No se pudo abrir este ticket. Inténtalo de nuevo.</p>';
    box.querySelector('[data-close]').addEventListener('click', cerrar);
    return;
  }
  const lineas = v.lineas || [];
  const fotos = await Promise.all(lineas.map(l => _miniaturaMisTickets(l.productoId)));
  const metodo = { efectivo: 'Efectivo', tarjeta: 'Terminal', transferencia: 'Transferencia', gala: 'Gala', regalo: 'Regalo', souvenir: 'Souvenir', cambio_fisico: 'Cambio físico', saldo_favor: 'Saldo a favor' };
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Ticket ${escapeHTML(v.folio)}</h3>
    <p class="modal-sub">${_fechaMisTickets(v.fechaLocal)} · atendió ${escapeHTML((v.cobradoPor && v.cobradoPor.nombre) || '')}</p>
    <ul class="mis-ticket-piezas">
      ${lineas.map((l, i) => `
        <li>
          ${fotos[i] ? `<img src="${escapeHTML(fotos[i])}" alt="">` : '<span class="sin-foto"></span>'}
          <span><strong>${l.garantia ? 'Garantía · ' : ''}${escapeHTML(l.nombre)}</strong><small>${escapeHTML([l.codigo, l.variante].filter(Boolean).join(' · '))}${l.cantidad > 1 ? ` · ${l.cantidad} pzas` : ''}</small></span>
          <strong>${_dineroMisTickets(l.importe)}</strong>
        </li>`).join('')}
    </ul>
    ${v.cambioFisico ? `<p class="cfg-card-sub">Dejaste como cambio físico ${v.cambioFisico.piezas.length} pieza(s): ${_dineroMisTickets(v.cambioFisico.valor)} a tu favor.</p>` : ''}
    <div class="mis-ticket-total"><span>Total</span><strong>${_dineroMisTickets(v.totales && v.totales.total)}</strong></div>
    <div class="mis-ticket-pagos">${(v.pagos || []).map(p => `<span>${metodo[p.metodo] || p.metodo}: ${_dineroMisTickets(p.monto)}</span>`).join('')}</div>
    ${v.saldoAFavor ? `<p class="cfg-card-sub">Tu saldo a favor después de esta compra: <strong>${_dineroMisTickets(v.saldoAFavor.saldoFinal)}</strong></p>` : ''}
  `;
  box.querySelector('[data-close]').addEventListener('click', cerrar);
}

document.addEventListener('DOMContentLoaded', () => {
  renderBuscadorMisTickets();
});
