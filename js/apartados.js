// MW JOYERÍA — Mis apartados
// Depende de APARTADOS_EJEMPLO, VENTANA_EJEMPLO y DATOS_BANCARIOS_EJEMPLO
// (apartados-ejemplo.js), y reutiliza el modal genérico (#modalOverlay/#modalBox).
//
// El apartado se paga completo, no por pieza: no hay selección
// individual, "Pagar todo mi apartado" cobra el total de todas las
// piezas activas juntas.

let apartadosActuales = [];
let vencimientoTs = null;

document.addEventListener('DOMContentLoaded', () => {
  apartadosActuales = APARTADOS_EJEMPLO.map(p => ({ ...p }));
  vencimientoTs = Date.now() + VENTANA_EJEMPLO.horasRestantes * 60 * 60 * 1000;

  renderApartados();
  iniciarReloj();

  const barBtn = document.getElementById('pagarSeleccionadasBtn');
  if (barBtn) barBtn.addEventListener('click', abrirModalPago);
});

// ---------- Reloj compartido ----------
function iniciarReloj() {
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
}

function actualizarReloj() {
  const restante = Math.max(0, vencimientoTs - Date.now());
  const dias = Math.floor(restante / (1000 * 60 * 60 * 24));
  const horas = Math.floor((restante / (1000 * 60 * 60)) % 24);
  const min = Math.floor((restante / (1000 * 60)) % 60);
  const seg = Math.floor((restante / 1000) % 60);

  setText('cdDias', String(dias).padStart(2, '0'));
  setText('cdHoras', String(horas).padStart(2, '0'));
  setText('cdMin', String(min).padStart(2, '0'));
  setText('cdSeg', String(seg).padStart(2, '0'));
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// Avisa a Staff y RH de una acción que ellos deben revisar/confirmar
// (quitar pieza, cambiar variante, avisar transferencia). Antes estos
// flujos solo mostraban un toast que DECÍA "se le notificó al equipo"
// sin de verdad notificar a nadie — esto lo vuelve real.
//
// nombrePersona: a quién pertenece el apartado — el texto lo nombra
// explícitamente (antes decía "de un apartado" sin decir de quién) y
// el link lleva directo a la fila de esa persona en la tabla operativa
// de Staff/RH (?buscar=NOMBRE — ver js/staff-apartados.js /
// js/rh-apartados.js), no a la lista genérica de apartados.
function notificarEquipoOperativo(texto, nombrePersona) {
  if (typeof agregarNotificacion !== 'function') return;
  const query = nombrePersona ? `?buscar=${encodeURIComponent(nombrePersona)}` : '';
  agregarNotificacion({ texto, link: `staff-apartados.html${query}`, rolDestino: 'staff' });
  agregarNotificacion({ texto, link: `rh-apartados.html${query}`, rolDestino: 'rh' });
}

function obtenerEstadoDepositoPortal() {
  const key = 'mw-deposito-persona-v1';
  try {
    const guardado = JSON.parse(localStorage.getItem(key) || '{}');
    return {
      tieneDeposito: Boolean(guardado.tieneDeposito),
      aplicaDeposito: guardado.aplicaDeposito !== false,
      actualizado: guardado.actualizado || null,
    };
  } catch (error) {
    return { tieneDeposito: false, aplicaDeposito: true, actualizado: null };
  }
}

function guardarEstadoDepositoPortal({ tieneDeposito, aplicaDeposito = true }) {
  const key = 'mw-deposito-persona-v1';
  const estado = {
    tieneDeposito: Boolean(tieneDeposito),
    aplicaDeposito: Boolean(aplicaDeposito),
    actualizado: new Date().toISOString(),
  };
  try {
    localStorage.setItem(key, JSON.stringify(estado));
  } catch (error) {
    // La demo sigue funcionando aunque no haya persistencia disponible.
  }
}

// ---------- Render de la lista ----------
function renderApartados() {
  const list = document.getElementById('apartadosList');
  const wrap = document.getElementById('apartadosWrap');
  const empty = document.getElementById('apartadosEmpty');
  if (!list) return;

  if (apartadosActuales.length === 0) {
    if (wrap) wrap.style.display = 'none';
    if (empty) empty.style.display = 'block';
    actualizarResumen();
    return;
  }
  if (wrap) wrap.style.display = '';
  if (empty) empty.style.display = 'none';

  list.innerHTML = apartadosActuales.map(p => `
    <div class="apartado-row" data-id="${p.id}">
      <div class="apartado-photo"><img src="../../assets/images/isotipo-morado.png" alt=""></div>
      <div class="apartado-info">
        <h4>${p.nombre}</h4>
        <span class="variant">${p.variante}</span>
      </div>
      <div class="apartado-prices">
        <span class="price-public">$${p.precioPublico} MXN</span>
        <span class="price-emprendedora">$${p.precioEmprendedora} MXN</span>
      </div>
      <div class="apartado-actions">
        <button data-editar="${p.id}">Editar</button>
        <button class="quitar" data-quitar="${p.id}">Quitar</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-quitar]').forEach(btn => {
    btn.addEventListener('click', () => quitarPieza(btn.getAttribute('data-quitar')));
  });
  list.querySelectorAll('[data-editar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEditar(btn.getAttribute('data-editar')));
  });

  actualizarResumen();
}

function actualizarResumen() {
  const total = apartadosActuales.reduce((sum, p) => sum + p.precioEmprendedora, 0);
  setText('summaryCount', `${apartadosActuales.length} pieza${apartadosActuales.length === 1 ? '' : 's'} en tu apartado`);
  setText('summaryTotal', `$${total} MXN`);
  const btn = document.getElementById('pagarSeleccionadasBtn');
  if (btn) btn.disabled = apartadosActuales.length === 0;
}

// ---------- Quitar / Editar ----------
function quitarPieza(id) {
  const pieza = apartadosActuales.find(p => p.id === id);
  apartadosActuales = apartadosActuales.filter(p => p.id !== id);
  renderApartados();
  if (pieza) notificarEquipoOperativo(`Se quitó "${pieza.nombre}" (${pieza.variante}) del apartado de ${pieza.emprendedora} — revisa si hay que liberar la pieza.`, pieza.emprendedora);
  mostrarToast('Se le notificó al equipo de tus cambios');
}

function abrirModalEditar(id) {
  const pieza = apartadosActuales.find(p => p.id === id);
  if (!pieza) return;
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Editar: ${pieza.nombre}</h3>
    <p class="modal-sub">Cambia la variante de esta pieza.</p>
    <label for="editVariante">Talla / Color</label>
    <input type="text" id="editVariante" value="${pieza.variante}">
    <button class="btn btn-primary" style="width:100%;" id="guardarEdicionBtn">Guardar cambios</button>
  `;
  overlay.classList.add('open');

  document.getElementById('guardarEdicionBtn').addEventListener('click', () => {
    const nuevaVariante = document.getElementById('editVariante').value.trim();
    if (nuevaVariante) pieza.variante = nuevaVariante;
    overlay.classList.remove('open');
    renderApartados();
    if (nuevaVariante) notificarEquipoOperativo(`Se cambió la variante de "${pieza.nombre}" a "${nuevaVariante}" en el apartado de ${pieza.emprendedora} — confirma que la pieza esté disponible.`, pieza.emprendedora);
    mostrarToast('Se le notificó al equipo de tus cambios');
  });
}

// ---------- Pago ----------
function obtenerNombreActualPortalParaNotificacion() {
  return obtenerNombrePersonaActualPortal() || 'Una emprendedora';
}

function mostrarModalPagoConMonto(piezas, totalFinal, metaDeposito = null) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  const mensajeWa = encodeURIComponent('¡Hola! Te envío mi comprobante de pago');
  const nombrePersona = obtenerNombreActualPortalParaNotificacion();

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Pagar tu apartado completo (${piezas.length} pieza${piezas.length === 1 ? '' : 's'})</h3>
    <p class="modal-sub">Total a pagar: <strong style="color:var(--mw-purple)">$${totalFinal} MXN</strong></p>
    ${metaDeposito ? `<p class="modal-sub" style="margin-top:-.35rem; color:var(--mw-purple); font-weight:600;">${metaDeposito}</p>` : ''}

    <div class="bank-details-box">
      <div class="copy-field">
        <span><span class="cf-label">Banco</span><span class="cf-value">${DATOS_BANCARIOS_EJEMPLO.banco}</span></span>
      </div>
      <div class="copy-field">
        <span><span class="cf-label">Titular</span><span class="cf-value">${DATOS_BANCARIOS_EJEMPLO.titular}</span></span>
      </div>
      <div class="copy-field">
        <span><span class="cf-label">CLABE</span><span class="cf-value">${DATOS_BANCARIOS_EJEMPLO.clabe}</span></span>
        <button data-copy="${DATOS_BANCARIOS_EJEMPLO.clabe}">Copiar</button>
      </div>
      <div class="copy-field">
        <span><span class="cf-label">Cuenta</span><span class="cf-value">${DATOS_BANCARIOS_EJEMPLO.cuenta}</span></span>
        <button data-copy="${DATOS_BANCARIOS_EJEMPLO.cuenta}">Copiar</button>
      </div>
    </div>

    <p class="whatsapp-note">
      Manda tu comprobante a este WhatsApp:<br>
      <a href="https://wa.me/524448100805?text=${mensajeWa}" target="_blank" rel="noopener">444 810 0805</a>
    </p>

    <button class="btn btn-primary" style="width:100%;" id="yaEnvieBtn">Ya envié mi comprobante</button>
  `;
  overlay.classList.add('open');

  box.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard?.writeText(btn.getAttribute('data-copy'));
      const original = btn.textContent;
      btn.textContent = 'Copiado ✓';
      setTimeout(() => { btn.textContent = original; }, 1500);
    });
  });

  document.getElementById('yaEnvieBtn').addEventListener('click', () => {
    notificarEquipoOperativo(`${nombrePersona} avisó que ya transfirió el pago de su apartado completo (${piezas.length} pieza${piezas.length === 1 ? '' : 's'}, $${totalFinal} MXN) — confirma el depósito en el sistema.`, nombrePersona);
    box.innerHTML = `
      <button class="modal-close" data-close>&times;</button>
      <div class="confirm-box">
        <div class="check-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h3>¡Listo!</h3>
        <p class="modal-sub">Ya se notificó al equipo, en breve confirmarán tu pago.</p>
        <button class="btn btn-primary" style="width:100%;" data-close>Cerrar</button>
      </div>
    `;
  });
}

function abrirModalPago() {
  const piezas = apartadosActuales;
  if (piezas.length === 0) return;

  const total = piezas.reduce((sum, p) => sum + p.precioEmprendedora, 0);
  const esVip = piezas.every(p => p.categoria === 'vip');

  if (esVip) {
    guardarEstadoDepositoPortal({ tieneDeposito: false, aplicaDeposito: false });
    mostrarModalPagoConMonto(piezas, total, 'Este apartado es VIP, así que no aplica depósito.');
    return;
  }

  const estadoDeposito = obtenerEstadoDepositoPortal();
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  const nombrePersona = obtenerNombreActualPortalParaNotificacion();

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Tu depósito</h3>
    <p class="modal-sub">Antes de confirmar el pago, decide qué quieres hacer con tu depósito de $50.</p>
    <div style="display:grid;gap:12px;">
      <label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #ddd5e3;border-radius:10px;cursor:pointer;">
        <input type="radio" name="decisionDeposito" value="guardar" ${estadoDeposito.tieneDeposito ? 'checked' : ''}>
        <span><strong>Guardar mi depósito</strong><br><small>Se mantiene en mi cuenta y pago el total completo.</small></span>
      </label>
      <label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #ddd5e3;border-radius:10px;cursor:pointer;">
        <input type="radio" name="decisionDeposito" value="usar" ${!estadoDeposito.tieneDeposito ? 'checked' : ''}>
        <span><strong>Usarlo en este pago</strong><br><small>Se descuenta $50 de mi cuenta y el resto se liquida normal.</small></span>
      </label>
    </div>
    <button class="btn btn-primary" style="width:100%; margin-top:16px;" id="confirmarDepositoDecisionBtn">Continuar</button>
  `;
  overlay.classList.add('open');

  document.getElementById('confirmarDepositoDecisionBtn').addEventListener('click', () => {
    const decision = document.querySelector('input[name="decisionDeposito"]:checked')?.value || 'guardar';
    const tieneDeposito = decision === 'guardar';
    const totalFinal = tieneDeposito ? total : Math.max(0, total - 50);

    guardarEstadoDepositoPortal({ tieneDeposito, aplicaDeposito: true });

    if (tieneDeposito) {
      notificarEquipoOperativo(`${nombrePersona} guardó su depósito de $50 y pagará el total completo de su apartado (${piezas.length} pieza${piezas.length === 1 ? '' : 's'}, $${total} MXN).`, nombrePersona);
      mostrarModalPagoConMonto(piezas, totalFinal, 'Tu depósito quedó guardado y se notificó al equipo.');
    } else {
      notificarEquipoOperativo(`${nombrePersona} no tiene depósito; se descontaron $50 de su cuenta y el restante se liquidará con este pago (${piezas.length} pieza${piezas.length === 1 ? '' : 's'}, $${totalFinal} MXN).`, nombrePersona);
      mostrarModalPagoConMonto(piezas, totalFinal, 'Se descontaron $50 de tu cuenta y se notificó al equipo.');
    }
  });
}
