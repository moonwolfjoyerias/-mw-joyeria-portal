// MW JOYERÍA — Mi pedido (e/l): pestañas Carrito · Apartado · Pagados
//
// Carrito: lo que eligió en el Catálogo (js/pedidos-modelo.js). Desde
// aquí escoge APARTAR (sus piezas pasan a su apartado con las reglas de
// siempre) o PAGAR (transfiere, sube su comprobante y nace un pedido
// pagado). Solo en ese momento se le avisa al equipo.
// Apartado: lo de siempre (js/apartados.js).
// Pagados: el seguimiento de sus pedidos pagados.

(function () {
  const TABS = ['carrito', 'apartado', 'pagados'];
  let tabActual = null;
  let enviando = false;

  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pesos = n => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const persona = () => {
    const id = typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : '';
    return (id && typeof obtenerPersonaPorId === 'function' && obtenerPersonaPorId(id)) || null;
  };
  const categoria = () => persona()?.categoria || 'normal';
  const nombrePropio = () => (typeof obtenerNombrePersonaActualPortal === 'function' && obtenerNombrePersonaActualPortal()) || persona()?.nombre || '';

  // ---------------- Pestañas ----------------
  function elegirTab(tab, enfocar) {
    tabActual = tab;
    TABS.forEach((t) => {
      const b = document.querySelector(`[data-pedido-tab="${t}"]`);
      const panel = $(`pedidoPanel-${t}`);
      if (b) { b.setAttribute('aria-selected', String(t === tab)); b.tabIndex = t === tab ? 0 : -1; }
      if (panel) panel.hidden = t !== tab;
    });
    document.body.classList.toggle('pedido-tab-apartado', tab === 'apartado');
    if (enfocar) document.querySelector(`[data-pedido-tab="${tab}"]`)?.focus();
    try { history.replaceState(null, '', '#' + tab); } catch (e) { /* noop */ }
  }

  function contarTabs() {
    const nCarrito = typeof obtenerCarrito === 'function' ? obtenerCarrito().length : 0;
    const nPagados = (typeof obtenerPedidosPagados === 'function' ? obtenerPedidosPagados() : []).filter(p => !ESTADOS_PEDIDO_TERMINADOS.includes(p.estado)).length;
    const c = document.querySelector('[data-pedido-tab="carrito"] .pestana-num');
    const p = document.querySelector('[data-pedido-tab="pagados"] .pestana-num');
    if (c) { c.textContent = nCarrito; c.hidden = !nCarrito; }
    if (p) { p.textContent = nPagados; p.hidden = !nPagados; }
  }

  // ---------------- Carrito ----------------
  function fotoPieza(pieza) {
    const catalogo = typeof obtenerCatalogoStaffStorage === 'function' ? obtenerCatalogoStaffStorage() : [];
    const producto = catalogo.find(p => p.id === pieza.productoId);
    if (!producto || typeof fotoPrincipalProducto !== 'function') return '';
    const f = fotoPrincipalProducto(producto);
    return typeof normalizarImagenApartado === 'function' ? normalizarImagenApartado(f) : f;
  }

  // Piezas del carrito elegidas para Apartar o Pagar. Toda pieza nueva nace
  // elegida; la que la persona desmarca se queda así mientras siga en el
  // carrito. Lo que no se elige se queda en el carrito (hasta fin del día).
  const elegidasCarrito = new Set();
  const vistasCarrito = new Set();

  function renderCarrito() {
    const panel = $('pedidoPanel-carrito');
    if (!panel) return;
    const piezas = typeof piezasCarritoConDisponibilidad === 'function' ? piezasCarritoConDisponibilidad() : [];
    const catalogoUrl = window.location.pathname.includes('/portal/lider/') ? 'lider-catalogo' : 'emprendedora-catalogo';
    if (!piezas.length) {
      panel.innerHTML = `
        <div class="carrito-vacio">
          <p><strong>Tu carrito está vacío.</strong></p>
          <p>Elige piezas en el catálogo; cuando termines, aquí escoges si las apartas o las pagas.</p>
          <a class="btn btn-primary" href="${catalogoUrl}">Ir al catálogo</a>
        </div>`;
      return;
    }
    const disponibles = piezas.filter(p => p.disponible);
    disponibles.forEach(p => { if (!vistasCarrito.has(p.id)) { vistasCarrito.add(p.id); elegidasCarrito.add(p.id); } });
    [...elegidasCarrito].forEach(id => { if (!disponibles.some(p => p.id === id)) elegidasCarrito.delete(id); });
    [...vistasCarrito].forEach(id => { if (!piezas.some(p => p.id === id)) vistasCarrito.delete(id); });
    const elegidas = disponibles.filter(p => elegidasCarrito.has(p.id));
    const todas = disponibles.length > 0 && elegidas.length === disponibles.length;
    const subtotal = elegidas.reduce((s, p) => s + Number(p.total || 0), 0);
    const envio = calcularEnvioPedido(categoria(), subtotal);
    panel.innerHTML = `
      <p class="carrito-aviso">Estas piezas <strong>todavía no están guardadas</strong>: otra persona podría ganártelas. Apártalas o págalas para asegurarlas. Tu carrito se vacía al terminar el día.</p>
      ${disponibles.length > 1 ? `<label class="carrito-todas"><input type="checkbox" id="carritoTodas" ${todas ? 'checked' : ''}> Seleccionar todas (${disponibles.length})</label>` : ''}
      <ul class="carrito-lista">
        ${piezas.map(p => {
          const foto = fotoPieza(p);
          const marcada = p.disponible && elegidasCarrito.has(p.id);
          return `
          <li class="carrito-pieza ${p.disponible ? '' : 'no-disponible'}${marcada ? ' elegida' : ''}" ${p.disponible ? `data-elegir-carrito="${esc(p.id)}"` : ''}>
            ${p.disponible ? `<input type="checkbox" class="carrito-check" data-check-carrito="${esc(p.id)}" ${marcada ? 'checked' : ''} aria-label="Elegir ${esc(p.producto)}">` : '<span class="carrito-check-vacio"></span>'}
            <span class="carrito-foto">${foto ? `<img src="${esc(foto)}" alt="">` : ''}</span>
            <span class="carrito-datos">
              <strong>${esc(p.producto)}</strong>
              <small>${esc([p.colorOro, p.variante && p.variante !== 'Única' ? p.variante : ''].filter(Boolean).join(' · '))}</small>
              ${p.disponible ? `<span class="carrito-precio">${pesos(p.total)}</span>` : '<span class="carrito-agotada">Ya no está disponible</span>'}
            </span>
            <button type="button" class="carrito-quitar" data-quitar-carrito="${esc(p.id)}" aria-label="Quitar ${esc(p.producto)} del carrito">Quitar</button>
          </li>`;
        }).join('')}
      </ul>
      <div class="carrito-totales">
        <div><span>${elegidas.length} de ${disponibles.length} pieza${disponibles.length === 1 ? '' : 's'} elegida${elegidas.length === 1 ? '' : 's'}</span><strong>${pesos(subtotal)}</strong></div>
        ${envio.aplica ? `<div class="carrito-envio"><span>Envío si pagas</span><span>${envio.gratis ? 'Gratis' : envio.sinConfigurar ? 'El equipo te confirma el costo' : pesos(envio.envio)}</span></div>` : ''}
        ${envio.aplica && !envio.gratis ? `<p class="carrito-nota">Tu envío sale gratis desde ${pesos(envioGratisDesde())} de compra.</p>` : ''}
      </div>
      <div class="carrito-acciones">
        <button type="button" class="btn btn-outline" id="carritoApartarBtn" ${elegidas.length ? '' : 'disabled'}>Apartar${elegidas.length && elegidas.length < disponibles.length ? ` ${elegidas.length}` : ''}</button>
        <button type="button" class="btn btn-primary" id="carritoPagarBtn" ${elegidas.length ? '' : 'disabled'}>Pagar ${pesos(subtotal + envio.envio)}</button>
      </div>
      ${elegidas.length && elegidas.length < disponibles.length ? `<p class="carrito-nota">${disponibles.length - elegidas.length === 1 ? 'La pieza que no elegiste se queda' : `Las ${disponibles.length - elegidas.length} piezas que no elegiste se quedan`} en tu carrito.</p>` : ''}
      ${!elegidas.length && disponibles.length ? '<p class="carrito-nota">Elige las piezas que quieres apartar o pagar.</p>' : ''}
      <p class="carrito-nota carrito-explica"><strong>Apartar:</strong> se guardan con tu depósito y tienes tu plazo de siempre para pagarlas. <strong>Pagar:</strong> transfieres hoy el total, subes tu comprobante y el equipo prepara tu pedido.</p>`;
    panel.querySelectorAll('[data-quitar-carrito]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); quitarDelCarrito(b.dataset.quitarCarrito); }));
    // Tocar el renglón (foto, nombre o casilla) elige o quita la pieza.
    panel.querySelectorAll('[data-elegir-carrito]').forEach(li => li.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      const id = li.dataset.elegirCarrito;
      if (elegidasCarrito.has(id)) elegidasCarrito.delete(id); else elegidasCarrito.add(id);
      renderCarrito();
    }));
    $('carritoTodas')?.addEventListener('change', e => {
      if (e.target.checked) disponibles.forEach(p => elegidasCarrito.add(p.id)); else elegidasCarrito.clear();
      renderCarrito();
    });
    $('carritoApartarBtn')?.addEventListener('click', () => apartarCarrito(elegidas));
    $('carritoPagarBtn')?.addEventListener('click', () => abrirPagoCarrito(elegidas));
  }

  function abrirModal(html) {
    const overlay = $('modalOverlay');
    const box = $('modalBox');
    box.innerHTML = `<button class="modal-close" data-close aria-label="Cerrar">&times;</button>${html}`;
    overlay.classList.add('open');
    box.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', () => {
      navigator.clipboard?.writeText(btn.getAttribute('data-copy')).catch(() => {});
      const o = btn.textContent; btn.textContent = 'Copiado'; setTimeout(() => { btn.textContent = o; }, 1500);
    }));
    return box;
  }

  function datosBancariosHTML(concepto) {
    const d = typeof DATOS_BANCARIOS_EJEMPLO !== 'undefined' ? DATOS_BANCARIOS_EJEMPLO : { banco: '', titular: '', clabe: '' };
    return `
      <div class="bank-details-box">
        <div class="copy-field"><span><span class="cf-label">Banco</span><span class="cf-value">${esc(d.banco)}</span></span></div>
        <div class="copy-field"><span><span class="cf-label">Titular</span><span class="cf-value">${esc(d.titular)}</span></span></div>
        <div class="copy-field"><span><span class="cf-label">CLABE</span><span class="cf-value">${esc(d.clabe)}</span></span><button data-copy="${esc(d.clabe)}">Copiar</button></div>
        <div class="copy-field"><span><span class="cf-label">Concepto</span><span class="cf-value">${esc(concepto)}</span></span></div>
      </div>`;
  }

  function exito(titulo, texto, tabDespues) {
    const box = abrirModal(`
      <div class="confirm-box">
        <div class="check-circle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></div>
        <h3>${titulo}</h3>
        <p class="modal-sub">${texto}</p>
        <button class="btn btn-primary" style="width:100%;" data-close>Listo</button>
      </div>`);
    if (tabDespues) elegirTab(tabDespues);
    return box;
  }

  // ---------------- Apartar ----------------
  async function apartarCarrito(piezas) {
    if (enviando || !piezas.length) return;
    const usuarioId = typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : '';
    if (!usuarioId) { mostrarToast('No se pudo identificar tu cuenta — vuelve a iniciar sesión.'); return; }
    enviando = true;
    const boton = $('carritoApartarBtn');
    if (boton) { boton.disabled = true; boton.textContent = 'Apartando…'; }
    try {
      const ventanas = obtenerVentanasApartado();
      let ventana = buscarVentanaParaApartar(ventanas, usuarioId);
      let nueva = false;
      if (!ventana) {
        cerrarVentanasVencidasSinPiezas(ventanas, usuarioId, null);
        const p = persona();
        ventana = abrirVentanaApartado({ usuarioId, usuarioNombre: nombrePropio(), telefono: p?.telefono || '', categoria: p?.categoria || 'normal' }, null);
        nueva = true;
      }
      const apartadas = [];
      const fallas = [];
      for (const pieza of piezas) {
        const r = await agregarPiezaAVentana(ventana, {
          producto: pieza.producto, variante: pieza.variante, colorOro: pieza.colorOro || '', total: pieza.total,
          productoId: pieza.productoId, varianteId: pieza.varianteId, precioEtiqueta: pieza.precioEtiqueta
        }, null);
        if (r.ok) apartadas.push(pieza); else fallas.push(pieza);
      }
      if (!apartadas.length) { mostrarToast('Ya no hay existencia de esas piezas. Quítalas de tu carrito.'); return; }
      const todas = obtenerVentanasApartado();
      guardarVentanasApartado(nueva ? [...todas, ventana] : todas.map(v => (v.id === ventana.id ? ventana : v)));
      await quitarDelCarrito(apartadas.map(p => p.id));
      const nombre = nombrePropio();
      if (typeof notificarEquipoOperativo === 'function') {
        notificarEquipoOperativo(`${nombre} apartó ${apartadas.length} pieza${apartadas.length === 1 ? '' : 's'}: ${apartadas.map(p => p.producto).slice(0, 4).join(', ')}${apartadas.length > 4 ? '…' : ''}.`, nombre);
      }
      const noPudo = fallas.length ? ` ${fallas.length === 1 ? 'Una pieza ya no estaba disponible y se quedó' : `${fallas.length} piezas ya no estaban disponibles y se quedaron`} en tu carrito.` : '';
      if (ventana.estado === 'activa') {
        exito('¡Piezas apartadas!', `Se agregaron a tu apartado activo — no necesitas volver a depositar.${noPudo}`, 'apartado');
      } else {
        pedirDeposito(ventana, noPudo);
      }
    } finally {
      enviando = false;
      renderTodo();
    }
  }

  function pedirDeposito(ventana, extra) {
    const monto = depositoFaltanteVentana(ventana);
    const credito = Number(ventana.depositoApartadoDisponible || 0);
    const mensajeWa = encodeURIComponent('¡Hola! Te envío mi comprobante de depósito');
    const box = abrirModal(`
      <h3>Deposita ${pesos(monto)} para asegurar tus piezas</h3>
      <p class="modal-sub">Tus piezas ya quedaron apartadas${credito > 0 ? ` (ya se aplicaron ${pesos(credito)} de tu crédito anterior)` : ''}. Mientras no se confirme tu depósito no están garantizadas.${esc(extra || '')}</p>
      ${datosBancariosHTML('Tu nombre completo')}
      <p class="whatsapp-note">Manda tu comprobante a este WhatsApp:<br><a href="https://wa.me/524448100805?text=${mensajeWa}" target="_blank" rel="noopener">444 810 0805</a></p>
      <button class="btn btn-primary" style="width:100%;" id="yaDepositeBtn">Ya pagué mi depósito</button>`);
    elegirTab('apartado');
    box.querySelector('#yaDepositeBtn').addEventListener('click', () => {
      if (typeof notificarEquipoOperativo === 'function') notificarEquipoOperativo(`${nombrePropio()} avisó que ya pagó su depósito de ${pesos(monto)} — confirma el depósito para abrir su ventana.`, nombrePropio());
      exito('¡Listo!', 'Ya se avisó al equipo; en breve confirman tu depósito.');
    });
  }

  // ---------------- Pagar ----------------
  function formularioComprobante(idPrefijo) {
    return `
      <div class="comprobante-campos">
        <label class="comprobante-foto" for="${idPrefijo}Foto">
          <input type="file" id="${idPrefijo}Foto" accept="image/*">
          <span class="comprobante-foto-vista" id="${idPrefijo}Vista">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 7h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
            <span>Subir foto o captura de tu comprobante</span>
          </span>
        </label>
        <label class="comprobante-ref">Número de referencia o rastreo (opcional)
          <input type="text" id="${idPrefijo}Ref" maxlength="60" autocomplete="off" placeholder="Ej. 0123456789">
        </label>
        <p class="error-comprobante" id="${idPrefijo}Error" hidden></p>
      </div>`;
  }

  function conectarFoto(box, idPrefijo, alCambiar) {
    const input = box.querySelector(`#${idPrefijo}Foto`);
    const vista = box.querySelector(`#${idPrefijo}Vista`);
    const error = box.querySelector(`#${idPrefijo}Error`);
    input.addEventListener('change', async () => {
      error.hidden = true;
      try {
        const url = await prepararFotoComprobante(input.files[0]);
        vista.innerHTML = `<img src="${url}" alt="Tu comprobante"><span>Cambiar foto</span>`;
        alCambiar(url);
      } catch (e) {
        error.textContent = e.message; error.hidden = false; alCambiar('');
      }
    });
  }

  function abrirPagoCarrito(piezas) {
    if (!piezas.length) return;
    if (enviando) return;
    enviando = true;
    const boton = $('carritoPagarBtn');
    if (boton) { boton.disabled = true; boton.textContent = 'Reservando…'; }
    (async () => {
      const r = await crearPedidoPagado({ piezas });
      enviando = false;
      if (!r.ok) {
        mostrarToast(r.error);
        renderTodo();
        return;
      }
      exito(
        '¡Piezas reservadas!',
        'Tus piezas pasaron a Pagados. Aún no están guardadas en la bolsita: espera a que el equipo confirme todas las piezas. Cuando estén listas, te aparecerá automáticamente el monto y los datos para pagar.',
        'pagados'
      );
      renderTodo();
    })();
  }

  // ---------------- Pagados ----------------
  const PASOS_VISIBLES = {
    normal: ['esperando_bolsita', 'pago_disponible', 'por_confirmar', 'confirmado', 'en_bolsita', 'entregado'],
    foranea: ['esperando_bolsita', 'pago_disponible', 'por_confirmar', 'confirmado', 'empaquetado', 'enviado', 'entregado']
  };
  const NOMBRE_PASO = { esperando_bolsita: 'Esperando confirmación en bolsita', pago_disponible: 'Listo para pagar', por_confirmar: 'Pago enviado', confirmado: 'Pago confirmado', en_bolsita: 'En tu bolsita (caja de pagados)', empaquetado: 'Empaquetado', enviado: 'Enviado', entregado: 'Entregado' };

  function lineaTiempo(p) {
    const pasos = PASOS_VISIBLES[p.categoria === 'foranea' ? 'foranea' : 'normal'];
    const estado = p.estado === 'rechazado' ? 'por_confirmar' : p.estado;
    const i = pasos.indexOf(estado);
    return `<ol class="pedido-pasos">${pasos.map((paso, k) => `<li class="${k < i ? 'hecho' : k === i ? 'actual' : ''}">${NOMBRE_PASO[paso]}</li>`).join('')}</ol>`;
  }

  // Debajo de cada pieza: si ya está guardada en su bolsita (o empaquetada,
  // enviada, entregada) según en qué va el pedido.
  function estadoPiezaPagada(p) {
    const foranea = p.categoria === 'foranea';
    switch (p.estado) {
      case 'esperando_bolsita': return { texto: 'Aún no están confirmadas en tu bolsita. Espera a que el equipo confirme todas las piezas.', ok: false };
      case 'pago_disponible': return { texto: '✓ Todas están confirmadas en tu bolsita. Ya puedes pagar.', ok: true };
      case 'por_confirmar': return { texto: 'Separada para ti. Se guarda en tu bolsita en cuanto se confirme tu pago.', ok: false };
      case 'rechazado': return { texto: 'Separada para ti. Sube otro comprobante para que se guarde en tu bolsita.', ok: false };
      case 'confirmado': return foranea ? { texto: 'Pago confirmado. El equipo está preparando tu paquete.', ok: false } : { texto: 'Pago confirmado. El equipo la está guardando en tu bolsita.', ok: false };
      case 'en_bolsita': return { texto: '✓ Ya está guardada en tu bolsita (caja de pagados).', ok: true };
      case 'empaquetado': return { texto: '✓ Ya está empaquetada para envío.', ok: true };
      case 'enviado': return { texto: '✓ Ya va en camino.', ok: true };
      case 'entregado': return { texto: '✓ Entregada.', ok: true };
      default: return null;
    }
  }

  function renderPagados() {
    const panel = $('pedidoPanel-pagados');
    if (!panel) return;
    const pedidos = typeof obtenerPedidosPagados === 'function' ? obtenerPedidosPagados() : [];
    if (!pedidos.length) {
      panel.innerHTML = '<div class="carrito-vacio"><p><strong>Aún no tienes pedidos pagados.</strong></p><p>Cuando pagues tu carrito o liquides un apartado, aquí ves en qué va.</p></div>';
      return;
    }
    panel.innerHTML = `<ul class="pagados-lista">${pedidos.map(p => {
      const info = ESTADOS_PEDIDO_PAGADO[p.estado] || { texto: p.estado, clase: '' };
      const rechazado = p.estado === 'rechazado';
      const estado = estadoPiezaPagada(p);
      return `
      <li class="pagado-tarjeta">
        <div class="pagado-cabeza">
          <div>
            <strong>${p.piezas.length} pieza${p.piezas.length === 1 ? '' : 's'} · ${pesos(p.total)}</strong>
            <small>${new Date(p.creadoEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}${p.origen === 'apartado' ? ' · de tu apartado' : ''}${p.venta ? ` · Ticket ${esc(p.venta.folio)}` : ''}</small>
          </div>
          <span class="status ${info.clase}">${esc(info.texto)}</span>
        </div>
        ${['vencido', 'cancelado'].includes(p.estado) ? '' : lineaTiempo(p)}
        ${rechazado ? `<div class="pagado-rechazo"><strong>No se pudo validar tu comprobante:</strong> ${esc(p.rechazo?.motivo || '')}<br>Sube otro hoy antes de las 11:59 p.m.; si no, tus piezas regresan al catálogo.<button type="button" class="btn btn-primary" data-reenviar="${esc(p.id)}">Subir otro comprobante</button></div>` : ''}
        ${p.estado === 'pago_disponible' ? `<button type="button" class="btn btn-primary" data-pago-disponible="${esc(p.id)}">Ver datos y pagar ${pesos(p.total)}</button>` : ''}
        ${p.envioInfo ? `<p class="pagado-guia">Guía ${esc(p.envioInfo.paqueteria)} <strong>${esc(p.envioInfo.guia)}</strong></p>` : ''}
        <details class="pagado-piezas"${['vencido', 'cancelado', 'entregado'].includes(p.estado) ? '' : ' open'}><summary>Piezas</summary><ul>${p.piezas.map(x => `<li><span>${esc(x.producto)}${x.variante && x.variante !== 'Única' ? ` · ${esc(x.variante)}` : ''}${estado ? `<small class="pagado-pieza-estado${estado.ok ? ' pagado-pieza-estado--ok' : ''}">${esc(estado.texto)}</small>` : ''}</span><span>${pesos(x.total)}</span></li>`).join('')}${Number(p.envio) > 0 ? `<li><span>Envío</span><span>${pesos(p.envio)}</span></li>` : ''}</ul></details>
      </li>`;
    }).join('')}</ul>`;
    panel.querySelectorAll('[data-pago-disponible]').forEach(b => b.addEventListener('click', () => {
      const p = pedidos.find(x => x.id === b.dataset.pagoDisponible);
      if (p && p.estado === 'pago_disponible') abrirModalPagoDisponiblePedido(p);
    }));
    panel.querySelectorAll('[data-reenviar]').forEach(b => b.addEventListener('click', () => {
      const p = pedidos.find(x => x.id === b.dataset.reenviar);
      if (p) abrirReenvio(p);
    }));
  }

  function abrirReenvio(pedido) {
    let foto = '';
    const box = abrirModal(`
      <h3>Subir otro comprobante</h3>
      <p class="modal-sub">Total: <strong>${pesos(pedido.total)}</strong>. Motivo del rechazo: ${esc(pedido.rechazo?.motivo || '')}</p>
      ${datosBancariosHTML(pedido.personaNombre || 'Tu nombre completo')}
      ${formularioComprobante('re')}
      <button class="btn btn-primary" style="width:100%;" id="reenviarBtn" disabled>Enviar comprobante</button>`);
    const enviar = box.querySelector('#reenviarBtn');
    conectarFoto(box, 're', (url) => { foto = url; enviar.disabled = !url; });
    enviar.addEventListener('click', async () => {
      if (!foto) return;
      enviar.disabled = true; enviar.textContent = 'Enviando…';
      const r = await reenviarComprobantePedido(pedido, { fotoUrl: foto, referencia: box.querySelector('#reRef').value });
      if (!r.ok) {
        const err = box.querySelector('#reError'); err.textContent = r.error; err.hidden = false;
        enviar.disabled = false; enviar.textContent = 'Enviar comprobante';
        return;
      }
      exito('¡Comprobante enviado!', 'El equipo lo revisa y te avisa en cuanto confirme tu pago.');
    });
  }

  function renderTodo() {
    renderCarrito();
    renderPagados();
    contarTabs();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const tabs = document.querySelector('.pedido-tabs');
    if (!tabs) return;
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pedido-tab]');
      if (b) elegirTab(b.dataset.pedidoTab);
    });
    tabs.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const i = TABS.indexOf(tabActual);
      elegirTab(TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length], true);
    });
    const deHash = TABS.find(t => window.location.hash === '#' + t);
    elegirTab(deHash || 'carrito');
    if (typeof apartadosRepoListo !== 'undefined') await apartadosRepoListo;
    if (typeof catalogoRepoListo !== 'undefined') await catalogoRepoListo;
    await carritoRepoListo;
    await pedidosPagadosRepoListo;
    renderTodo();
    // Sin nada en el carrito, abre donde haya algo.
    if (!deHash && !obtenerCarrito().length) {
      const hayApartado = typeof obtenerVentanaActivaPrincipal === 'function' && obtenerVentanaActivaPrincipal();
      const hayPagados = obtenerPedidosPagados().some(p => !ESTADOS_PEDIDO_TERMINADOS.includes(p.estado));
      elegirTab(hayPagados && !hayApartado ? 'pagados' : hayApartado ? 'apartado' : 'carrito');
    }
    window.addEventListener('mw:carrito-actualizado', renderTodo);
    window.addEventListener('mw:apartados-actualizados', () => {
      if (typeof renderApartados === 'function') renderApartados();
      renderTodo();
    });
    window.addEventListener('mw:pedidos-pagados-actualizados', renderTodo);
    window.addEventListener('mw:catalogo-actualizado', renderCarrito);
  });
})();
