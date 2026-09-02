// MW JOYERÍA — Calendario Admin
//
// Mismo calendario que Staff/RH: mismos eventos, misma estructura,
// misma tabla (ver, buscar, filtrar, agregar, editar, eliminar),
// usando el mismo modelo compartido (js/eventos-modelo.js — clave de
// localStorage mw-eventos-v1, el mismo calendario para todos los
// roles).
//
// Igual que RH: las acciones sensibles NO piden usuario/contraseña de
// nuevo — muestran el modal de Autorización (ver js/admin-comun.js) y
// quedan en la auditoría (rol "admin").

let eventosCalendario = [];

document.addEventListener('DOMContentLoaded', () => {

  eventosCalendario = cargarEventosCompartidos();

  renderResumenCalendario();
  renderTablaCalendario();
  inicializarEventosCalendario();

});


// ============================================================
// GUARDAR
// ============================================================

function persistirEventosCalendario() {
  guardarEventosCompartidos(eventosCalendario);
}


// ============================================================
// EVENTOS DE INTERFAZ
// ============================================================

function inicializarEventosCalendario() {

  document.getElementById('agregarEventoBtn')?.addEventListener('click', () => abrirModalEventoCalendario());
  document.getElementById('searchInput')?.addEventListener('input', renderTablaCalendario);
  document.getElementById('filterTipo')?.addEventListener('change', renderTablaCalendario);

  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') cerrarModalCalendario();
  });

}


// ============================================================
// RESUMEN
// ============================================================

function renderResumenCalendario() {

  const hoyStr = new Date().toISOString().slice(0, 10);

  const total = eventosCalendario.length;
  const proximos = eventosCalendario.filter(ev => ev.fecha >= hoyStr).length;
  const presenciales = eventosCalendario.filter(ev => ev.tipo === 'presencial').length;
  const virtuales = eventosCalendario.filter(ev => ev.tipo === 'virtual').length;

  const valores = {
    totalEventos: total,
    proximosEventos: proximos,
    eventosPresenciales: presenciales,
    eventosVirtuales: virtuales
  };

  Object.entries(valores).forEach(([id, valor]) => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = valor;
  });

}


// ============================================================
// TABLA
// ============================================================

function renderTablaCalendario() {

  const tbody = document.getElementById('calendarioTableBody');
  if (!tbody) return;

  renderResumenCalendario();

  const search = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
  const tipo = document.getElementById('filterTipo')?.value || '';

  const eventos = eventosCalendario
    .filter(ev => {

      if (
        search &&
        !ev.titulo.toLowerCase().includes(search) &&
        !(ev.lugarTexto || '').toLowerCase().includes(search) &&
        !(ev.descripcion || '').toLowerCase().includes(search)
      ) return false;

      if (tipo && ev.tipo !== tipo) return false;

      return true;

    })
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const count = document.getElementById('resultCount');
  if (count) count.textContent = `${eventos.length} evento${eventos.length === 1 ? '' : 's'}`;

  if (!eventos.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="catalog-empty-cell">
          <strong>No encontramos eventos</strong>
          <span>Prueba con otro filtro o agrega una nueva actividad.</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = eventos.map(renderFilaEvento).join('');

  tbody.querySelectorAll('[data-editar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEventoCalendario(eventosCalendario.find(ev => ev.id === btn.dataset.editar)));
  });

  tbody.querySelectorAll('[data-eliminar]').forEach(btn => {
    btn.addEventListener('click', () => confirmarEliminarEvento(btn.dataset.eliminar));
  });

}


function renderFilaEvento(ev) {

  const tipoLabel = TIPOS_EVENTO_CALENDARIO.find(t => t.key === ev.tipo)?.label || ev.tipo;
  const { dia, mes, diaSemana } = formatearFechaCorta(ev.fecha);

  return `
    <tr>
      <td>
        <div class="catalog-product-cell">
          <img src="../../assets/images/isotipo-morado.png" alt="">
          <strong>${escapeHTML(ev.titulo)}</strong>
        </div>
      </td>

      <td><span class="catalog-description">${escapeHTML(ev.descripcion || 'Sin descripción')}</span></td>

      <td><span class="calendar-type-badge ${ev.tipo}">${escapeHTML(tipoLabel)}</span></td>

      <td>
        <strong>${diaSemana} ${dia} ${mes}</strong>
        <span class="catalog-description">${escapeHTML(ev.hora || '')}</span>
      </td>

      <td>
        <div>${escapeHTML(ev.lugarTexto || 'Por confirmar')}</div>
        ${ev.enlace ? `<a class="calendar-link" href="${escapeAttribute(ev.enlace)}" target="_blank" rel="noopener">Ver enlace ↗</a>` : ''}
      </td>

      <td>
        <div class="catalog-actions">
          <button class="action-btn primary-action" data-editar="${ev.id}"><span>✎</span> Editar</button>
          <button class="action-btn danger-action" data-eliminar="${ev.id}"><span>×</span> Eliminar</button>
        </div>
      </td>

      <td>
        <strong>${escapeHTML(ev.ultimaAccion?.tipo || 'Sin registro')}</strong>
        <span class="catalog-description">${escapeHTML(ev.ultimaAccion?.empleado || '')}${ev.ultimaAccion?.fecha ? ` · ${formatearFechaHoraLarga(ev.ultimaAccion.fecha)}` : ''}</span>
      </td>
    </tr>
  `;

}


// ============================================================
// MODAL DE EVENTO (agregar / editar) — abrir NO requiere
// autorización, solo el guardado final la pide (sección 17)
// ============================================================

function abrirModalEventoCalendario(evento = null) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const editando = !!evento;

  box.innerHTML = `

    <button class="modal-close" data-close>×</button>

    <div class="auth-icon">${editando ? '✎' : '+'}</div>

    <h3>${editando ? 'Editar evento' : 'Agregar evento'}</h3>

    <p class="modal-sub">
      ${editando
        ? 'Modifica la información de esta actividad del calendario MW.'
        : 'Agrega una nueva actividad al calendario de MW Joyería.'
      }
    </p>

    <div class="form-grid">

      <div class="form-field full">
        <label>Título del evento *</label>
        <input id="eventoTitulo" type="text" placeholder="Ej. Desayuno + Rifa" value="${escapeAttribute(evento?.titulo || '')}">
      </div>

      <div class="form-field full">
        <label>Descripción *</label>
        <textarea id="eventoDescripcion" rows="3" placeholder="Describe la actividad...">${escapeHTML(evento?.descripcion || '')}</textarea>
      </div>

      <div class="form-field">
        <label>Tipo *</label>
        <select id="eventoTipo">
          ${TIPOS_EVENTO_CALENDARIO.map(t => `
            <option value="${t.key}" ${evento?.tipo === t.key ? 'selected' : ''}>${t.label}</option>
          `).join('')}
        </select>
      </div>

      <div class="form-field">
        <label>Fecha *</label>
        <input id="eventoFecha" type="date" value="${escapeAttribute(evento?.fecha || '')}">
      </div>

      <div class="form-field">
        <label>Hora *</label>
        <input id="eventoHora" type="text" placeholder="Ej. 9:30 a.m." value="${escapeAttribute(evento?.hora || '')}">
      </div>

      <div class="form-field">
        <label>Foto destacada</label>
        <select id="eventoFoto">
          <option value="no" ${!evento?.tieneFoto ? 'selected' : ''}>Sin foto</option>
          <option value="si" ${evento?.tieneFoto ? 'selected' : ''}>Con foto</option>
        </select>
      </div>

      <div class="form-field full">
        <label>Lugar *</label>
        <input id="eventoLugar" type="text" placeholder="Ej. Centro Joyero San Luis, Local 21 / En línea (Zoom)" value="${escapeAttribute(evento?.lugarTexto || '')}">
      </div>

      <div class="form-field full">
        <label>Enlace (ubicación o videollamada)</label>
        <input id="eventoEnlace" type="text" placeholder="https://..." value="${escapeAttribute(evento?.enlace || '')}">
      </div>

    </div>

    <div class="modal-note">
      <strong>Importante:</strong> al guardar este evento se te pedirá confirmar la acción.
    </div>

    <button class="btn btn-primary" id="guardarEventoBtn" style="width:100%;">
      ${editando ? 'Guardar cambios' : 'Agregar al calendario'}
    </button>

  `;

  overlay.classList.add('open');

  document.getElementById('guardarEventoBtn')?.addEventListener('click', () => {

    const datos = obtenerDatosEventoCalendario();
    if (!datos) return;

    const mensaje = editando
      ? `Estás a punto de guardar los cambios del evento "${datos.titulo}".`
      : `Estás a punto de agregar el evento "${datos.titulo}" al calendario.`;

    abrirAutorizacionAdmin({
      titulo: editando ? 'Autorizar cambios' : 'Autorizar nuevo evento',
      mensaje,
      onConfirmar: () => editando ? guardarEdicionEvento(evento.id, datos) : agregarEvento(datos)
    });

  });

  box.querySelector('[data-close]')?.addEventListener('click', cerrarModalCalendario);

}


function obtenerDatosEventoCalendario() {

  const titulo = document.getElementById('eventoTitulo')?.value.trim();
  const descripcion = document.getElementById('eventoDescripcion')?.value.trim();
  const tipo = document.getElementById('eventoTipo')?.value;
  const fecha = document.getElementById('eventoFecha')?.value;
  const hora = document.getElementById('eventoHora')?.value.trim();
  const lugarTexto = document.getElementById('eventoLugar')?.value.trim();
  const enlace = document.getElementById('eventoEnlace')?.value.trim();
  const tieneFoto = document.getElementById('eventoFoto')?.value === 'si';

  if (!titulo) { mostrarToast('Escribe el título del evento.'); return null; }
  if (!descripcion) { mostrarToast('Agrega una descripción.'); return null; }
  if (!fecha) { mostrarToast('Selecciona la fecha del evento.'); return null; }
  if (!hora) { mostrarToast('Escribe la hora del evento.'); return null; }
  if (!lugarTexto) { mostrarToast('Escribe el lugar del evento.'); return null; }

  return { titulo, descripcion, tipo, fecha, hora, lugarTexto, enlace, tieneFoto };

}


// ============================================================
// ACCIONES (ejecutadas tras confirmar en el modal de Autorización)
// ============================================================

function agregarEvento(datos) {

  const nuevoEvento = {
    id: 'ev-' + Date.now(),
    ...datos,
    ultimaAccion: { tipo: 'Agregado', empleado: ADMIN_IDENTIDAD.usuarioNombre, fecha: new Date().toISOString() }
  };

  eventosCalendario.unshift(nuevoEvento);
  persistirEventosCalendario();
  cerrarModalCalendario();
  renderTablaCalendario();

  registrarAuditoriaAdmin({ modulo: 'calendario', accion: 'agregar_evento', descripcion: `Evento agregado: ${datos.titulo}` });
  mostrarToast(`Evento agregado por ${ADMIN_IDENTIDAD.usuarioNombre}.`);

}

function guardarEdicionEvento(id, datos) {

  const evento = eventosCalendario.find(ev => ev.id === id);
  if (!evento) return;

  Object.assign(evento, datos);
  evento.ultimaAccion = { tipo: 'Editado', empleado: ADMIN_IDENTIDAD.usuarioNombre, fecha: new Date().toISOString() };

  persistirEventosCalendario();
  cerrarModalCalendario();
  renderTablaCalendario();

  registrarAuditoriaAdmin({ modulo: 'calendario', accion: 'editar_evento', descripcion: `Evento editado: ${datos.titulo}` });
  mostrarToast(`Cambios guardados por ${ADMIN_IDENTIDAD.usuarioNombre}.`);

}

function confirmarEliminarEvento(id) {

  const evento = eventosCalendario.find(ev => ev.id === id);
  if (!evento) return;

  abrirAutorizacionAdmin({
    titulo: 'Autorizar eliminación',
    mensaje: `Estás a punto de eliminar el evento "${evento.titulo}" del calendario. Esta acción no se puede deshacer.`,
    peligrosa: true,
    onConfirmar: () => eliminarEvento(id)
  });

}

function eliminarEvento(id) {

  const evento = eventosCalendario.find(ev => ev.id === id);
  if (!evento) return;

  eventosCalendario = eventosCalendario.filter(ev => ev.id !== id);
  persistirEventosCalendario();
  cerrarModalCalendario();
  renderTablaCalendario();

  registrarAuditoriaAdmin({ modulo: 'calendario', accion: 'eliminar_evento', descripcion: `Evento eliminado: ${evento.titulo}` });
  mostrarToast(`"${evento.titulo}" fue eliminado por ${ADMIN_IDENTIDAD.usuarioNombre}.`);

}


// ============================================================
// UTILIDADES
// ============================================================

function cerrarModalCalendario() {
  document.getElementById('modalOverlay')?.classList.remove('open');
}

function formatearFechaHoraLarga(fechaISO) {
  return new Date(fechaISO).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

function escapeHTML(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(texto) {
  return escapeHTML(texto);
}
