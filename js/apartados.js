// MW JOYERÍA — Mis apartados (Emprendedora / Líder)
//
// Las piezas y el estado del depósito que se muestran aquí vienen de
// apartados-modelo.js — la MISMA fuente de datos que usan Staff/RH/Admin
// para crear, liquidar y cancelar ventanas de apartado — filtrados a las
// ventanas de la persona con sesión abierta (usuarioId = slugUsuarioId(nombre),
// igual que como Staff las crea). Antes esta vista usaba un arreglo estático
// (APARTADOS_EJEMPLO) totalmente desconectado del sistema real: una pieza
// apartada por Staff nunca aparecía aquí. DATOS_BANCARIOS_EJEMPLO
// (apartados-ejemplo.js) sigue usándose solo para los datos bancarios a
// mostrar, y reutiliza el modal genérico (#modalOverlay/#modalBox).
//
// El apartado se paga completo, no por pieza: no hay selección
// individual, "Pagar todo mi apartado" cobra el total de todas las
// piezas activas juntas de UNA ventana (la ventana activa vigente).

let usuarioIdActual = '';

document.addEventListener('DOMContentLoaded', () => {
  const nombreActual = (typeof obtenerNombrePersonaActualPortal === 'function' && obtenerNombrePersonaActualPortal()) || '';
  usuarioIdActual = typeof slugUsuarioId === 'function' ? slugUsuarioId(nombreActual) : '';

  renderApartados();
  iniciarReloj();

  const barBtn = document.getElementById('pagarSeleccionadasBtn');
  if (barBtn) barBtn.addEventListener('click', abrirModalPago);
});

// ---------- Datos propios (leídos del modelo real, no de ejemplo) ----------
function obtenerVentanasPropias() {
  if (!usuarioIdActual) return [];
  return obtenerVentanasApartado().filter(v => v.usuarioId === usuarioIdActual && v.estado !== 'cerrada');
}

// Piezas activas de todas las ventanas propias, cada una junto a su
// ventana (para poder editarla/quitarla y guardarla de vuelta).
function obtenerPiezasPropiasConVentana() {
  return obtenerVentanasPropias().flatMap(ventana =>
    obtenerPiezasActivas(ventana).map(pieza => ({ pieza, ventana }))
  );
}

// La ventana con depósito ya confirmado (estado 'activa') que vence más
// pronto — es la única contra la que tiene sentido correr un cronómetro o
// aceptar un pago. Una ventana 'pendiente_deposito' todavía no tiene un
// vencimiento real corriendo (empieza a correr hasta que Staff confirma el
// depósito), así que no cuenta aquí aunque sus piezas sí se muestren en la
// lista.
function obtenerVentanaActivaPrincipal() {
  const activas = obtenerVentanasPropias().filter(v => v.estado === 'activa' && v.fechaVencimiento);
  if (!activas.length) return null;
  return activas.sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento))[0];
}

// Aplica un cambio a una ventana propia y lo persiste en el almacén
// compartido (una sola lectura/escritura para evitar pisar datos con una
// segunda lectura desincronizada).
function mutarVentanaPropia(ventanaId, mutador) {
  const ventanas = obtenerVentanasApartado();
  const ventana = ventanas.find(v => v.id === ventanaId);
  if (!ventana) return null;
  mutador(ventana);
  guardarVentanasApartado(ventanas);
  return ventana;
}

// ---------- Reloj compartido ----------
function iniciarReloj() {
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
}

function actualizarReloj() {
  const ventana = obtenerVentanaActivaPrincipal();
  const box = document.querySelector('.countdown-box');

  if (!ventana) {
    if (box) box.style.display = 'none';
    return;
  }
  if (box) box.style.display = '';

  const restante = Math.max(0, new Date(ventana.fechaVencimiento).getTime() - Date.now());
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
// (quitar pieza, cambiar variante, avisar transferencia). El link lleva
// directo a la fila de esa persona en la tabla operativa de Staff/RH
// (?buscar=NOMBRE — ver js/staff-apartados.js / js/rh-apartados.js).
function notificarEquipoOperativo(texto, nombrePersona) {
  if (typeof agregarNotificacion !== 'function') return;
  const query = nombrePersona ? `?buscar=${encodeURIComponent(nombrePersona)}` : '';
  agregarNotificacion({ texto, link: `staff-apartados.html${query}`, rolDestino: 'staff' });
}

// ---------- Render de la lista ----------
function renderApartados() {
  const list = document.getElementById('apartadosList');
  const wrap = document.getElementById('apartadosWrap');
  const empty = document.getElementById('apartadosEmpty');
  if (!list) return;

  const items = obtenerPiezasPropiasConVentana();

  if (items.length === 0) {
    if (wrap) wrap.style.display = 'none';
    if (empty) empty.style.display = 'block';
    actualizarResumen();
    return;
  }
  if (wrap) wrap.style.display = '';
  if (empty) empty.style.display = 'none';

  list.innerHTML = items.map(({ pieza }) => `
    <div class="apartado-row" data-id="${pieza.id}">
      <div class="apartado-photo"><img src="../../assets/images/isotipo-morado.png" alt=""></div>
      <div class="apartado-info">
        <h4>${pieza.producto}</h4>
        <span class="variant">${pieza.variante}</span>
      </div>
      <div class="apartado-prices">
        <span class="price-emprendedora">$${pieza.total} MXN</span>
      </div>
      <div class="apartado-actions">
        <button data-editar="${pieza.id}">Editar</button>
        <button class="quitar" data-quitar="${pieza.id}">Quitar</button>
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
  const items = obtenerPiezasPropiasConVentana();
  const total = items.reduce((sum, { pieza }) => sum + Number(pieza.total || 0), 0);
  setText('summaryCount', `${items.length} pieza${items.length === 1 ? '' : 's'} en tu apartado`);
  setText('summaryTotal', `$${total} MXN`);
  const btn = document.getElementById('pagarSeleccionadasBtn');
  const ventanaPago = obtenerVentanaActivaPrincipal();
  if (btn) btn.disabled = !ventanaPago || obtenerPiezasActivas(ventanaPago).length === 0;
}

// ---------- Quitar / Editar ----------
function quitarPieza(id) {
  const encontrado = obtenerPiezasPropiasConVentana().find(({ pieza }) => pieza.id === id);
  if (!encontrado) return;
  const { pieza, ventana } = encontrado;
  const nombrePersona = ventana.usuarioNombre;
  const nombrePieza = pieza.producto;
  const variantePieza = pieza.variante;

  mutarVentanaPropia(ventana.id, v => {
    const p = v.apartados.find(x => x.id === id);
    if (p) p.estado = 'cancelada';
  });

  renderApartados();
  notificarEquipoOperativo(`Se quitó "${nombrePieza}" (${variantePieza}) del apartado de ${nombrePersona} — revisa si hay que liberar la pieza.`, nombrePersona);
  mostrarToast('Se le notificó al equipo de tus cambios');
}

function abrirModalEditar(id) {
  const encontrado = obtenerPiezasPropiasConVentana().find(({ pieza }) => pieza.id === id);
  if (!encontrado) return;
  const { pieza, ventana } = encontrado;
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Editar: ${pieza.producto}</h3>
    <p class="modal-sub">Cambia la variante de esta pieza.</p>
    <label for="editVariante">Talla / Color</label>
    <input type="text" id="editVariante" value="${pieza.variante}">
    <button class="btn btn-primary" style="width:100%;" id="guardarEdicionBtn">Guardar cambios</button>
  `;
  overlay.classList.add('open');

  document.getElementById('guardarEdicionBtn').addEventListener('click', () => {
    const nuevaVariante = document.getElementById('editVariante').value.trim();
    if (nuevaVariante) {
      mutarVentanaPropia(ventana.id, v => {
        const p = v.apartados.find(x => x.id === id);
        if (p) p.variante = nuevaVariante;
      });
    }
    overlay.classList.remove('open');
    renderApartados();
    if (nuevaVariante) notificarEquipoOperativo(`Se cambió la variante de "${pieza.producto}" a "${nuevaVariante}" en el apartado de ${ventana.usuarioNombre} — confirma que la pieza esté disponible.`, ventana.usuarioNombre);
    mostrarToast('Se le notificó al equipo de tus cambios');
  });
}

// ---------- Pago ----------
function mostrarModalPagoConMonto(ventana, piezas, totalFinal, notaExtra, decisionDeposito) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  const mensajeWa = encodeURIComponent('¡Hola! Te envío mi comprobante de pago');
  const nombrePersona = ventana.usuarioNombre;

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Pagar tu apartado completo (${piezas.length} pieza${piezas.length === 1 ? '' : 's'})</h3>
    <p class="modal-sub">Total a pagar: <strong style="color:var(--mw-purple)">$${totalFinal} MXN</strong></p>
    ${notaExtra ? `<p class="modal-sub" style="margin-top:-.35rem; color:var(--mw-purple); font-weight:600;">${notaExtra}</p>` : ''}

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
      btn.innerHTML = 'Copiado <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></span>';
      setTimeout(() => { btn.textContent = original; }, 1500);
    });
  });

  document.getElementById('yaEnvieBtn').addEventListener('click', () => {
    const notaDeposito = decisionDeposito === 'aplicar'
      ? ' — decidió aplicar su depósito a esta compra'
      : decisionDeposito === 'credito'
        ? ' — decidió guardar su depósito como crédito'
        : '';
    notificarEquipoOperativo(`${nombrePersona} avisó que ya transfirió el pago de su apartado completo (${piezas.length} pieza${piezas.length === 1 ? '' : 's'}, $${totalFinal} MXN)${notaDeposito} — confirma el depósito y liquida el apartado en el sistema.`, nombrePersona);
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
  const ventana = obtenerVentanaActivaPrincipal();
  if (!ventana) return;
  const piezas = obtenerPiezasActivas(ventana);
  if (!piezas.length) return;

  const total = piezas.reduce((sum, p) => sum + Number(p.total || 0), 0);
  const esVip = ventana.categoria === 'vip';

  if (esVip || !ventana.depositoApartadoDisponible) {
    mostrarModalPagoConMonto(ventana, piezas, total, esVip ? 'Este apartado es VIP, así que no aplica depósito.' : null);
    return;
  }

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  const nombrePersona = ventana.usuarioNombre;
  const montoDeposito = ventana.depositoApartadoDisponible;

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Tu depósito</h3>
    <p class="modal-sub">Antes de confirmar el pago, decide qué quieres hacer con tu depósito de $${montoDeposito}.</p>
    <div style="display:grid;gap:12px;">
      <label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #ddd5e3;border-radius:10px;cursor:pointer;">
        <input type="radio" name="decisionDeposito" value="guardar" checked>
        <span><strong>Guardar mi depósito</strong><br><small>Se mantiene como crédito para tu próximo apartado y pago el total completo.</small></span>
      </label>
      <label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #ddd5e3;border-radius:10px;cursor:pointer;">
        <input type="radio" name="decisionDeposito" value="usar">
        <span><strong>Usarlo en este pago</strong><br><small>Se descuenta $${montoDeposito} de mi cuenta y el resto se liquida normal.</small></span>
      </label>
    </div>
    <button class="btn btn-primary" style="width:100%; margin-top:16px;" id="confirmarDepositoDecisionBtn">Continuar</button>
  `;
  overlay.classList.add('open');

  document.getElementById('confirmarDepositoDecisionBtn').addEventListener('click', () => {
    const decision = document.querySelector('input[name="decisionDeposito"]:checked')?.value || 'guardar';
    const usarDeposito = decision === 'usar';
    const totalFinal = usarDeposito ? Math.max(0, total - montoDeposito) : total;

    if (usarDeposito) {
      notificarEquipoOperativo(`${nombrePersona} decidió usar su depósito de $${montoDeposito} en este pago (${piezas.length} pieza${piezas.length === 1 ? '' : 's'}, $${totalFinal} MXN).`, nombrePersona);
      mostrarModalPagoConMonto(ventana, piezas, totalFinal, `Se descontará tu depósito de $${montoDeposito} y se notificó al equipo.`, 'aplicar');
    } else {
      notificarEquipoOperativo(`${nombrePersona} guardará su depósito de $${montoDeposito} como crédito y pagará el total completo de su apartado (${piezas.length} pieza${piezas.length === 1 ? '' : 's'}, $${total} MXN).`, nombrePersona);
      mostrarModalPagoConMonto(ventana, piezas, total, 'Tu depósito quedó guardado como crédito y se notificó al equipo.', 'credito');
    }
  });
}
