// MW JOYERÍA — Mis apartados
// Depende de APARTADOS_EJEMPLO, VENTANA_EJEMPLO y DATOS_BANCARIOS_EJEMPLO
// (apartados-ejemplo.js), y reutiliza el modal genérico (#modalOverlay/#modalBox).

let apartadosActuales = [];
const seleccionados = new Set();
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
      <input type="checkbox" data-check="${p.id}" ${seleccionados.has(p.id) ? 'checked' : ''}>
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

  list.querySelectorAll('[data-check]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-check');
      if (e.target.checked) seleccionados.add(id); else seleccionados.delete(id);
      actualizarResumen();
    });
  });
  list.querySelectorAll('[data-quitar]').forEach(btn => {
    btn.addEventListener('click', () => quitarPieza(btn.getAttribute('data-quitar')));
  });
  list.querySelectorAll('[data-editar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEditar(btn.getAttribute('data-editar')));
  });

  actualizarResumen();
}

function actualizarResumen() {
  const total = apartadosActuales
    .filter(p => seleccionados.has(p.id))
    .reduce((sum, p) => sum + p.precioEmprendedora, 0);
  setText('summaryCount', `${seleccionados.size} pieza${seleccionados.size === 1 ? '' : 's'} seleccionada${seleccionados.size === 1 ? '' : 's'}`);
  setText('summaryTotal', `$${total} MXN`);
  const btn = document.getElementById('pagarSeleccionadasBtn');
  if (btn) btn.disabled = seleccionados.size === 0;
}

// ---------- Quitar / Editar ----------
function quitarPieza(id) {
  apartadosActuales = apartadosActuales.filter(p => p.id !== id);
  seleccionados.delete(id);
  renderApartados();
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
    mostrarToast('Se le notificó al equipo de tus cambios');
  });
}

// ---------- Pago ----------
function abrirModalPago() {
  const piezas = apartadosActuales.filter(p => seleccionados.has(p.id));
  if (piezas.length === 0) return;
  const total = piezas.reduce((sum, p) => sum + p.precioEmprendedora, 0);
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  const mensajeWa = encodeURIComponent('¡Hola! Te envío mi comprobante de pago');

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Pagar ${piezas.length} pieza${piezas.length === 1 ? '' : 's'}</h3>
    <p class="modal-sub">Total a pagar: <strong style="color:var(--mw-purple)">$${total} MXN</strong></p>

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
