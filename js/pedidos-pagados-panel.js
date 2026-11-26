// MW JOYERÍA — Pedidos → Pagados (Staff / Encargado / Admin)
//
// La pestaña "Pagados" de Pedidos: lo que las e/l pagaron por
// transferencia desde su carrito y los apartados ya liquidados. Mismo
// flujo que BRILLO (src/vistas/Pagados.tsx):
//   Por confirmar → [Confirmar pago | Rechazar]
//   Confirmado → normal: Guardar en bolsita (caja de pagados) → Ya se entregó
//                foránea: Empaquetar → Marcar enviado (guía) → Entregado
// Confirmar pago registra la venta en la "Caja en línea" de BRILLO, por
// eso solo lo hacen Encargado y Administración (igual que cobrar).
// Datos y acciones: js/pedidos-modelo.js.

(function () {
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pesos = n => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
  const FILTROS = {
    activos: { texto: 'En curso', f: p => !ESTADOS_PEDIDO_TERMINADOS.includes(p.estado) },
    esperando_bolsita: { texto: 'Esperando bolsita', f: p => p.estado === 'esperando_bolsita' },
    pago_disponible: { texto: 'Listo para pagar', f: p => p.estado === 'pago_disponible' },
    por_confirmar: { texto: 'Por confirmar pago', f: p => p.estado === 'por_confirmar' || p.estado === 'rechazado' },
    por_preparar: { texto: 'Por preparar', f: p => p.estado === 'confirmado' || p.estado === 'empaquetado' },
    en_bolsita: { texto: 'En caja de pagados', f: p => p.estado === 'en_bolsita' },
    enviado: { texto: 'Enviados', f: p => p.estado === 'enviado' },
    entregado: { texto: 'Entregados', f: p => p.estado === 'entregado' },
    todos: { texto: 'Todos', f: () => true }
  };
  let filtro = 'activos';
  let busqueda = '';

  function cuenta(f) { return obtenerPedidosPagados().filter(f).length; }

  function elegirTab(tab) {
    document.querySelectorAll('[data-sea-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.seaTab === tab)));
    $('seaPanel-apartados').hidden = tab !== 'apartados';
    $('seaPanel-pagados').hidden = tab !== 'pagados';
    try {
      const u = new URL(window.location.href);
      if (tab === 'pagados') u.searchParams.set('pagados', '1'); else u.searchParams.delete('pagados');
      history.replaceState(null, '', u);
    } catch (e) { /* noop */ }
  }

  function render() {
    const panel = $('seaPanel-pagados');
    if (!panel) return;
    const num = document.querySelector('[data-sea-tab="pagados"] .pestana-num');
    const pendientes = cuenta(p => p.estado === 'por_confirmar');
    if (num) { num.textContent = pendientes; num.hidden = !pendientes; }

    const q = busqueda.trim().toLowerCase();
    const lista = obtenerPedidosPagados()
      .filter(FILTROS[filtro].f)
      .filter(p => !q || [p.personaNombre, p.usuario, p.id, ...(p.piezas || []).map(x => x.producto)].join(' ').toLowerCase().includes(q))
      .sort((a, b) => {
        const prioridad = Number(b.estado === 'esperando_bolsita') - Number(a.estado === 'esperando_bolsita');
        if (prioridad) return prioridad;
        const ordenFecha = String(b.creadoEn || '').localeCompare(String(a.creadoEn || ''));
        return a.estado === 'esperando_bolsita' ? -ordenFecha : ordenFecha;
      });
    const pendientesBolsita = cuenta(p => p.estado === 'esperando_bolsita');

    const resumen = [
      ['Esperando bolsita', cuenta(p => p.estado === 'esperando_bolsita'), 'esperando_bolsita'],
      ['Listo para pagar', cuenta(p => p.estado === 'pago_disponible'), 'pago_disponible'],
      ['Por confirmar pago', cuenta(p => p.estado === 'por_confirmar'), 'por_confirmar'],
      ['Por preparar', cuenta(p => p.estado === 'confirmado' || p.estado === 'empaquetado'), 'por_preparar'],
      ['En caja de pagados', cuenta(p => p.estado === 'en_bolsita'), 'en_bolsita'],
      ['Enviados', cuenta(p => p.estado === 'enviado'), 'enviado']
    ];
    panel.innerHTML = `
      <section class="stat-cards pagados-resumen">
        ${resumen.map(([t, n, f]) => `<button type="button" class="stat-card pagados-stat ${filtro === f ? 'activo' : ''}" data-filtro-rapido="${f}"><span><small>${t}</small><strong class="stat-num">${n}</strong></span></button>`).join('')}
      </section>
      <div class="section-head"><h2>Pedidos pagados</h2></div>
      ${pendientesBolsita ? `<p class="pagados-nota"><strong>Prioridad:</strong> hay ${pendientesBolsita} pedido${pendientesBolsita === 1 ? '' : 's'} esperando confirmación en bolsita. Estas reservas no vencen; confirma todas sus piezas lo antes posible.</p>` : ''}
      <div class="toolbar">
        <select class="filter-select" id="pagadosFiltro">${Object.entries(FILTROS).map(([k, v]) => `<option value="${k}" ${k === filtro ? 'selected' : ''}>${v.texto}</option>`).join('')}</select>
        <input class="search" id="pagadosBuscar" type="search" placeholder="Buscar por nombre, pieza o folio..." value="${esc(busqueda)}">
      </div>
      ${lista.length ? `<ul class="pagados-lista pagados-equipo">${lista.map(tarjeta).join('')}</ul>` : '<p class="pagados-vacio">No hay pedidos pagados con este filtro.</p>'}
      ${puedeConfirmarPagos() ? '' : '<p class="pagados-nota">Confirmar un pago registra la venta en la Caja en línea de BRILLO: lo hacen Encargado o Administración. Tú puedes preparar, enviar y entregar.</p>'}`;

    panel.querySelector('#pagadosFiltro').addEventListener('change', e => { filtro = e.target.value; render(); });
    const buscar = panel.querySelector('#pagadosBuscar');
    buscar.addEventListener('input', e => { busqueda = e.target.value; render(); const b = $('pagadosBuscar'); b.focus(); b.setSelectionRange(b.value.length, b.value.length); });
    panel.querySelectorAll('[data-filtro-rapido]').forEach(b => b.addEventListener('click', () => { filtro = filtro === b.dataset.filtroRapido ? 'activos' : b.dataset.filtroRapido; render(); }));
    panel.querySelectorAll('[data-pagado-accion]').forEach(b => b.addEventListener('click', () => accion(b.dataset.pagadoId, b.dataset.pagadoAccion)));
  }

  function tarjeta(p) {
    const info = ESTADOS_PEDIDO_PAGADO[p.estado] || { texto: p.estado, clase: '' };
    const foranea = p.categoria === 'foranea';
    const acciones = [];
    if (p.estado === 'esperando_bolsita') {
      acciones.push(`<button type="button" class="action-btn primary-action" data-pagado-accion="confirmar_bolsita" data-pagado-id="${esc(p.id)}">Confirmar todas en bolsita</button>`);
    }
    if (p.estado === 'por_confirmar') {
      acciones.push(`<button type="button" class="action-btn primary-action" data-pagado-accion="confirmar" data-pagado-id="${esc(p.id)}" ${puedeConfirmarPagos() ? '' : 'disabled title="Lo confirma Encargado o Administración"'}>Revisar y confirmar pago</button>`);
      acciones.push(`<button type="button" class="action-btn danger-action" data-pagado-accion="rechazar" data-pagado-id="${esc(p.id)}">Rechazar comprobante</button>`);
    }
    pasosDisponiblesPedido(p).forEach(paso => {
      acciones.push(`<button type="button" class="action-btn ${paso.estado === 'entregado' ? 'detail-action' : 'primary-action'}" data-pagado-accion="${paso.estado}" data-pagado-id="${esc(p.id)}">${esc(paso.boton)}</button>`);
    });
    if (p.origen === 'carrito' && !['por_confirmar'].includes(p.estado)) {
      acciones.push(`<button type="button" class="action-btn detail-action" data-pagado-accion="ver" data-pagado-id="${esc(p.id)}">Ver comprobante</button>`);
    }
    const fecha = new Date(p.creadoEn).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    return `
      <li class="pagado-tarjeta">
        <div class="pagado-cabeza">
          <div>
            <strong>${esc(p.personaNombre)}</strong>
            <small>${esc(p.usuario || '')}${p.telefono ? ` · ${esc(p.telefono)}` : ''} · ${fecha}</small>
          </div>
          <span class="status ${info.clase}">${esc(info.texto)}</span>
        </div>
        <div class="pagado-etiquetas">
          ${p.estado === 'esperando_bolsita' ? '<span class="badge" style="background:#fff1d6;color:#805600;font-weight:700;">Prioridad · confirmar bolsita</span>' : ''}
          ${foranea ? '<span class="badge">Foránea · envío</span>' : '<span class="badge">Recoge en tienda</span>'}
          <span class="badge">${p.origen === 'apartado' ? 'De su apartado' : 'Pagó su carrito'}</span>
          ${p.venta ? `<span class="badge">Ticket ${esc(p.venta.folio)}</span>` : ''}
        </div>
        <ul class="pagado-piezas-lista">
          ${(p.piezas || []).map(x => `<li><span>${esc(x.producto)}${x.variante && x.variante !== 'Única' ? ` · ${esc(x.variante)}` : ''}</span><span>${pesos(x.total)}</span></li>`).join('')}
          ${Number(p.envio) > 0 ? `<li><span>Envío</span><span>${pesos(p.envio)}</span></li>` : ''}
          ${p.envioPorConfirmar ? '<li><span>Envío</span><span>Sin costo configurado</span></li>' : ''}
          <li class="pagado-total"><span>Total</span><strong>${pesos(p.total)}</strong></li>
        </ul>
        ${p.comprobante?.referencia ? `<p class="pagado-ref">Referencia: <strong>${esc(p.comprobante.referencia)}</strong></p>` : ''}
        ${p.estado === 'rechazado' ? `<p class="pagado-ref">Rechazado: ${esc(p.rechazo?.motivo || '')}. Puede mandar otro comprobante hoy; si no, las piezas regresan al catálogo.</p>` : ''}
        ${p.envioInfo ? `<p class="pagado-ref">Guía ${esc(p.envioInfo.paqueteria)} <strong>${esc(p.envioInfo.guia)}</strong></p>` : ''}
        ${acciones.length ? `<div class="pagado-acciones">${acciones.join('')}</div>` : ''}
      </li>`;
  }

  function modal(html) {
    const box = $('modalBox');
    box.innerHTML = `<button class="modal-close" data-close aria-label="Cerrar">&times;</button>${html}`;
    $('modalOverlay').classList.add('open');
    box.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', cerrar));
    return box;
  }
  function cerrar() { $('modalOverlay').classList.remove('open'); }
  function toast(t) { if (typeof mostrarToast === 'function') mostrarToast(t); }

  async function accion(id, que) {
    const p = obtenerPedidosPagados().find(x => x.id === id);
    if (!p) return;
    if (que === 'confirmar') return revisarPago(p);
    if (que === 'confirmar_bolsita') {
      const r = await confirmarPiezasEnBolsitaPedido(p);
      toast(r.ok ? 'Todas las piezas quedaron confirmadas en bolsita. Se habilitó el pago.' : r.error);
      return;
    }
    if (que === 'ver') return verComprobante(p);
    if (que === 'rechazar') return rechazar(p);
    if (que === 'enviado') return marcarEnviado(p);
    const r = await avanzarPedidoPagado(p, que);
    toast(r.ok ? (que === 'en_bolsita' ? 'Listo: en su bolsita, en la caja de pagados. Se le avisó.' : que === 'entregado' ? 'Pedido entregado.' : 'Listo.') : r.error);
  }

  async function verComprobante(p) {
    const box = modal(`<h3>Comprobante de ${esc(p.personaNombre)}</h3><div class="comprobante-grande">Cargando…</div>`);
    const url = await leerComprobantePedido(p.id);
    box.querySelector('.comprobante-grande').innerHTML = url ? `<img src="${url}" alt="Comprobante de pago">` : 'No se encontró la foto del comprobante.';
  }

  async function revisarPago(p) {
    const box = modal(`
      <h3>Confirmar pago de ${esc(p.personaNombre)}</h3>
      <p class="modal-sub">Total: <strong>${pesos(p.total)}</strong>${Number(p.envio) > 0 ? ` (incluye envío ${pesos(p.envio)})` : ''} · ${p.piezas.length} pieza${p.piezas.length === 1 ? '' : 's'}</p>
      <div class="comprobante-grande">Cargando comprobante…</div>
      <label class="comprobante-ref">Referencia de la transferencia
        <input type="text" id="confRef" maxlength="60" value="${esc(p.comprobante?.referencia || '')}" placeholder="Para no registrar la misma transferencia dos veces">
      </label>
      <p class="modal-sub">Revisa que el dinero ya esté en la cuenta. Al confirmar se registra la venta en la <strong>Caja en línea</strong> y cuenta como su compra.</p>
      <p class="error-comprobante" id="confError" hidden></p>
      <div class="carrito-paso-botones">
        <button type="button" class="btn btn-outline" data-close>Cancelar</button>
        <button type="button" class="btn btn-primary" id="confBtn">Confirmar pago</button>
      </div>`);
    leerComprobantePedido(p.id).then(url => {
      const c = box.querySelector('.comprobante-grande');
      if (c) c.innerHTML = url ? `<img src="${url}" alt="Comprobante de pago">` : 'No se encontró la foto del comprobante.';
    });
    box.querySelector('#confBtn').addEventListener('click', async (e) => {
      e.target.disabled = true; e.target.textContent = 'Registrando…';
      const r = await confirmarPagoPedido(p, { referencia: box.querySelector('#confRef').value });
      if (!r.ok) { const err = box.querySelector('#confError'); err.textContent = r.error; err.hidden = false; e.target.disabled = false; e.target.textContent = 'Confirmar pago'; return; }
      cerrar();
      toast(`Pago confirmado · venta ${r.venta.folio} en Caja en línea. Se le avisó a ${p.personaNombre}.`);
    });
  }

  function rechazar(p) {
    const box = modal(`
      <h3>Rechazar comprobante</h3>
      <p class="modal-sub">${esc(p.personaNombre)} podrá subir otro hoy antes de las 11:59 p.m.; si no, sus piezas regresan al catálogo.</p>
      <label class="comprobante-ref">Motivo (se lo decimos a ella)
        <input type="text" id="rechMotivo" maxlength="200" placeholder="Ej. No se ve el monto / no ha llegado la transferencia">
      </label>
      <p class="error-comprobante" id="rechError" hidden></p>
      <div class="carrito-paso-botones">
        <button type="button" class="btn btn-outline" data-close>Cancelar</button>
        <button type="button" class="btn btn-primary" id="rechBtn">Rechazar</button>
      </div>`);
    box.querySelector('#rechBtn').addEventListener('click', async (e) => {
      e.target.disabled = true;
      const r = await rechazarPagoPedido(p, box.querySelector('#rechMotivo').value);
      if (!r.ok) { const err = box.querySelector('#rechError'); err.textContent = r.error; err.hidden = false; e.target.disabled = false; return; }
      cerrar(); toast('Comprobante rechazado. Se le avisó.');
    });
  }

  function marcarEnviado(p) {
    const box = modal(`
      <h3>Marcar enviado</h3>
      <label class="comprobante-ref">Paquetería
        <select id="envPaq"><option>Estafeta</option><option>FedEx</option><option>Otra</option></select>
      </label>
      <label class="comprobante-ref">Número de guía
        <input type="text" id="envGuia" maxlength="60" autocomplete="off">
      </label>
      <p class="error-comprobante" id="envError" hidden></p>
      <div class="carrito-paso-botones">
        <button type="button" class="btn btn-outline" data-close>Cancelar</button>
        <button type="button" class="btn btn-primary" id="envBtn">Marcar enviado</button>
      </div>`);
    box.querySelector('#envBtn').addEventListener('click', async (e) => {
      e.target.disabled = true;
      const r = await avanzarPedidoPagado(p, 'enviado', { paqueteria: box.querySelector('#envPaq').value, guia: box.querySelector('#envGuia').value });
      if (!r.ok) { const err = box.querySelector('#envError'); err.textContent = r.error; err.hidden = false; e.target.disabled = false; return; }
      cerrar(); toast('Enviado. Se le mandó la guía.');
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const tabs = document.querySelector('.pedidos-sea-tabs');
    if (!tabs) return;
    tabs.addEventListener('click', e => { const b = e.target.closest('[data-sea-tab]'); if (b) elegirTab(b.dataset.seaTab); });
    const params = new URLSearchParams(window.location.search);
    if (params.get('pagados') === '1') {
      elegirTab('pagados');
      if (params.get('buscar')) busqueda = params.get('buscar');
    } else {
      elegirTab('apartados');
    }
    await pedidosPagadosRepoListo;
    render();
    window.addEventListener('mw:pedidos-pagados-actualizados', () => {
      // No repintar mientras escribe en el buscador (perdería el foco).
      if (document.activeElement && document.activeElement.id === 'pagadosBuscar') return render();
      render();
    });
  });
})();
