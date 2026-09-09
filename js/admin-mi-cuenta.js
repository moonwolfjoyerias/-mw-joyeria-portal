// MW JOYERÍA — Admin: Mi cuenta
//
// Página de perfil propio del Admin: foto, usuario (solo lectura),
// teléfono y correo (editables). Reutiliza el registro único de
// cuentas internas (js/cuentas-internas-modelo.js) construido para
// Configuración → Usuarios y permisos — no crea un almacén paralelo.
// El usuario y la contraseña NO se editan aquí (eso vive en
// Configuración); esta página es solo datos de contacto + foto.

document.addEventListener('DOMContentLoaded', () => {
  renderMiCuentaAdmin();

  document.getElementById('miCuentaFotoInput')?.addEventListener('change', (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      e.target.value = '';
      mostrarToast('Selecciona un archivo de imagen válido.');
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      e.target.value = '';
      mostrarToast('La imagen no puede superar 2 MB.');
      return;
    }

    const lector = new FileReader();
    lector.onload = () => {
      const cuenta = obtenerCuentaPropiaAdmin();
      if (!cuenta) return;
      editarCuentaInterna(cuenta.id, { fotoUrl: lector.result });
      mostrarToast('Foto de perfil actualizada.');
      renderMiCuentaAdmin();
    };
    lector.readAsDataURL(archivo);
  });

  document.getElementById('miCuentaTelefonoBtn')?.addEventListener('click', () => abrirModalEditarCampoCuentaAdmin('telefono'));
  document.getElementById('miCuentaCorreoBtn')?.addEventListener('click', () => abrirModalEditarCampoCuentaAdmin('correo'));
});

function obtenerCuentaPropiaAdmin() {
  return obtenerCuentasInternas().find(c => c.usuario === ADMIN_IDENTIDAD.usuarioId) || null;
}

function renderMiCuentaAdmin() {

  const cuenta = obtenerCuentaPropiaAdmin();
  if (!cuenta) return;

  const inicial = escapeHTMLMiCuentaAdmin(cuenta.nombre.trim().charAt(0).toUpperCase() || 'A');
  const fotoPreview = document.getElementById('miCuentaFotoPreview');
  if (fotoPreview) {
    fotoPreview.innerHTML = cuenta.fotoUrl
      ? `<img src="${escapeHTMLMiCuentaAdmin(cuenta.fotoUrl)}" alt="Foto de ${escapeHTMLMiCuentaAdmin(cuenta.nombre)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : inicial;
  }

  setTextMiCuentaAdmin('miCuentaNombre', cuenta.nombre);
  setTextMiCuentaAdmin('miCuentaUsuario', cuenta.usuario);
  setTextMiCuentaAdmin('miCuentaTelefonoValor', cuenta.telefono || 'Sin registrar');
  setTextMiCuentaAdmin('miCuentaCorreoValor', cuenta.correo || 'Sin registrar');

}

function abrirModalEditarCampoCuentaAdmin(campo) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  const cuenta = obtenerCuentaPropiaAdmin();
  if (!overlay || !box || !cuenta) return;

  const config = {
    telefono: { titulo: 'Cambiar teléfono', label: 'Teléfono', tipo: 'tel', placeholder: '444 000 0000', valor: cuenta.telefono || '' },
    correo: { titulo: 'Cambiar correo', label: 'Correo', tipo: 'email', placeholder: 'correo@ejemplo.com', valor: cuenta.correo || '' }
  }[campo];
  if (!config) return;

  box.style.maxWidth = '380px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20h4L18 10l-4-4L4 16v4z"/><path d="M13 7l4 4"/></svg></div>
    <h3>${config.titulo}</h3>
    <label class="cfg-field-label">${config.label}</label>
    <input type="${config.tipo}" id="miCuentaCampoInput" value="${escapeHTMLMiCuentaAdmin(config.valor)}" placeholder="${config.placeholder}">
    <div id="miCuentaCampoError" class="auth-error" style="display:none;"></div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" id="miCuentaCampoCancelarBtn" type="button">Cancelar</button>
      <button class="btn btn-primary" style="flex:1;" id="miCuentaCampoGuardarBtn" type="button">Guardar</button>
    </div>
  `;

  overlay.classList.add('open');
  const cerrar = () => overlay.classList.remove('open');
  box.querySelector('[data-close]')?.addEventListener('click', cerrar);
  document.getElementById('miCuentaCampoCancelarBtn')?.addEventListener('click', cerrar);

  document.getElementById('miCuentaCampoGuardarBtn')?.addEventListener('click', () => {
    const valor = document.getElementById('miCuentaCampoInput').value.trim();
    const error = document.getElementById('miCuentaCampoError');

    if (campo === 'correo' && valor && !/^\S+@\S+\.\S+$/.test(valor)) {
      error.style.display = 'block';
      error.textContent = 'Ingresa un correo válido.';
      return;
    }

    editarCuentaInterna(cuenta.id, { [campo]: valor });
    cerrar();
    mostrarToast(`${config.label} actualizado.`);
    renderMiCuentaAdmin();
  });

}

function setTextMiCuentaAdmin(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}

function escapeHTMLMiCuentaAdmin(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
