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
