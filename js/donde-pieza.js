// MW JOYERÍA — "¿Dónde está la pieza?" (catálogo de Staff, Encargado y Admin)
// ===========================================================================
// Se escribe (o se escanea) el código o el nombre de una pieza y muestra:
// cuántas hay disponibles en el local (existencia del catálogo, por
// variante), quién la tiene apartada y cuántas (y si ya está en su
// bolsita), y quién la tuvo apartada y se le quitó en los últimos 60 días
// (para descancelarla si volvió a llegar, desde Apartados).
//
// Los apartados se cargan solo al abrir este modal (no al abrir el
// catálogo), para no gastar lecturas de Firestore en cada visita.
(function () {
  const DIAS_QUITADAS = 60;
  let cargaApartados = null;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normal = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const fechaCorta = iso => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '');

  function cargarScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(src));
      document.head.appendChild(s);
    });
  }

  // Admin ya trae los apartados en su catálogo; Staff y Encargado no.
  function asegurarApartados() {
    if (!cargaApartados) {
      cargaApartados = (async () => {
        if (typeof obtenerVentanasApartado !== 'function') {
          await cargarScript('../../js/apartados-firestore-sync.js?v=6');
          await cargarScript('../../js/apartados-modelo.js?v=17');
        }
        // eslint-disable-next-line no-undef
        if (typeof apartadosRepoListo !== 'undefined') await apartadosRepoListo;
        return true;
      })().catch(e => { cargaApartados = null; throw e; });
    }
    return cargaApartados;
  }

  function catalogo() {
    return typeof obtenerCatalogoStaffStorage === 'function' ? obtenerCatalogoStaffStorage() : [];
  }

  function buscarProductos(texto) {
    const t = normal(texto);
    if (!t) return [];
    const lista = catalogo();
    const exactos = lista.filter(p => normal(p.codigo) === t);
    if (exactos.length) return exactos;
    return lista.filter(p => normal(`${p.nombre} ${p.codigo}`).includes(t)).slice(0, 8);
  }

  function estadoVentanaTexto(v) {
    if (v.estado === 'pendiente_deposito') return { texto: 'Pendiente de depósito', clase: 'pendiente' };
    if (v.estado === 'pendiente_aprobacion') return { texto: 'Pendiente de aprobación VIP', clase: 'pendiente' };
    if (typeof ventanaEstaVencida === 'function' && ventanaEstaVencida(v)) return { texto: 'Vencida — pendiente de gestionar', clase: 'vencida' };
    return { texto: 'Activa', clase: 'activa' };
  }

  function etiquetaDeVariante(producto, varianteId, pieza) {
    const v = (producto.variantes || []).find(x => x.id === varianteId);
    if (v && typeof etiquetaVariante === 'function') return etiquetaVariante(v);
    return pieza?.variante || '';
  }

  function ligaApartados(ventanaId) {
    const ruta = window.location.pathname.replace(/-catalogo\.html$/, '-apartados.html');
    return `${ruta}?ventana=${encodeURIComponent(ventanaId)}`;
  }

  function htmlProducto(p, ventanas) {
    const variantes = p.variantes || [];
    const disponibles = variantes.reduce((s, v) => s + Math.max(0, Number(v.stock) || 0), 0);
    const ahora = Date.now();

    // Apartadas: piezas activas de ventanas abiertas, agrupadas por persona.
    const apartadas = new Map();
    const quitadas = [];
    ventanas.forEach(v => {
      (v.apartados || []).forEach(pieza => {
        if (pieza.productoId !== p.id) return;
        if (pieza.estado === 'activa' && v.estado !== 'cerrada' && v.estado !== 'vencida') {
          const clave = v.id;
          const g = apartadas.get(clave) || { ventana: v, piezas: [] };
          g.piezas.push(pieza);
          apartadas.set(clave, g);
        } else if (pieza.estado === 'cancelada' && pieza.retiro && v.estado !== 'vencida' &&
          ahora - new Date(pieza.retiro.fecha).getTime() <= DIAS_QUITADAS * 86400000) {
          quitadas.push({ ventana: v, pieza });
        }
      });
    });
    const totalApartadas = [...apartadas.values()].reduce((s, g) => s + g.piezas.length, 0);
    const enBolsita = [...apartadas.values()].reduce((s, g) => s + g.piezas.filter(x => x.enBolsita).length, 0);

    const porVariante = variantes.length > 1
      ? `<ul class="donde-variantes">${variantes.map(v => `<li><span>${esc(typeof etiquetaVariante === 'function' ? etiquetaVariante(v) : v.color || v.talla || 'Variante')}</span><strong>${Math.max(0, Number(v.stock) || 0)}</strong></li>`).join('')}</ul>`
      : '';

    const filasApartadas = [...apartadas.values()]
      .sort((a, b) => a.ventana.usuarioNombre.localeCompare(b.ventana.usuarioNombre))
      .map(({ ventana, piezas }) => {
        const est = estadoVentanaTexto(ventana);
        const detalle = [...new Set(piezas.map(x => etiquetaDeVariante(p, x.varianteId, x)).filter(Boolean))].join(', ');
        const bolsita = piezas.filter(x => x.enBolsita).length;
        return `<li>
          <div><strong>${esc(ventana.usuarioNombre)}</strong>
            <small>${piezas.length} pieza${piezas.length === 1 ? '' : 's'}${detalle ? ` · ${esc(detalle)}` : ''}${bolsita ? ` · ${bolsita} en bolsita` : ''}</small></div>
          <div class="donde-acciones"><span class="donde-estado ${est.clase}">${est.texto}</span>
            <a href="${esc(ligaApartados(ventana.id))}">Ver apartado →</a></div>
        </li>`;
      }).join('');

    const filasQuitadas = quitadas
      .sort((a, b) => b.pieza.retiro.fecha.localeCompare(a.pieza.retiro.fecha))
      .map(({ ventana, pieza }) => `<li>
          <div><strong>${esc(ventana.usuarioNombre)}</strong>
            <small>Quitada el ${fechaCorta(pieza.retiro.fecha)} · ${esc(pieza.retiro.motivo)}${etiquetaDeVariante(p, pieza.varianteId, pieza) ? ` · ${esc(etiquetaDeVariante(p, pieza.varianteId, pieza))}` : ''}</small></div>
          <div class="donde-acciones"><a href="${esc(ligaApartados(ventana.id))}">Descancelar en Apartados →</a></div>
        </li>`).join('');

    return `<section class="donde-producto">
      <header><strong>${esc(p.nombre)}</strong><small>${esc(p.codigo || '')}</small></header>
      <div class="donde-numeros">
        <div><span>Disponibles en el local</span><strong>${disponibles}</strong></div>
        <div><span>Apartadas</span><strong>${totalApartadas}</strong>${totalApartadas ? `<small>${enBolsita} en bolsita</small>` : ''}</div>
      </div>
      ${porVariante}
      <h4>Quién la tiene apartada</h4>
      ${filasApartadas ? `<ul class="donde-lista">${filasApartadas}</ul>` : '<p class="donde-vacio">Nadie la tiene apartada.</p>'}
      ${filasQuitadas ? `<h4>Se quitó de un apartado (últimos ${DIAS_QUITADAS} días)</h4>
        <p class="donde-nota">Si volvió a llegar: súmala en el catálogo y descancélala en su apartado.</p>
        <ul class="donde-lista">${filasQuitadas}</ul>` : ''}
    </section>`;
  }

  function abrir() {
    const fondo = document.createElement('div');
    fondo.className = 'donde-fondo';
    fondo.innerHTML = `
      <div class="donde-caja" role="dialog" aria-modal="true" aria-label="¿Dónde está la pieza?">
        <div class="donde-cabeza">
          <h3>¿Dónde está la pieza?</h3>
          <button type="button" class="btn btn-outline donde-cerrar">Cerrar</button>
        </div>
        <form class="donde-busqueda">
          <input type="search" placeholder="Código o nombre de la pieza" aria-label="Código o nombre de la pieza" autocomplete="off">
          <button type="button" class="boton-camara-qr donde-camara" title="Escanear con la cámara" aria-label="Escanear con la cámara"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg></button>
          <button type="submit" class="btn btn-primary">Buscar</button>
        </form>
        <div class="donde-resultados"><p class="donde-vacio">Escribe o escanea el código o el nombre de la pieza.</p></div>
      </div>`;
    document.body.appendChild(fondo);
    const input = fondo.querySelector('input');
    const resultados = fondo.querySelector('.donde-resultados');
    const camara = fondo.querySelector('.donde-camara');
    if (!window.MWEscaner) camara.remove();

    const cerrar = () => { document.removeEventListener('keydown', alTeclear, true); fondo.remove(); };
    function alTeclear(e) {
      // Con el escáner encima, Esc lo cierra a él (ver escaner-qr.js).
      if (e.key !== 'Escape' || document.querySelector('.escaner-qr-fondo')) return;
      e.stopPropagation();
      cerrar();
    }
    document.addEventListener('keydown', alTeclear, true);
    fondo.querySelector('.donde-cerrar').addEventListener('click', cerrar);
    fondo.addEventListener('click', e => { if (e.target === fondo) cerrar(); });

    async function buscar() {
      const texto = input.value;
      const productos = buscarProductos(texto);
      if (!productos.length) {
        resultados.innerHTML = '<p class="donde-vacio">No hay ninguna pieza con ese código o nombre en el catálogo.</p>';
        return;
      }
      resultados.innerHTML = '<p class="donde-vacio">Buscando en los apartados…</p>';
      try {
        await asegurarApartados();
      } catch (_) {
        resultados.innerHTML = '<p class="donde-vacio error">No se pudieron cargar los apartados. Revisa la conexión.</p>';
        return;
      }
      const ventanas = obtenerVentanasApartado();
      resultados.innerHTML = productos.map(p => htmlProducto(p, ventanas)).join('');
    }

    fondo.querySelector('form').addEventListener('submit', e => { e.preventDefault(); buscar(); });
    camara.addEventListener('click', () => window.MWEscaner.abrir({
      titulo: 'Escanear la etiqueta',
      onCodigo: texto => { input.value = window.MWEscaner.limpiarCodigo(texto); buscar(); }
    }));
    input.focus();
    // Empieza a cargar los apartados mientras escriben.
    asegurarApartados().catch(() => {});
  }

  /** Pone el botón "¿Dónde está la pieza?" junto a "Agregar producto". */
  function instalar() {
    const agregar = document.getElementById('agregarProductoBtn');
    if (!agregar || document.getElementById('dondePiezaBtn')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'dondePiezaBtn';
    b.className = 'btn btn-outline donde-boton';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg> ¿Dónde está la pieza?';
    b.addEventListener('click', abrir);
    agregar.parentNode.insertBefore(b, agregar);
  }

  window.MWDondePieza = { abrir, instalar };
})();
