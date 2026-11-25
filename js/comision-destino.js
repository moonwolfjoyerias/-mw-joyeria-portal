// MW JOYERÍA — Líder: cómo quiere recibir sus comisiones.
//
// La líder elige si se le pagan en dinero o si se guardan como saldo a
// favor para su próxima compra. Se guarda en comisionesDestino/{personaId};
// Administración lo ve en BRILLO al registrar cada pago y lo confirma o lo
// cambia (puede dividirlo entre dinero y saldo). También muestra el saldo a
// favor que ya tiene (brilloSaldos/{personaId}).
//
// Lecturas: 2 documentos al abrir Mi equipo. Escrituras: 1 al guardar.

const COMISION_DESTINO_COLECCION = 'comisionesDestino';

function _dineroComisionDestino(n) {
  return (Number(n) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function _escComisionDestino(s) {
  return typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function _sesionComisionDestino() {
  const s = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
  return s && s.personaId ? s : null;
}

// La sesión se arma después de que Firebase responde: se espera un poco.
function _esperarSesionComisionDestino(intentos = 40) {
  return new Promise(resolve => {
    const probar = n => {
      const s = _sesionComisionDestino();
      if (s || n <= 0) return resolve(s);
      setTimeout(() => probar(n - 1), 250);
    };
    probar(intentos);
  });
}

async function renderComisionDestino() {
  const card = document.getElementById('comisionDestinoCard');
  if (!card) return;
  const sesion = await _esperarSesionComisionDestino();
  if (!sesion || typeof dbFirestore === 'undefined' || !dbFirestore) {
    card.hidden = true;
    return;
  }
  const personaId = sesion.personaId;
  let destino = 'pago';
  let actualizadoEn = null;
  let saldo = 0;
  try {
    const [d, s] = await Promise.all([
      dbFirestore.collection(COMISION_DESTINO_COLECCION).doc(personaId).get(),
      dbFirestore.collection('brilloSaldos').doc(personaId).get()
    ]);
    if (d.exists) { destino = d.data().destino === 'saldo' ? 'saldo' : 'pago'; actualizadoEn = d.data().actualizadoEn || null; }
    if (s.exists) saldo = Number(s.data().saldo) || 0;
  } catch (e) {
    card.hidden = false;
    card.innerHTML = '<h3>Cómo recibir tus comisiones</h3><p class="hint">No se pudo cargar tu elección. Recarga la página para intentarlo de nuevo.</p>';
    return;
  }

  card.hidden = false;
  card.innerHTML = `
    <div class="org-tree-card-header"><h3>Cómo recibir tus comisiones</h3></div>
    <p class="hint" style="margin-top:0;">Elige si quieres que te paguemos tus comisiones o guardarlas como saldo a favor para tu próxima compra. Administración lo confirma al registrar cada pago.</p>
    <div class="comision-destino-opciones" role="radiogroup" aria-label="Cómo recibir tus comisiones">
      <label class="comision-destino-opcion"><input type="radio" name="comisionDestino" value="pago" ${destino === 'pago' ? 'checked' : ''}> <span><strong>Que me las paguen</strong><small>Se te pagan en dinero cada periodo.</small></span></label>
      <label class="comision-destino-opcion"><input type="radio" name="comisionDestino" value="saldo" ${destino === 'saldo' ? 'checked' : ''}> <span><strong>Guardarlas como saldo a favor</strong><small>Se suman a tu saldo para usarlo en tu próxima compra en tienda.</small></span></label>
    </div>
    <div class="comision-destino-pie">
      <span>Tu saldo a favor hoy: <strong>${_dineroComisionDestino(saldo)}</strong></span>
      <button type="button" class="btn btn-primary" id="comisionDestinoGuardar" style="width:auto;" disabled>Guardar mi elección</button>
    </div>
    <p class="hint" id="comisionDestinoEstado">${actualizadoEn ? `Última elección guardada el ${_escComisionDestino(new Date(actualizadoEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }))}.` : ''}</p>`;

  const boton = card.querySelector('#comisionDestinoGuardar');
  const estado = card.querySelector('#comisionDestinoEstado');
  const elegido = () => (card.querySelector('input[name="comisionDestino"]:checked') || {}).value || 'pago';
  card.querySelectorAll('input[name="comisionDestino"]').forEach(r => r.addEventListener('change', () => { boton.disabled = elegido() === destino; }));
  boton.addEventListener('click', async () => {
    const nuevo = elegido();
    boton.disabled = true;
    boton.textContent = 'Guardando…';
    try {
      const ahora = new Date().toISOString();
      await dbFirestore.collection(COMISION_DESTINO_COLECCION).doc(personaId).set({
        personaId,
        nombre: sesion.nombre || sesion.nombreCompleto || '',
        destino: nuevo,
        actualizadoEn: ahora
      });
      destino = nuevo;
      estado.textContent = nuevo === 'saldo'
        ? 'Listo: pediste guardar tus comisiones como saldo a favor.'
        : 'Listo: pediste que te paguen tus comisiones.';
      if (typeof mostrarToast === 'function') mostrarToast('Tu elección se guardó.');
    } catch (e) {
      estado.textContent = 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.';
      boton.disabled = false;
    }
    boton.textContent = 'Guardar mi elección';
  });
}

document.addEventListener('DOMContentLoaded', () => { renderComisionDestino(); });
