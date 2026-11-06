// MW JOYERÍA — "Compartir por WhatsApp" (catálogo de Staff, Encargado y Admin)
// ===========================================================================
// En lugar de tomar captura de pantalla, el botón de cada pieza arma una
// imagen lista para mandar: la foto de la variante elegida con el isotipo
// blanco en la esquina y, debajo, categoría, color de oro, descripción,
// color/talla y precio etiqueta.
//
// En el celular abre el menú de compartir del teléfono (ahí se elige
// WhatsApp); en la PC descarga la imagen para mandarla por WhatsApp Web.
// La imagen se arma en el navegador: no se sube ni se guarda nada.
//
// Los botones los pone cada catálogo con data-compartir="<id del producto>";
// este archivo los atiende a todos. BRILLO hace la misma imagen en
// src/compartir/imagenPieza.ts; si cambia una, cambia la otra.
(function () {
  const RAIZ = (() => {
    try { return new URL('../', document.currentScript.src).href; } catch (e) { return ''; }
  })();
  const ISOTIPO = RAIZ + 'assets/images/isotipo-blanco.png';
  const ANCHO = 1080;
  const MORADO = '#5E1A8A';
  const MORADO_OSCURO = '#43125F';
  const DORADO = '#C9A227';
  const LILA = '#E4D6F7';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
  const enCelular = () => window.matchMedia?.('(pointer: coarse)').matches && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  function cargarImagen(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.src = src;
    });
  }

  // El PNG del isotipo trae mucho margen transparente: se recorta una vez.
  let isotipo = null;
  function isotipoRecortado() {
    if (!isotipo) {
      isotipo = cargarImagen(ISOTIPO).then(img => {
        const k = 4;
        const w = Math.ceil(img.width / k);
        const h = Math.ceil(img.height / k);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0, w, h);
        const d = x.getImageData(0, 0, w, h).data;
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
          if (d[(y * w + i) * 4 + 3] > 16) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        if (x1 < 0) return { img, sx: 0, sy: 0, sw: img.width, sh: img.height };
        const sx = Math.max(0, (x0 - 1) * k), sy = Math.max(0, (y0 - 1) * k);
        return { img, sx, sy, sw: Math.min(img.width - sx, (x1 - x0 + 3) * k), sh: Math.min(img.height - sy, (y1 - y0 + 3) * k) };
      }).catch(() => null);
    }
    return isotipo;
  }

  async function fuentesListas() {
    try {
      await Promise.all(['600 72px Cinzel', '400 34px Poppins', '500 30px Poppins', '600 24px Poppins'].map(f => document.fonts.load(f)));
    } catch (e) { /* sin fuentes de Google se usan las del sistema */ }
  }

  // Foto (tamaño completo) de la variante; si no tiene, la principal.
  async function fotoDe(producto, variante) {
    const embebidas = typeof fotosEmbebidasProducto === 'function' ? fotosEmbebidasProducto(producto) : [];
    let galeria = embebidas;
    if (!galeria.length && typeof cargarGaleriaProducto === 'function') {
      try { galeria = await cargarGaleriaProducto(producto.id) || []; } catch (e) { galeria = []; }
    }
    const foto = (variante?.fotoId && galeria.find(f => f.id === variante.fotoId)) || galeria[0];
    return foto?.src || '';
  }

  function partirEnLineas(ctx, texto, ancho, maxLineas) {
    const palabras = String(texto || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const lineas = [];
    let actual = '';
    for (const p of palabras) {
      const prueba = actual ? actual + ' ' + p : p;
      if (ctx.measureText(prueba).width <= ancho || !actual) actual = prueba;
      else { lineas.push(actual); actual = p; }
    }
    if (actual) lineas.push(actual);
    if (lineas.length > maxLineas) {
      const cortadas = lineas.slice(0, maxLineas);
      let ultima = cortadas[maxLineas - 1];
      while (ultima && ctx.measureText(ultima + '…').width > ancho) ultima = ultima.slice(0, -1);
      cortadas[maxLineas - 1] = ultima.trimEnd() + '…';
      return cortadas;
    }
    return lineas;
  }

  /** Datos que van en la imagen (los mismos en BRILLO). */
  function datosImagen(producto, variante) {
    return {
      categoria: String(producto.categoria || '').trim(),
      colorOro: String(producto.colorOro || '').trim(),
      descripcion: String(producto.descripcion || '').trim(),
      colorTalla: [variante?.color ? `Color: ${variante.color}` : '', variante?.talla ? `Talla: ${variante.talla}` : ''].filter(Boolean).join('   ·   '),
      precio: MXN.format(Number(producto.precioEtiqueta) || 0) + ' MXN'
    };
  }

  /** Arma la imagen y regresa un canvas. */
  async function crearImagen(producto, variante) {
    const [src, iso] = await Promise.all([fotoDe(producto, variante), isotipoRecortado(), fuentesListas()]);
    const foto = src ? await cargarImagen(src).catch(() => null) : null;
    const d = datosImagen(producto, variante);
    const M = 72; // margen del texto
    const util = ANCHO - M * 2;

    const medir = document.createElement('canvas').getContext('2d');
    medir.font = '400 34px Poppins, sans-serif';
    const lineasDesc = d.descripcion ? partirEnLineas(medir, d.descripcion, util, 4) : [];
    const columnas = [['CATEGORÍA', d.categoria], ['COLOR DE ORO', d.colorOro]].filter(c => c[1]);

    let alto = ANCHO + M;
    if (columnas.length) alto += 34 + 54 + 40;
    if (columnas.length && (lineasDesc.length || d.colorTalla)) alto += 36;
    alto += lineasDesc.length * 50;
    if (d.colorTalla) alto += (lineasDesc.length ? 20 : 0) + 44;
    alto += 40 + 30 + 92 + M - 10;

    const c = document.createElement('canvas');
    c.width = ANCHO;
    c.height = Math.round(alto);
    const x = c.getContext('2d');

    // Foto
    x.fillStyle = '#FCFAF8';
    x.fillRect(0, 0, ANCHO, ANCHO);
    if (foto) {
      const r = foto.width / foto.height;
      const cubrir = r > 0.8 && r < 1.25;
      let w, h;
      if (cubrir ? r > 1 : r < 1) { h = ANCHO; w = ANCHO * r; } else { w = ANCHO; h = ANCHO / r; }
      if (cubrir) { const k = ANCHO / Math.min(w, h); w *= k; h *= k; }
      x.drawImage(foto, (ANCHO - w) / 2, (ANCHO - h) / 2, w, h);
    } else {
      x.fillStyle = '#F1EBFA';
      x.fillRect(0, 0, ANCHO, ANCHO);
      x.fillStyle = MORADO;
      x.font = '500 40px Poppins, sans-serif';
      x.textAlign = 'center';
      x.fillText('Sin foto', ANCHO / 2, ANCHO / 2);
      x.textAlign = 'left';
    }

    // Isotipo blanco en la esquina inferior derecha, con sombra suave.
    if (iso) {
      const h = 150;
      const w = h * (iso.sw / iso.sh);
      x.save();
      x.shadowColor = 'rgba(0, 0, 0, 0.45)';
      x.shadowBlur = 22;
      x.drawImage(iso.img, iso.sx, iso.sy, iso.sw, iso.sh, ANCHO - w - 40, ANCHO - h - 40, w, h);
      x.restore();
    }

    // Franja de datos
    const g = x.createLinearGradient(0, ANCHO, 0, alto);
    g.addColorStop(0, MORADO);
    g.addColorStop(1, MORADO_OSCURO);
    x.fillStyle = g;
    x.fillRect(0, ANCHO, ANCHO, alto - ANCHO);
    x.fillStyle = DORADO;
    x.fillRect(0, ANCHO, ANCHO, 6);

    let y = ANCHO + M;
    x.textBaseline = 'top';
    if (columnas.length) {
      const anchoCol = util / columnas.length;
      columnas.forEach(([titulo, valor], i) => {
        const cx = M + i * anchoCol;
        x.fillStyle = DORADO;
        x.font = '600 24px Poppins, sans-serif';
        x.letterSpacing = '4px';
        x.fillText(titulo, cx, y);
        x.letterSpacing = '0px';
        x.fillStyle = '#FFFFFF';
        x.font = '600 46px Cinzel, Georgia, serif';
        let v = valor;
        while (v.length > 1 && x.measureText(v).width > anchoCol - 24) v = v.slice(0, -1);
        x.fillText(v === valor ? v : v.trimEnd() + '…', cx, y + 34);
      });
      y += 34 + 54 + 40;
      if (lineasDesc.length || d.colorTalla) {
        x.fillStyle = 'rgba(201, 162, 39, 0.55)';
        x.fillRect(M, y - 20, util, 2);
        y += 36;
      }
    }
    if (lineasDesc.length) {
      x.fillStyle = '#FFFFFF';
      x.font = '400 34px Poppins, sans-serif';
      lineasDesc.forEach(l => { x.fillText(l, M, y); y += 50; });
    }
    if (d.colorTalla) {
      if (lineasDesc.length) y += 20;
      x.fillStyle = LILA;
      x.font = '500 30px Poppins, sans-serif';
      x.fillText(d.colorTalla, M, y);
      y += 44;
    }
    y += 40;
    x.fillStyle = DORADO;
    x.font = '600 24px Poppins, sans-serif';
    x.letterSpacing = '4px';
    x.fillText('PRECIO', M, y);
    x.letterSpacing = '0px';
    y += 30;
    x.fillStyle = '#FFFFFF';
    x.font = '700 76px Cinzel, Georgia, serif';
    x.fillText(d.precio, M, y);
    return c;
  }

  const aBlob = c => new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
  const nombreArchivo = (producto, variante) =>
    (['mw', producto.codigo || producto.nombre || 'pieza', variante?.color, variante?.talla].filter(Boolean).join('-')
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'mw-pieza') + '.jpg';

  function descargar(blob, nombre) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  // ---------- Modal: elegir variante, ver la imagen y compartir ----------
  let abierto = null;
  function cerrar() {
    if (!abierto) return;
    if (abierto.url) URL.revokeObjectURL(abierto.url);
    abierto.fondo.remove();
    document.removeEventListener('keydown', abierto.tecla);
    abierto = null;
  }

  function abrir(productoCrudo) {
    cerrar();
    const producto = typeof migrarProductoAVariantes === 'function' ? migrarProductoAVariantes(productoCrudo) : productoCrudo;
    const variantes = Array.isArray(producto.variantes) && producto.variantes.length ? producto.variantes : [null];
    const etiqueta = v => (typeof etiquetaVariante === 'function' ? etiquetaVariante(v) : [v.color, v.talla].filter(Boolean).join(' · ') || 'Única');
    const celular = enCelular();
    const fondo = document.createElement('div');
    fondo.className = 'compartir-fondo';
    fondo.innerHTML = `
      <div class="compartir-caja" role="dialog" aria-modal="true" aria-label="Compartir por WhatsApp">
        <div class="compartir-cabeza">
          <h3>Compartir por WhatsApp</h3>
          <button type="button" class="btn btn-outline" data-cerrar>Cerrar</button>
        </div>
        <p class="compartir-nombre"><strong>${esc(producto.nombre || 'Sin nombre')}</strong>${producto.codigo ? ` · ${esc(producto.codigo)}` : ''}</p>
        ${variantes.length > 1 ? `
          <p class="compartir-ayuda">Elige la variante:</p>
          <div class="compartir-variantes">
            ${variantes.map((v, i) => `<button type="button" class="compartir-variante${i === 0 ? ' activa' : ''}" data-variante="${i}">${esc(etiqueta(v))} <small>${Number(v.stock) || 0} pza</small></button>`).join('')}
          </div>` : ''}
        <div class="compartir-vista"><p class="compartir-ayuda">Preparando la imagen…</p></div>
        <p class="compartir-error" role="alert" hidden></p>
        <div class="compartir-acciones">
          ${celular ? '<button type="button" class="btn btn-outline" data-descargar disabled>Descargar</button>' : ''}
          <button type="button" class="btn btn-primary compartir-principal" data-compartir-ya disabled>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>
            ${celular ? 'Compartir por WhatsApp' : 'Descargar imagen'}
          </button>
        </div>
        ${celular ? '' : '<p class="compartir-ayuda">En la computadora se descarga la imagen: arrástrala al chat de WhatsApp Web.</p>'}
      </div>`;
    document.body.appendChild(fondo);
    const tecla = e => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    abierto = { fondo, tecla, url: null, blob: null, nombre: '' };
    const estado = abierto;

    const vista = fondo.querySelector('.compartir-vista');
    const error = fondo.querySelector('.compartir-error');
    const botones = [...fondo.querySelectorAll('[data-compartir-ya], [data-descargar]')];
    let turno = 0;

    async function preparar(i) {
      const mio = ++turno;
      botones.forEach(b => { b.disabled = true; });
      error.hidden = true;
      vista.innerHTML = '<p class="compartir-ayuda">Preparando la imagen…</p>';
      try {
        const canvas = await crearImagen(producto, variantes[i]);
        const blob = await aBlob(canvas);
        if (mio !== turno || abierto !== estado) return;
        if (!blob) throw new Error('sin imagen');
        if (estado.url) URL.revokeObjectURL(estado.url);
        estado.blob = blob;
        estado.url = URL.createObjectURL(blob);
        estado.nombre = nombreArchivo(producto, variantes[i]);
        vista.innerHTML = `<img src="${estado.url}" alt="Imagen para compartir de ${esc(producto.nombre || 'la pieza')}">`;
        botones.forEach(b => { b.disabled = false; });
      } catch (e) {
        if (mio !== turno) return;
        vista.innerHTML = '';
        error.textContent = 'No se pudo preparar la imagen. Revisa tu conexión e inténtalo de nuevo.';
        error.hidden = false;
      }
    }

    fondo.addEventListener('click', async (e) => {
      if (e.target === fondo || e.target.closest('[data-cerrar]')) { cerrar(); return; }
      const v = e.target.closest('[data-variante]');
      if (v) {
        fondo.querySelectorAll('.compartir-variante').forEach(b => b.classList.toggle('activa', b === v));
        preparar(Number(v.dataset.variante));
        return;
      }
      if (e.target.closest('[data-descargar]') && estado.blob) { descargar(estado.blob, estado.nombre); return; }
      if (e.target.closest('[data-compartir-ya]') && estado.blob) {
        const archivo = new File([estado.blob], estado.nombre, { type: 'image/jpeg' });
        if (celular && navigator.canShare && navigator.canShare({ files: [archivo] })) {
          try { await navigator.share({ files: [archivo] }); } catch (err) {
            if (err && err.name !== 'AbortError') descargar(estado.blob, estado.nombre);
          }
        } else descargar(estado.blob, estado.nombre);
      }
    });
    preparar(0);
  }

  function productoPorId(id) {
    const lista = typeof CATALOGO_CACHE !== 'undefined' && Array.isArray(CATALOGO_CACHE) ? CATALOGO_CACHE : [];
    return lista.find(p => String(p.id) === String(id));
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-compartir]');
    if (!b) return;
    const p = productoPorId(b.dataset.compartir);
    if (p) abrir(p);
  });

  window.MWCompartirPieza = { abrir, crearImagen, datosImagen };
})();
