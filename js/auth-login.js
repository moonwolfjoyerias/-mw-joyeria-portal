// MW JOYERÍA — Formulario de inicio de sesión (login.html)
//
// Valida contra los DOS registros de cuentas reales que ya existen en el
// portal: cuentas-internas-modelo.js (Staff/RH/Admin) y
// personas-ejemplo.js (Emprendedora/Líder) — ver js/auth-guard.js para
// las funciones de sesión (guardarSesionActiva/obtenerSesionActiva).
//
// ⚠️ TEMPORAL: las contraseñas viajan y se comparan en texto plano en el
// navegador porque no existe todavía un backend real. Esto se reemplaza
// por signInWithEmailAndPassword de Firebase Auth en Fase 3 (ver
// auditoría de preparación para Firebase, sección E).

const RUTA_PORTAL_POR_ROL = {
  admin: 'portal/admin/admin-portal.html',
  rh: 'portal/rh/rh-portal.html',
  staff: 'portal/staff/staff-portal.html',
  emprendedora: 'portal/emprendedora/emprendedora-portal.html',
  lider: 'portal/lider/lider-portal.html',
};

function iniciarSesion(usuario, password) {

  usuario = String(usuario || '').trim();
  password = String(password || '');

  if (!usuario || !password) {
    return { ok: false, error: 'Escribe tu usuario y tu contraseña.' };
  }

  if (typeof verificarCredencialInterna === 'function') {
    const cuenta = verificarCredencialInterna(usuario, password);
    if (cuenta) {
      const sesion = {
        tipo: 'interna',
        cuentaId: cuenta.id,
        personaId: null,
        usuario: cuenta.usuario,
        nombre: cuenta.nombre,
        rol: cuenta.rol, // 'staff' | 'rh' | 'admin'
        iniciadaEn: new Date().toISOString(),
      };
      guardarSesionActiva(sesion);
      return { ok: true, sesion };
    }
  }

  if (typeof verificarCredencialPersona === 'function') {
    const persona = verificarCredencialPersona(usuario, password);
    if (persona) {
      const sesion = {
        tipo: 'persona',
        cuentaId: null,
        personaId: persona.id,
        usuario: persona.usuario,
        nombre: typeof nombreCompletoPersona === 'function' ? nombreCompletoPersona(persona) : persona.nombre,
        rol: persona.tipo, // 'emprendedora' | 'lider'
        iniciadaEn: new Date().toISOString(),
      };
      guardarSesionActiva(sesion);
      return { ok: true, sesion };
    }
  }

  return { ok: false, error: 'Usuario o contraseña incorrectos.' };

}

document.addEventListener('DOMContentLoaded', () => {

  const sesionExistente = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
  if (sesionExistente && RUTA_PORTAL_POR_ROL[sesionExistente.rol]) {
    window.location.replace(RUTA_PORTAL_POR_ROL[sesionExistente.rol]);
    return;
  }

  const form = document.getElementById('loginForm');
  const errorBox = document.getElementById('loginError');
  if (!form) return;

  form.addEventListener('submit', evento => {
    evento.preventDefault();

    const usuario = document.getElementById('loginUsuario').value;
    const password = document.getElementById('loginPassword').value;
    const resultado = iniciarSesion(usuario, password);

    if (!resultado.ok) {
      errorBox.textContent = resultado.error;
      errorBox.style.display = 'block';
      return;
    }

    errorBox.style.display = 'none';
    window.location.href = RUTA_PORTAL_POR_ROL[resultado.sesion.rol] || 'index.html';
  });

});
