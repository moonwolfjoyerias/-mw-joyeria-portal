// MW JOYERÍA — Portal RH: utilidades compartidas
// Usado por todas las páginas rh-*.html.
//
// A diferencia de Staff (usuario + contraseña en cada acción sensible),
// RH tiene cuenta individual: NO vuelve a pedir credenciales. En su
// lugar, antes de ejecutar una acción sensible se muestra un modal de
// Autorización con un mensaje dinámico explicando exactamente qué está
// a punto de pasar (ver PROMPT MAESTRO PORTAL RH, secciones 15-20).
//
// ⚠️ TEMPORAL: localStorage simula la base de datos / Firestore.

// Identidad de sesión simulada de RH (no hay login real todavía).
const RH_IDENTIDAD = {
  usuarioId: 'rh01',
  usuarioNombre: 'Recursos Humanos',
  rol: 'rh'
};

const RH_AUDITORIA_STORAGE_KEY = 'mw-auditoria-v1';

let _rhAccionConfirmar = null;

// ============================================================
// MODAL DE AUTORIZACIÓN (confirmación, sin credenciales)
// ============================================================

// onConfirmar: función que ejecuta la acción real cuando el usuario
// pulsa "Confirmar". peligrosa: true para acciones destructivas
// (eliminar, cancelar) — cambia el color del ícono y del botón.
function abrirAutorizacionRH({ titulo = 'Autorización', mensaje, peligrosa = false, onConfirmar }) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  _rhAccionConfirmar = onConfirmar;

  box.innerHTML = `
    <button class="modal-close" data-close>×</button>
    <div class="auth-icon ${peligrosa ? 'danger' : ''}">${peligrosa ? '!' : '✓'}</div>
    <h3>${titulo}</h3>
    <p class="modal-sub">${mensaje}</p>
    <div class="modal-note"><strong>Recursos Humanos.</strong> Esta acción quedará registrada a tu nombre.</div>
    <div style="display:flex;gap:10px;margin-top:6px;">
      <button class="btn btn-outline" style="flex:1;" id="rhCancelarBtn" type="button">Cancelar</button>
      <button class="btn ${peligrosa ? 'btn-danger' : 'btn-primary'}" style="flex:1;" id="rhConfirmarBtn" type="button">Confirmar</button>
    </div>
  `;

  overlay.classList.add('open');

  const cancelar = () => { _rhAccionConfirmar = null; cerrarModalOverlayRH(); };

  box.querySelector('[data-close]')?.addEventListener('click', cancelar);
  document.getElementById('rhCancelarBtn')?.addEventListener('click', cancelar);

  document.getElementById('rhConfirmarBtn')?.addEventListener('click', () => {
    const accion = _rhAccionConfirmar;
    _rhAccionConfirmar = null;
    cerrarModalOverlayRH();
    if (typeof accion === 'function') accion();
  });

}

function cerrarModalOverlayRH() {
  document.getElementById('modalOverlay')?.classList.remove('open');
}


// ============================================================
// AUDITORÍA (preparada para Firebase)
// ============================================================

// Registra únicamente acciones que modifican, crean, eliminan o
// cambian estados — nunca búsquedas, filtros o navegación.
function registrarAuditoriaRH({ modulo, accion, descripcion }) {

  const registros = obtenerAuditoriaRH();

  registros.unshift({
    id: `AUD-${Date.now()}`,
    usuarioId: RH_IDENTIDAD.usuarioId,
    usuarioNombre: RH_IDENTIDAD.usuarioNombre,
    rol: RH_IDENTIDAD.rol,
    modulo,
    accion,
    descripcion,
    fecha: new Date().toISOString()
  });

  localStorage.setItem(RH_AUDITORIA_STORAGE_KEY, JSON.stringify(registros));

}

function obtenerAuditoriaRH() {
  try {
    const registros = JSON.parse(localStorage.getItem(RH_AUDITORIA_STORAGE_KEY));
    return Array.isArray(registros) ? registros : [];
  } catch (error) {
    return [];
  }
}
