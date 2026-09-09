// MW JOYERÍA — Staff: Mis actividades
//
// A diferencia de Apartados/Lista de deseos (donde "mi" = "del equipo
// de Staff" porque no hay sesión individual), aquí SÍ hace falta saber
// exactamente quién está viendo la página — el prompt pide que cada
// empleado vea ÚNICAMENTE sus propias actividades. Como el portal no
// tiene sesión persistente (ver js/staff-apartados.js), se resuelve
// igual que cualquier acción sensible de Staff: usuario + contraseña,
// solo que aquí se piden UNA vez al entrar a la página (no en cada
// clic) y la identidad se guarda solo en memoria mientras la pestaña
// sigue abierta — nunca en localStorage/sessionStorage.
//
// ⚠️ TEMPORAL: localStorage simula la base de datos compartida.

let identidadStaffActual = null; // { usuarioId, usuarioNombre, empleado }

document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('actIdTogglePassword')?.addEventListener('click', () => {
    const input = document.getElementById('actIdPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('actIdEntrarBtn')?.addEventListener('click', identificarStaffActual);
  document.getElementById('actIdPassword')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') identificarStaffActual();
  });

  document.getElementById('actCambiarUsuarioBtn')?.addEventListener('click', cerrarSesionStaffActual);

  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') cerrarModalMisAct();
  });

  setTimeout(() => document.getElementById('actIdUsuario')?.focus(), 100);

});

function cerrarModalMisAct() {
  document.getElementById('modalOverlay')?.classList.remove('open');
}

function escapeHTMLMisAct(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatearFechaHoraMisAct(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// ============================================================
// IDENTIFICACIÓN (usuario + contraseña — misma fuente que Apartados)
// ============================================================

function identificarStaffActual() {

  const usuario = document.getElementById('actIdUsuario')?.value.trim();
  const password = document.getElementById('actIdPassword')?.value;
  const error = document.getElementById('actIdError');

  const personal = (typeof PERSONAL_EJEMPLO !== 'undefined' ? PERSONAL_EJEMPLO.find(p => p.usuario === usuario && p.password === password) : null)
    || (typeof verificarCredencialInterna === 'function' ? verificarCredencialInterna(usuario, password) : null);

  if (!personal) {
    if (error) { error.style.display = 'block'; error.textContent = 'Usuario o contraseña incorrectos.'; }
    return;
  }

  // Solo Staff puede identificarse aquí — admin01/rh01 también existen
  // en las mismas listas de ejemplo, pero no son personal de Staff.
  if (personal.rol && personal.rol !== 'staff') {
    if (error) { error.style.display = 'block'; error.textContent = 'Esta cuenta no pertenece al personal de Staff.'; }
    return;
  }

  const empleado = empleadoNominaDeCuentaActividadStaff(personal);
  if (!empleado || empleado.cargo !== 'staff' || empleado.estado !== 'activo') {
    if (error) { error.style.display = 'block'; error.textContent = 'No encontramos un empleado de Staff activo con esa cuenta.'; }
    return;
  }

  identidadStaffActual = { usuarioId: empleado.id, usuarioNombre: empleado.nombre };

  document.getElementById('actIdentificarWrap').hidden = true;
  document.getElementById('actMisActividadesWrap').hidden = false;
  document.getElementById('actYoLabel').textContent = `Hola, ${empleado.nombre} — estas son tus actividades.`;

  renderTablaMisActividades();

}

function cerrarSesionStaffActual() {
  identidadStaffActual = null;
  document.getElementById('actIdUsuario').value = '';
  document.getElementById('actIdPassword').value = '';
  document.getElementById('actIdError').style.display = 'none';
  document.getElementById('actMisActividadesWrap').hidden = true;
  document.getElementById('actIdentificarWrap').hidden = false;
  setTimeout(() => document.getElementById('actIdUsuario')?.focus(), 100);
}

// ============================================================
// MIS ACTIVIDADES
// ============================================================

function renderTablaMisActividades() {

  const tbody = document.getElementById('actMisTableBody');
  if (!tbody || !identidadStaffActual) return;

  const lista = obtenerAsignacionesActividadStaff()
    .filter(a => a.encargadoId === identidadStaffActual.usuarioId && a.estado !== 'borrador')
    .sort((a, b) => b.semanaKey.localeCompare(a.semanaKey));

  const count = document.getElementById('actMisResultCount');
  if (count) count.textContent = `${lista.length} actividad${lista.length === 1 ? '' : 'es'}`;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="catalog-empty-cell"><strong>Todavía no tienes actividades anunciadas</strong><span>RH avisará aquí en cuanto te asignen alguna.</span></td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(a => `
    <tr>
      <td><strong>${escapeHTMLMisAct(a.nombre)}</strong></td>
      <td><span class="catalog-description">${escapeHTMLMisAct(a.zona)}</span></td>
      <td>${PERIODICIDADES_ACTIVIDAD_STAFF[a.periodicidad] || '—'}</td>
      <td><span class="catalog-description">${formatearRangoSemanaActividadStaff(a.semanaKey)}</span></td>
      <td><span class="badge ${BADGE_ESTADOS_ACTIVIDAD_STAFF[a.estado]}">${ESTADOS_ACTIVIDAD_STAFF[a.estado]}</span></td>
      <td>${a.estado === 'anunciado' ? `<button type="button" class="btn btn-primary" style="width:auto;padding:0.5em 1em;" data-mis-act-enterado="${a.id}">Enterado</button>` : ''}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-mis-act-enterado]').forEach(btn => {
    btn.addEventListener('click', () => confirmarEnteradoMisAct(btn.getAttribute('data-mis-act-enterado')));
  });

}

function confirmarEnteradoMisAct(id) {

  const a = obtenerAsignacionActividadStaffPorId(id);
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!a || !overlay || !box) return;

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModalMisAct()">×</button>
    <div class="auth-icon">✓</div>
    <h3>Confirmar actividad</h3>
    <p class="modal-sub">Confirmas que te enteraste de "${escapeHTMLMisAct(a.nombre)}" (${escapeHTMLMisAct(a.zona)}) para la semana del ${formatearRangoSemanaActividadStaff(a.semanaKey)}.</p>
    <div class="modal-note">Se registrará tu nombre, fecha y hora. RH revisará después que la actividad se haya realizado.</div>
    <div style="display:flex;gap:10px;margin-top:6px;">
      <button class="btn btn-outline" style="flex:1;" onclick="cerrarModalMisAct()" type="button">Cancelar</button>
      <button class="btn btn-primary" style="flex:1;" id="actConfirmarEnteradoBtn" type="button">Confirmar</button>
    </div>
  `;

  overlay.classList.add('open');

  document.getElementById('actConfirmarEnteradoBtn').addEventListener('click', () => {
    const resultado = marcarEnteradoAsignacionActividadStaff(id, {
      usuarioId: identidadStaffActual.usuarioId,
      usuarioNombre: identidadStaffActual.usuarioNombre,
      usuarioRol: 'staff'
    });
    cerrarModalMisAct();
    if (!resultado.ok) { mostrarToast(resultado.error); return; }
    renderTablaMisActividades();
    mostrarToast('Confirmado — gracias.');
  });

}
