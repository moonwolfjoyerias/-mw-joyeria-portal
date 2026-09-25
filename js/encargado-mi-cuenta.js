// MW JOYERÍA — Mi cuenta Encargado
//
// Página informativa (sección 13 del PROMPT MAESTRO): muestra los
// datos de la cuenta individual de Encargado. No permite cambiar ni
// restablecer la contraseña/PIN — "Olvidé mi contraseña" solo
// notifica a Administración, nunca genera un restablecimiento
// automático.

document.addEventListener('DOMContentLoaded', () => {

  setText('perfilNombre', ENCARGADO_IDENTIDAD.usuarioNombre);
  setText('perfilUsuario', ENCARGADO_IDENTIDAD.usuarioId);
  renderFotoPerfilEncargado();

  document.getElementById('olvideAccesoBtn')?.addEventListener('click', () => {
    mostrarToast('Se notificó a Administración. Ellos se pondrán en contacto contigo para restablecer tu acceso.');
  });

  document.getElementById('verComprobanteBtn')?.addEventListener('click', () => {
    mostrarToast('El comprobante de agosto 2026 está disponible para consulta.');
  });

  document.getElementById('perfilFotoInput')?.addEventListener('change', (e) => {
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
      editarCuentaInterna(ENCARGADO_IDENTIDAD.usuarioId, { fotoUrl: lector.result });
      mostrarToast('Foto de perfil actualizada.');
      renderFotoPerfilEncargado();
    };
    lector.readAsDataURL(archivo);
  });

});

function renderFotoPerfilEncargado() {
  const fotoBox = document.getElementById('perfilIniciales');
  if (!fotoBox) return;
  const cuenta = typeof obtenerCuentasInternas === 'function' ? obtenerCuentasInternas().find(c => c.id === ENCARGADO_IDENTIDAD.usuarioId) : null;
  const inicial = ENCARGADO_IDENTIDAD.usuarioNombre.trim().charAt(0).toUpperCase() || 'R';
  fotoBox.innerHTML = cuenta?.fotoUrl
    ? `<img src="${cuenta.fotoUrl}" alt="Foto de ${ENCARGADO_IDENTIDAD.usuarioNombre}" style="width:100%;height:100%;object-fit:cover;">`
    : inicial;
}

function setText(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}
