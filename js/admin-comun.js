// MW JOYERÍA — Portal Admin: utilidades compartidas
// Usado por las páginas admin-*.html con funcionalidad real
// (Catálogo, Apartados, Calendario, Lista de deseos).
//
// Igual que RH, Admin tiene cuenta individual: NO vuelve a pedir
// credenciales en cada acción sensible. En su lugar, antes de
// ejecutar una acción sensible se muestra un modal de Autorización
// con un mensaje dinámico explicando exactamente qué está a punto de
// pasar (mismo patrón que js/rh-comun.js).
//
// ⚠️ TEMPORAL: localStorage simula la base de datos / Firestore.

// Identidad de sesión simulada de Admin (no hay login real todavía).
const ADMIN_IDENTIDAD = {
  usuarioId: 'admin01',
  usuarioNombre: 'Claudia',
  rol: 'admin'
};

const ADMIN_AUDITORIA_STORAGE_KEY = 'mw-auditoria-v1';

let _adminAccionConfirmar = null;

// ============================================================
// MODAL DE AUTORIZACIÓN (confirmación, sin credenciales)
// ============================================================

function abrirAutorizacionAdmin({ titulo = 'Autorización', mensaje, peligrosa = false, onConfirmar }) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  _adminAccionConfirmar = onConfirmar;

  box.innerHTML = `
    <button class="modal-close" data-close>×</button>
    <div class="auth-icon ${peligrosa ? 'danger' : ''}">${peligrosa ? '!' : '✓'}</div>
    <h3>${titulo}</h3>
    <p class="modal-sub">${mensaje}</p>
    <div class="modal-note"><strong>Administración.</strong> Esta acción quedará registrada a tu nombre.</div>
    <div style="display:flex;gap:10px;margin-top:6px;">
      <button class="btn btn-outline" style="flex:1;" id="adminCancelarBtn" type="button">Cancelar</button>
      <button class="btn ${peligrosa ? 'btn-danger' : 'btn-primary'}" style="flex:1;" id="adminConfirmarBtn" type="button">Confirmar</button>
    </div>
  `;

  overlay.classList.add('open');

  const cancelar = () => { _adminAccionConfirmar = null; cerrarModalOverlayAdmin(); };

  box.querySelector('[data-close]')?.addEventListener('click', cancelar);
  document.getElementById('adminCancelarBtn')?.addEventListener('click', cancelar);

  document.getElementById('adminConfirmarBtn')?.addEventListener('click', () => {
    const accion = _adminAccionConfirmar;
    _adminAccionConfirmar = null;
    cerrarModalOverlayAdmin();
    if (typeof accion === 'function') accion();
  });

}

function cerrarModalOverlayAdmin() {
  document.getElementById('modalOverlay')?.classList.remove('open');
}


// ============================================================
// AUDITORÍA (preparada para Firebase — misma bitácora que RH)
// ============================================================

function registrarAuditoriaAdmin({ modulo, accion, descripcion }) {

  const registros = obtenerAuditoriaAdmin();

  registros.unshift({
    id: `AUD-${Date.now()}`,
    usuarioId: ADMIN_IDENTIDAD.usuarioId,
    usuarioNombre: ADMIN_IDENTIDAD.usuarioNombre,
    rol: ADMIN_IDENTIDAD.rol,
    modulo,
    accion,
    descripcion,
    fecha: new Date().toISOString()
  });

  localStorage.setItem(ADMIN_AUDITORIA_STORAGE_KEY, JSON.stringify(registros));

}

function obtenerAuditoriaAdmin() {
  try {
    const registros = JSON.parse(localStorage.getItem(ADMIN_AUDITORIA_STORAGE_KEY));
    return Array.isArray(registros) ? registros : [];
  } catch (error) {
    return [];
  }
}

// ============================================================
// CAMPANA DE NOTIFICACIONES — vista de Admin dividida por rol
// ============================================================
//
// Admin es el único rol que ve las tres bandejas a la vez (en vez de
// una sola bandeja filtrada como Emprendedora/Líder, Staff o RH — ver
// initNotifPanel en portal-common.js). Esta función existe solo aquí
// porque admin-comun.js se carga en todas las páginas de Admin; si
// existe, initNotifPanel la usa en vez de su propio render genérico.

const NOTIF_ADMIN_GRUPOS = [
  { rol: 'admin', titulo: 'Para Administración' },
  { rol: 'emprendedora_lider', titulo: 'Emprendedoras/Líderes' },
  { rol: 'staff', titulo: 'Staff' },
  { rol: 'rh', titulo: 'RH' }
];

// Cada bandeja se muestra como un desplegable independiente (<details>)
// en vez de una lista plana larga — más fácil de escanear cuando hay
// varias bandejas con notificaciones a la vez. Se abre automáticamente
// la bandeja que tiene algo sin leer; una bandeja ya vista completa
// queda colapsada hasta que Admin decida abrirla.
function renderNotificacionesAdminAgrupadas(panel, badge) {

  if (!panel) return;

  const todas = typeof obtenerNotificacionesCompartidas === 'function' ? obtenerNotificacionesCompartidas() : [];
  const noLeidas = todas.filter(n => !n.leida).length;

  if (badge) {
    if (noLeidas > 0) { badge.textContent = noLeidas; badge.style.display = 'flex'; }
    else { badge.style.display = 'none'; }
  }

  const grupos = NOTIF_ADMIN_GRUPOS.map(g => ({
    ...g,
    items: todas.filter(n => (n.rolDestino || 'emprendedora_lider') === g.rol)
  }));

  if (!grupos.some(g => g.items.length)) {
    panel.innerHTML = '<div class="notif-empty">No tienes notificaciones nuevas.</div>';
    return;
  }

  panel.innerHTML = grupos.map(g => {
    if (!g.items.length) return '';
    const noLeidasGrupo = g.items.filter(n => !n.leida).length;
    return `
      <details class="notif-group" ${noLeidasGrupo > 0 ? 'open' : ''}>
        <summary>
          <span>${g.titulo}</span>
          <span class="notif-group-count ${noLeidasGrupo > 0 ? 'sin-leer' : ''}">${noLeidasGrupo > 0 ? noLeidasGrupo : g.items.length}</span>
        </summary>
        <div class="notif-group-items">
          ${g.items.map(n => `
            <a class="notif-item" href="${(typeof PORTAL_LINKS !== 'undefined' && PORTAL_LINKS[n.link]) || n.link}" style="${n.leida ? 'opacity:0.6;' : ''}">${n.texto}</a>
          `).join('')}
        </div>
      </details>
    `;
  }).join('');

}
