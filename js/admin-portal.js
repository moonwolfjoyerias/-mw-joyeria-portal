// MW JOYERÍA — Admin: Dashboard (resumen de todo el portal)
//
// No inventa datos nuevos ni un modelo paralelo: cada número sale de
// la MISMA fuente que ya usa su propia página (Apartados, Personas/
// Plan MW, Comisiones, Solicitudes, Lista de deseos, Catálogo,
// Configuración, Calendario, Actividad) — este archivo solo resume y
// enlaza. Si alguna de esas páginas cambia sus datos, el Dashboard lo
// refleja automáticamente sin que nadie tenga que actualizar dos veces.

document.addEventListener('DOMContentLoaded', () => {

  renderResumenGeneral();
  renderProximoPagoDash();
  renderEventosSemanaDash();
  renderActividadRecienteDash();

});

function setTextDash(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}

// ============================================================
// TARJETAS DE RESUMEN
// ============================================================

function renderResumenGeneral() {

  // Catálogo — misma clave de localStorage que usan Staff/RH/Admin.
  let catalogo = [];
  try {
    catalogo = JSON.parse(localStorage.getItem('mw_staff_catalogo_demo')) || [];
  } catch (error) {
    catalogo = [];
  }
  if (!catalogo.length && typeof CATALOGO_EJEMPLO !== 'undefined') catalogo = CATALOGO_EJEMPLO;
  setTextDash('dashCatalogoDisponibles', catalogo.filter(p => p.disponible).length);

  // Apartados — misma fuente que el resumen de Staff/RH.
  const ventanas = typeof calcularVentanasStaffActuales === 'function' ? calcularVentanasStaffActuales() : [];
  setTextDash('dashApartadosVencidos', ventanas.filter(v => v.estado === 'activa' && ventanaEstaVencida(v)).length);

  // Emprendedoras/Líderes + Plan MW (misma fuente: personas-ejemplo.js).
  const personas = typeof obtenerPersonas === 'function' ? obtenerPersonas() : [];
  setTextDash('dashPersonasActivas', personas.filter(p => p.estado === 'activa').length);
  setTextDash('dashPlanMwPendientes', personas.filter(p => p.ascensoPendiente || p.recompensaPendiente).length);

  // Comisiones — total sin pagar del periodo actual (misma fuente que Admin → Comisiones).
  let totalPendiente = 0;
  let lideresPendientes = 0;
  if (typeof calcularTodasLasComisiones === 'function' && typeof obtenerPeriodoActualKey === 'function') {
    const periodoKey = obtenerPeriodoActualKey();
    const subPeriodo = obtenerSubPeriodoActual();
    calcularTodasLasComisiones(periodoKey, subPeriodo).forEach(r => {
      if (r.estadoPago.estado !== 'pagada') {
        lideresPendientes++;
        totalPendiente += r.totalComision + (r.bono ? r.bono.monto : 0);
      }
    });
  }
  setTextDash('dashComisionesPendientes', `$${Math.round(totalPendiente).toLocaleString('es-MX')}`);
  setTextDash('dashComisionesLideresPendientes', lideresPendientes ? `${lideresPendientes} líder${lideresPendientes === 1 ? '' : 'es'} sin pagar` : 'Todo pagado');

  // Solicitudes de inscripción.
  const solicitudes = typeof obtenerSolicitudes === 'function' ? obtenerSolicitudes() : [];
  setTextDash('dashSolicitudesPendientes', solicitudes.filter(s => s.estado === 'pendiente').length);

  // Lista de deseos — misma fuente que Staff/RH/Admin.
  const deseos = typeof obtenerListaDeseos === 'function' ? obtenerListaDeseos() : [];
  setTextDash('dashDeseosActivos', deseos.filter(d => d.estado === 'pendiente' || d.estado === 'en_seguimiento').length);

  // Configuración — cuántos cambios hay en el historial.
  const historialConfig = typeof obtenerHistorialCambiosConfig === 'function' ? obtenerHistorialCambiosConfig() : [];
  setTextDash('dashConfigCambios', historialConfig.length);

}

// ============================================================
// PRÓXIMO PERIODO DE PAGO (mismo cálculo que usa RH → Inicio)
// ============================================================

function renderProximoPagoDash() {

  const { fechaTexto, diasRestantes } = obtenerProximoPeriodoPagoDash();

  setTextDash('dashProximoPago', fechaTexto);
  setTextDash('dashDiasProximoPago', diasRestantes === 0 ? 'Es hoy' : `En ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`);

}

function obtenerProximoPeriodoPagoDash() {

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
// EVENTOS DE ESTA SEMANA (mismo calendario compartido que Staff/RH)
// ============================================================

function renderEventosSemanaDash() {

  const wrap = document.getElementById('weekEventsRow');
  if (!wrap) return;

  const eventos = typeof cargarEventosCompartidos === 'function'
    ? cargarEventosCompartidos()
    : (typeof EVENTOS_EJEMPLO === 'undefined' ? [] : EVENTOS_EJEMPLO);

  const { inicioSemana, finSemana } = obtenerRangoSemanaActualDash();

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
          <h4>${escapeHTMLDash(ev.titulo)}</h4>
          <div class="event-meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
            ${escapeHTMLDash(ev.hora || '')}
          </div>
          <div class="event-meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s7-7.58 7-12a7 7 0 10-14 0c0 4.42 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
            ${escapeHTMLDash(ev.lugarTexto || '')}
          </div>
          <a class="event-link" href="admin-calendario.html">Ver calendario →</a>
        </div>
      </div>
    `;

  }).join('');

}

function obtenerRangoSemanaActualDash() {

  const hoy = new Date();
  const diaSemana = hoy.getDay();
  const offsetLunes = diaSemana === 0 ? -6 : 1 - diaSemana;

  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + offsetLunes);

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  return {
    inicioSemana: formatearFechaISODash(lunes),
    finSemana: formatearFechaISODash(domingo)
  };

}

function formatearFechaISODash(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function escapeHTMLDash(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// ACTIVIDAD RECIENTE (misma bitácora compartida que Actividad)
// ============================================================

function renderActividadRecienteDash() {

  const wrap = document.getElementById('dashActividadReciente');
  if (!wrap) return;

  const registros = (typeof obtenerAuditoriaCompartida === 'function' ? obtenerAuditoriaCompartida() : []).slice(0, 6);

  if (!registros.length) {
    wrap.innerHTML = `<p class="bp-sub" style="margin:0;">Todavía no hay acciones registradas.</p>`;
    return;
  }

  wrap.innerHTML = `
    <div class="ct-detail-list" style="border-bottom:0;">
      ${registros.map(r => {
        const rolLabel = (typeof ROLES_ACTIVIDAD !== 'undefined' && ROLES_ACTIVIDAD[r.rol]) || r.rol || '';
        const moduloLabel = (typeof MODULOS_ACTIVIDAD !== 'undefined' && MODULOS_ACTIVIDAD[r.modulo]) || r.modulo || '';
        const fechaTexto = typeof formatearFechaActividad === 'function' ? formatearFechaActividad(r.fecha) : '';
        return `
          <div class="ct-detail-row">
            <div>
              <strong>${escapeHTMLDash(r.descripcion || '')}</strong>
              <span class="ct-detail-sub">${escapeHTMLDash(rolLabel)} · ${escapeHTMLDash(moduloLabel)} · ${escapeHTMLDash(fechaTexto)}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

}
