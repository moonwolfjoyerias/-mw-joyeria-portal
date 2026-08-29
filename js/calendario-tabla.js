// MW JOYERÍA — Calendario (Staff)
//
// Permite:
// - Ver los eventos del calendario en una tabla de detalle
// - Agregar eventos
// - Editar eventos
// - Eliminar eventos
// - Registrar qué empleado hizo cada modificación
//
// Toda acción (agregar, editar, eliminar) exige usuario y contraseña
// del empleado, igual que en Catálogo y Apartados.
//
// ⚠️ TEMPORAL:
// localStorage (vía eventos-modelo.js) simula la base de datos
// compartida entre todos los roles. En Fase 3 será reemplazado por
// Firestore.

let eventosCalendario = [];
let accionCalendarioPendiente = null;

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

  const addBtn = document.getElementById('agregarEventoBtn');

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      abrirModalEventoCalendario();
    });
  }


  const search = document.getElementById('searchInput');

  if (search) {
    search.addEventListener('input', renderTablaCalendario);
  }


  const tipo = document.getElementById('filterTipo');

  if (tipo) {
    tipo.addEventListener('change', renderTablaCalendario);
  }


  const overlay = document.getElementById('modalOverlay');

  if (overlay) {

    overlay.addEventListener('click', (e) => {

      if (e.target === overlay) {
        cerrarModalCalendario();
      }

    });

  }

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

  const search =
    document.getElementById('searchInput')?.value
      .toLowerCase()
      .trim() || '';

  const tipo =
    document.getElementById('filterTipo')?.value || '';

  const eventos = eventosCalendario
    .filter(ev => {

      if (
        search &&
        !ev.titulo.toLowerCase().includes(search) &&
        !(ev.lugarTexto || '').toLowerCase().includes(search) &&
        !(ev.descripcion || '').toLowerCase().includes(search)
      ) {
        return false;
      }

      if (tipo && ev.tipo !== tipo) {
        return false;
      }

      return true;

    })
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha));


  const count = document.getElementById('resultCount');

  if (count) {
    count.textContent =
      `${eventos.length} evento${eventos.length === 1 ? '' : 's'}`;
  }


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

    btn.addEventListener('click', () => {
      solicitarAutorizacionCalendario('editar', btn.dataset.editar);
    });

  });


  tbody.querySelectorAll('[data-eliminar]').forEach(btn => {

    btn.addEventListener('click', () => {
      solicitarAutorizacionCalendario('eliminar', btn.dataset.eliminar);
    });

  });

}


function renderFilaEvento(ev) {

  const tipoLabel =
    TIPOS_EVENTO_CALENDARIO.find(t => t.key === ev.tipo)?.label || ev.tipo;

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
// MODAL DE EVENTO (agregar / editar)
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
      <strong>Importante:</strong>
      al guardar este evento se solicitará la autenticación del
      empleado que realizó el cambio.
    </div>

    <button class="btn btn-primary" id="guardarEventoBtn" style="width:100%;">
      ${editando ? 'Guardar cambios' : 'Agregar al calendario'}
    </button>

  `;

  overlay.classList.add('open');

  document
    .getElementById('guardarEventoBtn')
    ?.addEventListener('click', () => {

      const datos = obtenerDatosEventoCalendario();

      if (!datos) return;

      cerrarModalCalendario();

      solicitarAutorizacionCalendario(
        editando ? 'guardar-edicion' : 'agregar',
        evento?.id || null,
        datos
      );

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

  if (!titulo) {
    mostrarToast('Escribe el título del evento.');
    return null;
  }

  if (!descripcion) {
    mostrarToast('Agrega una descripción.');
    return null;
  }

  if (!fecha) {
    mostrarToast('Selecciona la fecha del evento.');
    return null;
  }

  if (!hora) {
    mostrarToast('Escribe la hora del evento.');
    return null;
  }

  if (!lugarTexto) {
    mostrarToast('Escribe el lugar del evento.');
    return null;
  }

  return {
    titulo,
    descripcion,
    tipo,
    fecha,
    hora,
    lugarTexto,
    enlace,
    tieneFoto
  };

}


// ============================================================
// AUTENTICACIÓN PARA ACCIONES
// ============================================================

function solicitarAutorizacionCalendario(tipo, id, datos = null) {

  accionCalendarioPendiente = { tipo, id, datos };

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  if (!overlay || !box) return;

  let titulo = 'Autorizar acción';
  let descripcion = 'Ingresa tus credenciales para registrar quién realizó este cambio.';
  let boton = 'Autorizar y continuar';

  const eventoSeleccionado = id ? eventosCalendario.find(ev => ev.id === id) : null;
  const detalleAccion = eventoSeleccionado ? eventoSeleccionado.titulo : (datos?.titulo || 'Evento nuevo');

  if (tipo === 'agregar') {
    titulo = 'Autorizar nuevo evento';
    descripcion = 'Confirma tus credenciales para agregar este evento al calendario.';
  }

  if (tipo === 'guardar-edicion') {
    titulo = 'Autorizar cambios';
    descripcion = 'Confirma tus credenciales para guardar las modificaciones del evento.';
  }

  if (tipo === 'editar') {
    titulo = 'Autorizar edición';
    descripcion = 'Por seguridad, necesitamos identificar al empleado que realizará esta modificación.';
  }

  if (tipo === 'eliminar') {
    titulo = 'Autorizar eliminación';
    descripcion = 'Esta acción eliminará el evento del calendario. Ingresa tus credenciales para continuar.';
    boton = 'Autorizar eliminación';
  }

  box.innerHTML = `

    <button class="modal-close" data-close>×</button>

    <div class="auth-icon ${tipo === 'eliminar' ? 'danger' : ''}">${tipo === 'eliminar' ? '!' : '✓'}</div>

    <h3>${titulo}</h3>

    <p class="modal-sub">${descripcion}</p>

    <div class="modal-context">
      <span>Acción</span>
      <strong>${titulo}</strong>

      <span>Evento</span>
      <strong>${escapeHTML(detalleAccion)}</strong>

      <span>Tipo</span>
      <strong>${tipo === 'eliminar' ? 'Eliminación' : tipo === 'agregar' ? 'Alta de evento' : 'Edición'}</strong>
    </div>

    <div class="auth-warning">
      <span>🔐</span>
      <div>
        <strong>Acción registrada</strong>
        <small>El sistema guardará el usuario, fecha y hora de esta modificación.</small>
      </div>
    </div>

    <label for="calendarioUsuario">Usuario de empleado</label>
    <input id="calendarioUsuario" type="text" autocomplete="username" placeholder="Ej. staff01">

    <label for="calendarioPassword">Contraseña</label>
    <div class="password-wrap">
      <input id="calendarioPassword" type="password" autocomplete="current-password" placeholder="Contraseña">
      <button type="button" id="mostrarPasswordCalendario">Ver</button>
    </div>

    <div id="authError" style="display:none;" class="auth-error"></div>

    <button class="btn ${tipo === 'eliminar' ? 'btn-danger' : 'btn-primary'}" id="autorizarCalendarioBtn" style="width:100%;">
      ${boton}
    </button>

    <p class="demo-note">
      Demo: usuario <strong>staff01</strong> · contraseña <strong>1234</strong>
    </p>

  `;

  overlay.classList.add('open');

  document
    .getElementById('mostrarPasswordCalendario')
    ?.addEventListener('click', () => {

      const input = document.getElementById('calendarioPassword');
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';

    });

  document
    .getElementById('autorizarCalendarioBtn')
    ?.addEventListener('click', validarAutorizacionCalendario);

  box.querySelector('[data-close]')?.addEventListener('click', () => {
    accionCalendarioPendiente = null;
    cerrarModalCalendario();
  });

}


function validarAutorizacionCalendario() {

  const usuario = document.getElementById('calendarioUsuario')?.value.trim();
  const password = document.getElementById('calendarioPassword')?.value;
  const error = document.getElementById('authError');

  const empleado = CALENDARIO_USUARIOS_EJEMPLO.find(
    u => u.usuario === usuario && u.password === password
  );

  if (!empleado) {

    if (error) {
      error.style.display = 'block';
      error.textContent = 'Usuario o contraseña incorrectos.';
    }

    return;

  }

  const accion = accionCalendarioPendiente;

  ejecutarAccionCalendario(accion, empleado);

  accionCalendarioPendiente = null;

}


// ============================================================
// EJECUTAR ACCIÓN
// ============================================================

function ejecutarAccionCalendario(accion, empleado) {

  if (!accion) return;

  const ahora = new Date().toISOString();


  // AGREGAR
  if (accion.tipo === 'agregar') {

    const nuevoEvento = {
      id: 'ev-' + Date.now(),
      ...accion.datos,
      ultimaAccion: { tipo: 'Agregado', empleado: empleado.nombre, fecha: ahora }
    };

    eventosCalendario.unshift(nuevoEvento);

    persistirEventosCalendario();
    cerrarModalCalendario();
    renderTablaCalendario();

    mostrarToast(`Evento agregado por ${empleado.nombre}.`);

    return;

  }


  // GUARDAR EDICIÓN
  if (accion.tipo === 'guardar-edicion') {

    const evento = eventosCalendario.find(ev => ev.id === accion.id);

    if (!evento) return;

    Object.assign(evento, accion.datos);

    evento.ultimaAccion = { tipo: 'Editado', empleado: empleado.nombre, fecha: ahora };

    persistirEventosCalendario();
    cerrarModalCalendario();
    renderTablaCalendario();

    mostrarToast(`Cambios guardados por ${empleado.nombre}.`);

    return;

  }


  // EDITAR (abre el formulario ya autorizado)
  if (accion.tipo === 'editar') {

    const evento = eventosCalendario.find(ev => ev.id === accion.id);

    if (!evento) return;

    cerrarModalCalendario();
    abrirModalEventoCalendario(evento);

    return;

  }


  // ELIMINAR
  if (accion.tipo === 'eliminar') {

    const evento = eventosCalendario.find(ev => ev.id === accion.id);

    if (!evento) return;

    eventosCalendario = eventosCalendario.filter(ev => ev.id !== accion.id);

    persistirEventosCalendario();
    cerrarModalCalendario();
    renderTablaCalendario();

    mostrarToast(`"${evento.titulo}" fue eliminado por ${empleado.nombre}.`);

  }

}


// ============================================================
// UTILIDADES
// ============================================================

function cerrarModalCalendario() {

  const overlay = document.getElementById('modalOverlay');

  if (overlay) {
    overlay.classList.remove('open');
  }

}


function formatearFechaHoraLarga(fechaISO) {

  return new Date(fechaISO).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
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
