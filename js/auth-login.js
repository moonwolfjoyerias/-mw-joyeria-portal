// MW JOYERÍA — Formulario de inicio de sesión (login.html)
//
// FASE 2 (Firebase): si js/firebase-init.js dejó `authFirebase` con
// valor (MODO_DEMO=false + config real), el login intenta primero
// Firebase Auth (ver js/auth-service.js) — usuario/contraseña reales,
// nunca comparados en el navegador. Si no hay Firebase configurado,
// sigue funcionando exactamente igual que antes: valida contra los DOS
// registros demo que ya existen en el portal — cuentas-internas-modelo.js
// (Staff/Encargado/Admin) y personas-ejemplo.js (Emprendedora/Líder) —
// ver js/auth-guard.js para las funciones de sesión
// (guardarSesionActiva/obtenerSesionActiva).
//
// ⚠️ TEMPORAL (solo en modo demo): las contraseñas viajan y se comparan
// en texto plano en el navegador porque no existe todavía un backend
// real para esos módulos. Esto desaparece por completo en cuanto
// MODO_DEMO es false — Firebase Auth nunca expone contraseñas.

const RUTA_PORTAL_POR_ROL = {
  admin: 'portal/admin/admin-portal.html',
  encargado: 'portal/encargado/encargado-portal.html',
  staff: 'portal/staff/staff-portal.html',
  emprendedora: 'portal/emprendedora/emprendedora-portal.html',
  lider: 'portal/lider/lider-portal.html',
};

async function iniciarSesion(usuario, password) {

  usuario = String(usuario || '').trim();
  password = String(password || '');

  if (!usuario || !password) {
    return { ok: false, error: 'Escribe tu usuario y tu contraseña.' };
  }

  if (typeof authFirebase !== 'undefined' && authFirebase) {
    return iniciarSesionFirebase(usuario, password);
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
        rol: cuenta.rol, // 'staff' | 'encargado' | 'admin'
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

  form.addEventListener('submit', async evento => {
    evento.preventDefault();

    const usuario = document.getElementById('loginUsuario').value;
    const password = document.getElementById('loginPassword').value;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const resultado = await iniciarSesion(usuario, password);

    if (submitBtn) submitBtn.disabled = false;

    if (!resultado.ok) {
      errorBox.textContent = resultado.error;
      errorBox.style.display = 'block';
      return;
    }

    errorBox.style.display = 'none';
    window.location.href = RUTA_PORTAL_POR_ROL[resultado.sesion.rol] || 'index.html';
  });

});
