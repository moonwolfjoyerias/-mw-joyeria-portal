// MW JOYERÍA — RH: Inicio
//
// Mismo resumen operativo que Staff (misma fuente de datos: Apartados
// y Lista de deseos) y los mismos eventos de la semana del calendario
// compartido. La diferencia propia de RH es el bloque de Nómina y
// recordatorios — informativo por ahora, ya que Nómina todavía no
// está construida (ver PROMPT MAESTRO PORTAL RH, sección 30).

document.addEventListener('DOMContentLoaded', () => {

  actualizarResumenInicioRH();
  renderRecordatoriosNomina();
  renderEventosSemanaRH();

});


// ============================================================
// RESUMEN OPERATIVO (mismos datos que Apartados y Lista de deseos)
// ============================================================

function actualizarResumenInicioRH() {

  const ventanas = typeof calcularVentanasStaffActuales === 'function'
    ? calcularVentanasStaffActuales()
    : [];

  const deseos = typeof cargarDeseosStaffActuales === 'function'
    ? cargarDeseosStaffActuales()
    : [];

  const valores = {
    inicioPendientesApartar: ventanas.filter(v => v.estado === 'pendiente_deposito').length,
    inicioApartadosVencidos: ventanas.filter(v => v.estado === 'activa' && ventanaEstaVencida(v)).length,
    inicioTotalDeseos: deseos.length
  };

  Object.entries(valores).forEach(([id, valor]) => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = valor;
  });

}


// ============================================================
// NÓMINA Y RECORDATORIOS
// ============================================================
// Nómina todavía no está construida (Fase 2), así que este bloque es
// informativo: el único dato real disponible es el calendario de
// periodos de pago (día 5 y día 20 de cada mes), ya usado en el
// portal de líderes para sus comisiones.

function renderRecordatoriosNomina() {

  const { fechaTexto, diasRestantes } = obtenerProximoPeriodoPago();

  setText('proximoPeriodoPago', fechaTexto);
  setText('diasParaPeriodoPago', diasRestantes === 0 ? 'Es hoy' : `En ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`);

}

function obtenerProximoPeriodoPago() {

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const candidatos = [5, 20].flatMap(dia => [
    new Date(hoy.getFullYear(), hoy.getMonth(), dia),
    new Date(hoy.getFullYear(), hoy.getMonth() + 1, dia)
  ]);

  const proximo = candidatos
    .filter(fecha => fecha >= hoy)
    .sort((a, b) => a - b)[0];

  const diasRestantes = Math.round((proximo - hoy) / (1000 * 60 * 60 * 24));

  const fechaTexto = proximo.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });

  return { fechaTexto, diasRestantes };

}


// ============================================================
// EVENTOS DE ESTA SEMANA (mismo calendario compartido que Staff)
// ============================================================

function renderEventosSemanaRH() {

  const wrap = document.getElementById('weekEventsRow');
  if (!wrap) return;

  const eventos = typeof cargarEventosCompartidos === 'function'
    ? cargarEventosCompartidos()
    : (typeof EVENTOS_EJEMPLO === 'undefined' ? [] : EVENTOS_EJEMPLO);

  const { inicioSemana, finSemana } = obtenerRangoSemanaActual();

  const eventosSemana = eventos
    .filter(ev => ev.fecha >= inicioSemana && ev.fecha <= finSemana)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (!eventosSemana.length) {
    wrap.innerHTML = '<p class="upcoming-empty">No hay eventos programados esta semana.</p>';
    return;
  }

  wrap.innerHTML = eventosSemana.map(ev => {

    const { dia, mes, diaSemana } = formatearFechaCorta(ev.fecha);

    return `
      <div class="event-card">
        <div class="event-date-box">
          <span class="mes">${mes}</span>
          <span class="dia">${dia}</span>
          <span class="dia-semana">${diaSemana}</span>
        </div>
        <div class="event-photo"></div>
        <div class="event-body">
          <h4>${escapeHTML(ev.titulo)}</h4>
          <div class="event-meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
            ${escapeHTML(ev.hora || '')}
          </div>
          <div class="event-meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s7-7.58 7-12a7 7 0 10-14 0c0 4.42 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
            ${escapeHTML(ev.lugarTexto || '')}
          </div>
          <a class="event-link" href="../rh/rh-calendario.html">Ver calendario →</a>
        </div>
      </div>
    `;

  }).join('');

}


function obtenerRangoSemanaActual() {

  const hoy = new Date();
  const diaSemana = hoy.getDay();
  const offsetLunes = diaSemana === 0 ? -6 : 1 - diaSemana;

  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + offsetLunes);

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  return {
    inicioSemana: formatearFechaISO(lunes),
    finSemana: formatearFechaISO(domingo)
  };

}

function formatearFechaISO(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}


// ============================================================
// UTILIDADES
// ============================================================

function setText(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}

function escapeHTML(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
