// MW JOYERÍA — Calendario (solo lectura: Emprendedora / Líder)
// Depende de EVENTOS_EJEMPLO (eventos-ejemplo.js) y de formatearFechaCorta
// (definida en portal-common.js). Si eventos-modelo.js está cargado, lee
// el calendario compartido (editado por Staff/Encargado/Admin) en vez de la
// semilla de ejemplo.

const DIAS_SEMANA_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_SEMANA_INICIAL = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const hoy = new Date();
const mesActualIdx = hoy.getFullYear() * 12 + hoy.getMonth(); // índice absoluto de mes, para acotar navegación
let mesMostradoIdx = mesActualIdx;

let EVENTOS_ACTUALES = [];

document.addEventListener('DOMContentLoaded', () => {
  EVENTOS_ACTUALES = typeof cargarEventosCompartidos === 'function'
    ? cargarEventosCompartidos()
    : (typeof EVENTOS_EJEMPLO === 'undefined' ? [] : EVENTOS_EJEMPLO);

  renderCalendario();
  renderProximosEventos();
  renderInvitacionesComunidad();
  renderMisSolicitudesEvento();

  document.getElementById('solicitarEventoBtn')?.addEventListener('click', () => abrirModalNuevaSolicitudEvento());

  // Enlace directo desde una notificación (?evento=ID) — abre ese
  // evento de una vez, en vez de dejar a la persona a buscarlo.
  const eventoDesdeUrl = new URLSearchParams(window.location.search).get('evento');
  if (eventoDesdeUrl) abrirModalEvento(eventoDesdeUrl);

  document.getElementById('mesAnteriorBtn').addEventListener('click', () => {
    mesMostradoIdx -= 1;
    renderCalendario();
  });
  document.getElementById('mesSiguienteBtn').addEventListener('click', () => {
    mesMostradoIdx += 1;
    renderCalendario();
  });
  document.getElementById('hoyBtn').addEventListener('click', () => {
    mesMostradoIdx = mesActualIdx;
    renderCalendario();
  });
});

function idxToYearMonth(idx) {
  return { year: Math.floor(idx / 12), month: idx % 12 };
}

function renderCalendario() {
  const { year, month } = idxToYearMonth(mesMostradoIdx);
  document.getElementById('mesTitulo').textContent = `${MESES_LARGO[month]} ${year}`;

  // Acotar navegación a [mesActual - 1, mesActual + 1]
  document.getElementById('mesAnteriorBtn').disabled = mesMostradoIdx <= mesActualIdx - 1;
  document.getElementById('mesSiguienteBtn').disabled = mesMostradoIdx >= mesActualIdx + 1;

  const primerDiaSemana = new Date(year, month, 1).getDay(); // 0=domingo
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const diasMesAnterior = new Date(year, month, 0).getDate();

  const eventosPorFecha = {};
  EVENTOS_ACTUALES.forEach(ev => {
    (eventosPorFecha[ev.fecha] = eventosPorFecha[ev.fecha] || []).push(ev);
  });

  const hoyStr = hoy.toISOString().slice(0, 10);
  const celdas = [];

  // Días del mes anterior (relleno)
  for (let i = primerDiaSemana - 1; i >= 0; i--) {
    celdas.push({ dia: diasMesAnterior - i, otroMes: true });
  }
  // Días del mes actual
  for (let d = 1; d <= diasEnMes; d++) {
    const fechaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    celdas.push({ dia: d, otroMes: false, fechaStr, esHoy: fechaStr === hoyStr, eventos: eventosPorFecha[fechaStr] || [] });
  }
  // Relleno final hasta completar semanas de 7
  while (celdas.length % 7 !== 0) {
    celdas.push({ dia: celdas.length % 7, otroMes: true });
  }

  const MAX_CHIPS_VISIBLES = 2;

  const grid = document.getElementById('calendarGrid');
  const weekdaysHtml = DIAS_SEMANA_LARGO.map((d, i) => `<div class="calendar-weekday"><span class="cw-full">${d}</span><span class="cw-short">${DIAS_SEMANA_INICIAL[i]}</span></div>`).join('');
  const celdasHtml = celdas.map(c => {
    if (c.otroMes || !c.eventos || !c.eventos.length) {
      return `
        <div class="calendar-day ${c.otroMes ? 'other-month' : ''} ${c.esHoy ? 'is-today' : ''}">
          <span class="day-num">${c.dia}</span>
        </div>
      `;
    }
    const visibles = c.eventos.slice(0, MAX_CHIPS_VISIBLES);
    const restantes = c.eventos.length - visibles.length;
    return `
      <div class="calendar-day ${c.esHoy ? 'is-today' : ''}">
        <span class="day-num">${c.dia}</span>
        <div class="day-events-chips">
          ${visibles.map(ev => `<button class="event-chip ${ev.tipo}" data-evento="${ev.id}" title="${ev.titulo} · ${ev.hora}">${horaCortaEvento(ev.hora)} ${ev.titulo}</button>`).join('')}
          ${restantes > 0 ? `<button class="event-chip-more" data-dia="${c.fechaStr}">+${restantes} más</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  grid.innerHTML = weekdaysHtml + celdasHtml;

  grid.querySelectorAll('[data-evento]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEvento(btn.getAttribute('data-evento')));
  });

  grid.querySelectorAll('[data-dia]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEventosDia(btn.getAttribute('data-dia')));
  });
}

// "9:30 a.m." -> "9:30a" — para que quepa en el chip angosto del día.
function horaCortaEvento(hora) {
  if (!hora) return '';
  return hora.replace(/\s*([ap])\.?\s*m\.?/i, (match, letra) => letra.toLowerCase()).replace(/\s+/g, '');
}

// Lista completa de eventos de un día (cuando hay más de los que caben
// como chips) — cada uno abre su propio modal de evento.
function abrirModalEventosDia(fechaStr) {
  const eventosDia = EVENTOS_ACTUALES.filter(ev => ev.fecha === fechaStr).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
  if (!eventosDia.length) return;

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const { dia, mes } = formatearFechaCorta(fechaStr);

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>${dia} de ${mes}</h3>
    <p class="modal-sub">${eventosDia.length} evento${eventosDia.length === 1 ? '' : 's'} este día.</p>
    <div class="equipo-modal-list">
      ${eventosDia.map(ev => `
        <button class="upcoming-card ${ev.tipo}" style="margin-bottom:0.6rem;" data-evento-dia="${ev.id}">
          <div>
            <h4>${ev.titulo}</h4>
            <div class="up-meta">${ev.hora} · ${ev.lugarTexto}</div>
          </div>
        </button>
      `).join('')}
    </div>
  `;
  overlay.classList.add('open');

  box.querySelectorAll('[data-evento-dia]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEvento(btn.getAttribute('data-evento-dia')));
  });
}

function renderProximosEventos() {
  const wrap = document.getElementById('upcomingList');
  if (!wrap) return;
  const hoyStr = hoy.toISOString().slice(0, 10);
  const proximos = EVENTOS_ACTUALES
    .filter(ev => ev.fecha >= hoyStr)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 6);

  if (proximos.length === 0) {
    wrap.innerHTML = '<p class="upcoming-empty">No hay eventos próximos por ahora.</p>';
    return;
  }

  wrap.innerHTML = proximos.map(ev => {
    const { dia, mes, diaSemana } = formatearFechaCorta(ev.fecha);
    return `
      <button class="upcoming-card ${ev.tipo}" data-evento="${ev.id}">
        <div class="up-date">
          <span class="up-dow">${diaSemana}</span>
          <span class="up-daynum">${dia}</span>
          <span class="up-mon">${mes}</span>
        </div>
        <div>
          <h4>${ev.titulo}</h4>
          <div class="up-meta">${ev.hora} · ${ev.lugarTexto}</div>
          <div class="up-desc">${ev.descripcion}</div>
        </div>
      </button>
    `;
  }).join('');

  wrap.querySelectorAll('[data-evento]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEvento(btn.getAttribute('data-evento')));
  });
}

// ============================================================
// INVITACIONES DE TU COMUNIDAD — eventos que otra Emprendedora/Líder
// organizó y a los que invitó a toda la comunidad (origen:
// 'emprendedora_lider', nace de una Solicitud de evento aprobada).
// ============================================================

function renderInvitacionesComunidad() {
  const wrap = document.getElementById('invitacionesList');
  if (!wrap) return;

  const hoyStr = hoy.toISOString().slice(0, 10);
  const invitaciones = EVENTOS_ACTUALES
    .filter(ev => ev.origen === 'emprendedora_lider' && ev.fecha >= hoyStr)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (!invitaciones.length) {
    wrap.innerHTML = '<p class="upcoming-empty">Todavía no hay invitaciones de otras Emprendedoras/Líderes.</p>';
    return;
  }

  wrap.innerHTML = invitaciones.map(ev => {
    const { dia, mes, diaSemana } = formatearFechaCorta(ev.fecha);
    return `
      <button class="upcoming-card ${ev.tipo}" data-evento="${ev.id}">
        <div class="up-date">
          <span class="up-dow">${diaSemana}</span>
          <span class="up-daynum">${dia}</span>
          <span class="up-mon">${mes}</span>
        </div>
        <div>
          <h4>${ev.titulo}</h4>
          <div class="up-meta">${ev.hora} · ${ev.lugarTexto}</div>
          <div class="up-desc">Invita: ${ev.solicitanteNombre || 'una Emprendedora/Líder'}</div>
        </div>
      </button>
    `;
  }).join('');

  wrap.querySelectorAll('[data-evento]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEvento(btn.getAttribute('data-evento')));
  });
}

// ============================================================
// SOLICITUD DE EVENTO — una Emprendedora/Líder pide publicar su propio
// evento en el calendario compartido. Depende de
// js/solicitudes-eventos-modelo.js para la lógica/almacenamiento.
// ============================================================

function renderMisSolicitudesEvento() {
  const wrap = document.getElementById('misSolicitudesEventoWrap');
  if (!wrap || typeof obtenerSolicitudesEventosDe !== 'function') return;

  const personaId = obtenerIdPersonaActualPortal();
  const solicitudes = obtenerSolicitudesEventosDe(personaId);

  if (!solicitudes.length) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = `
    <h4 class="profile-section-title" style="margin-top:0;">Tus solicitudes de evento</h4>
    ${solicitudes.map(s => `
      <div class="solicitud-card">
        <div class="solicitud-card-head">
          <strong>${s.titulo}</strong>
          <span class="badge estado-badge ${s.estado}">${ESTADOS_SOLICITUD_EVENTO[s.estado] || s.estado}</span>
        </div>
        <small>Enviada el ${formatearFechaCortaISO(s.fechaSolicitud)}</small>
        ${s.estado === 'rechazada' && s.motivoRechazo ? `<div class="solicitud-motivo">Motivo: ${s.motivoRechazo}</div>` : ''}
      </div>
    `).join('')}
  `;
}

function formatearFechaCortaISO(fechaISO) {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function abrirModalNuevaSolicitudEvento() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Solicitar evento</h3>
    <p class="modal-sub">Organiza un evento e invita a toda la comunidad MW — Admin lo revisará antes de publicarlo en el calendario.</p>

    <label for="solEvTitulo">Título del evento *</label>
    <input id="solEvTitulo" type="text" placeholder="Ej. Presentación MW en Rioverde">

    <label for="solEvFecha">Fecha *</label>
    <input id="solEvFecha" type="date">

    <label for="solEvHora">Hora *</label>
    <input id="solEvHora" type="text" placeholder="Ej. 6:00 p.m.">

    <label for="solEvTipo">Tipo *</label>
    <select id="solEvTipo">
      <option value="presencial">Presencial</option>
      <option value="virtual">Virtual</option>
    </select>

    <label for="solEvLugar" id="solEvLugarLabel">Lugar *</label>
    <input id="solEvLugar" type="text" placeholder="Ej. Plaza Principal, Rioverde, S.L.P.">

    <label for="solEvDescripcion">Descripción / invitación *</label>
    <textarea id="solEvDescripcion" rows="3" placeholder="Cuéntales a las demás de qué se trata y por qué deberían ir." style="width:100%;border:1px solid #ddd5e3;border-radius:7px;padding:10px 12px;font:inherit;color:#312044;resize:vertical;"></textarea>

    <div id="solEvError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" id="enviarSolicitudEventoBtn" style="width:100%;" type="button">Enviar solicitud</button>
  `;

  overlay.classList.add('open');

  document.getElementById('solEvTipo')?.addEventListener('change', (e) => {
    const esVirtual = e.target.value === 'virtual';
    document.getElementById('solEvLugarLabel').textContent = esVirtual ? 'Enlace / cómo conectarse *' : 'Lugar *';
    document.getElementById('solEvLugar').placeholder = esVirtual ? 'Ej. Enlace de Zoom' : 'Ej. Plaza Principal, Rioverde, S.L.P.';
  });

  document.getElementById('enviarSolicitudEventoBtn')?.addEventListener('click', enviarNuevaSolicitudEvento);
}

function enviarNuevaSolicitudEvento() {
  const boton = document.getElementById('enviarSolicitudEventoBtn');
  if (boton?.disabled) return;

  const titulo = document.getElementById('solEvTitulo')?.value || '';
  const fecha = document.getElementById('solEvFecha')?.value || '';
  const hora = document.getElementById('solEvHora')?.value || '';
  const tipo = document.getElementById('solEvTipo')?.value || 'presencial';
  const lugarTexto = document.getElementById('solEvLugar')?.value || '';
  const descripcion = document.getElementById('solEvDescripcion')?.value || '';

  const resultado = crearSolicitudEvento({
    solicitanteId: obtenerIdPersonaActualPortal(),
    solicitanteNombre: obtenerNombrePersonaActualPortal(),
    titulo, fecha, hora, tipo, lugarTexto,
    enlace: tipo === 'virtual' ? lugarTexto : '',
    descripcion
  });

  if (!resultado.ok) {
    const error = document.getElementById('solEvError');
    if (error) { error.textContent = resultado.error; error.style.display = 'block'; }
    return;
  }

  document.getElementById('modalOverlay')?.classList.remove('open');
  renderMisSolicitudesEvento();
  mostrarToast('Solicitud de evento enviada. Te avisaremos cuando Admin la revise.');
}

// ============================================================
// CONFIRMAR ASISTENCIA — se guarda con la identidad de la sesión
// (nunca texto libre) para que no haya nombres duplicados o falsos;
// Admin puede descargar la lista de asistencia desde el calendario.
// ============================================================

function confirmarAsistenciaEvento(id) {
  const ev = EVENTOS_ACTUALES.find(e => e.id === id);
  if (!ev) return;

  const personaId = obtenerIdPersonaActualPortal();
  if (!Array.isArray(ev.asistentes)) ev.asistentes = [];
  if (ev.asistentes.some(a => a.personaId === personaId)) return;

  ev.asistentes.push({
    personaId,
    nombre: obtenerNombrePersonaActualPortal() || 'Sin nombre',
    fecha: new Date().toISOString()
  });

  if (typeof guardarEventosCompartidos === 'function') guardarEventosCompartidos(EVENTOS_ACTUALES);

  abrirModalEvento(id);
  mostrarToast('Tu asistencia quedó confirmada.');
}

function abrirModalEvento(id) {
  const ev = EVENTOS_ACTUALES.find(e => e.id === id);
  if (!ev) return;
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  const { dia, mes } = formatearFechaCorta(ev.fecha);
  const etiquetaTipo = ev.tipo === 'presencial' ? 'Presencial' : 'Virtual';
  const textoBoton = ev.tipo === 'presencial' ? 'Ver ubicación' : 'Unirme por Zoom';

  const asistentes = Array.isArray(ev.asistentes) ? ev.asistentes : [];
  const yaConfirmo = asistentes.some(a => a.personaId === obtenerIdPersonaActualPortal());

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    ${ev.tieneFoto ? `
      <div class="event-modal-photo"><img src="../../assets/images/isotipo-morado.png" alt=""></div>
    ` : ''}
    <h3>${ev.titulo}</h3>
    <div class="event-modal-meta">
      <span class="badge">${etiquetaTipo}</span>
      <span>${dia} ${mes} · ${ev.hora}</span>
    </div>
    ${ev.origen === 'emprendedora_lider' && ev.solicitanteNombre ? `<p class="modal-sub" style="margin-bottom:0.6rem;">Organiza: <strong>${ev.solicitanteNombre}</strong></p>` : ''}
    <p class="modal-sub" style="margin-bottom:1.2rem;">${ev.descripcion}</p>
    <p class="modal-sub" style="margin-bottom:1rem;"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s7-7.58 7-12a7 7 0 10-14 0c0 4.42 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg></span> ${ev.lugarTexto}</p>
    <a href="${ev.enlace}" target="_blank" rel="noopener" class="btn btn-primary" style="width:100%; display:block; text-align:center; box-sizing:border-box; margin-bottom:0.6rem;">${textoBoton}</a>
    ${yaConfirmo
      ? `<button class="btn btn-outline" style="width:100%;" type="button" disabled>Ya confirmaste tu asistencia <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></span></button>`
      : `<button class="btn btn-outline" style="width:100%;" type="button" id="confirmarAsistenciaBtn">Confirmar asistencia</button>`}
  `;

  document.getElementById('confirmarAsistenciaBtn')?.addEventListener('click', () => confirmarAsistenciaEvento(ev.id));
  overlay.classList.add('open');
}
