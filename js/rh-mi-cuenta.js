// MW JOYERÍA — Mi cuenta RH
//
// Página informativa (sección 13 del PROMPT MAESTRO): muestra los
// datos de la cuenta individual de RH. No permite cambiar ni
// restablecer la contraseña/PIN — "Olvidé mi contraseña" solo
// notifica a Administración, nunca genera un restablecimiento
// automático.

document.addEventListener('DOMContentLoaded', () => {

  setText('perfilNombre', RH_IDENTIDAD.usuarioNombre);
  setText('perfilUsuario', RH_IDENTIDAD.usuarioId);

  document.getElementById('olvideAccesoBtn')?.addEventListener('click', () => {
    mostrarToast('Se notificó a Administración. Ellos se pondrán en contacto contigo para restablecer tu acceso.');
  });

  document.getElementById('verComprobanteBtn')?.addEventListener('click', () => {
    mostrarToast('El comprobante de agosto 2026 está disponible para consulta.');
  });

});

function setText(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}
