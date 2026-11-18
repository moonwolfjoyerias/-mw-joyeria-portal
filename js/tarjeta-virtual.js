// MW JOYERÍA — Tarjeta virtual de la Emprendedora/Líder (Mi cuenta)
//
// Sustituye a la tarjeta física: se muestra en el celular (abierta, o como
// captura de pantalla) y en la caja de BRILLO se escanea su QR para elegirla
// como clienta y aplicarle su precio. El QR trae "MWE:" + su usuario
// (p. ej. "MWE:MW0003"); BRILLO lo reconoce en src/pagina/persona.ts.
// El QR lo genera js/vendor/qrcode-generator.js (MIT, Kazuhiko Arase).
(function () {
  const PREFIJO = 'MWE:';
  const RAIZ = (document.currentScript && document.currentScript.src.replace(/js\/tarjeta-virtual\.js.*$/, '')) || '../../';
  const ISOTIPO = RAIZ + 'assets/images/isotipo-blanco.png';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function matrizQR(texto) {
    if (typeof qrcode !== 'function') return null;
    const qr = qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    const n = qr.getModuleCount();
    return { n, oscuro: (r, c) => qr.isDark(r, c) };
  }

  // QR como SVG nítido (se ve bien a cualquier tamaño y en cualquier pantalla).
  function svgQR(texto, etiqueta) {
    const m = matrizQR(texto);
    if (!m) return '';
    const borde = 2;
    const total = m.n + borde * 2;
    let d = '';
    for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) if (m.oscuro(r, c)) d += `M${c + borde},${r + borde}h1v1h-1z`;
    return `<svg viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="${esc(etiqueta)}"><rect width="${total}" height="${total}" fill="#fff"/><path d="${d}" fill="#1d0f2b"/></svg>`;
  }

  function datosPersona() {
    const id = typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null;
    const p = id && typeof obtenerPersonaPorId === 'function' ? obtenerPersonaPorId(id) : null;
    const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
    const usuario = String((p && p.usuario) || (sesion && sesion.usuario) || '').trim().toUpperCase();
    if (!usuario) return null;
    const nombre = p && typeof nombreCompletoPersona === 'function' ? nombreCompletoPersona(p) : ((sesion && sesion.nombre) || '');
    const esLider = p ? p.tipo === 'lider' : window.location.pathname.includes('/portal/lider/');
    return { usuario, nombre, tipo: esLider ? 'Líder MW' : 'Emprendedora MW', baja: !!(p && p.estado === 'baja') };
  }

  function tarjetaHTML(d, grande) {
    return `
      <div class="tarjeta-mw${grande ? ' tarjeta-mw--grande' : ''}">
        <div class="tm-lado">
          <div class="tm-marca"><img src="${ISOTIPO}" alt="" aria-hidden="true"><span>MW JOYERÍA</span></div>
          <div class="tm-datos">
            <span class="tm-tipo">${esc(d.tipo)}</span>
            <strong class="tm-nombre">${esc(d.nombre)}</strong>
            <span class="tm-usuario">${esc(d.usuario)}</span>
          </div>
        </div>
        <div class="tm-qr">${svgQR(PREFIJO + d.usuario, `Código QR de ${d.nombre}`)}</div>
      </div>`;
  }

  function render() {
    const panel = document.getElementById('tarjetaVirtualPanel');
    if (!panel) return;
    const d = datosPersona();
    if (!d) { panel.style.display = 'none'; return; }
    panel.style.display = '';
    panel.innerHTML = `
      <h3><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19"/><path d="M6 15h4"/></svg></span> Mi tarjeta MW</h3>
      <p class="bp-sub">Ya no necesitas tu tarjeta física: en caja muestra este código desde tu celular (abierto aquí o en una captura de pantalla) para que te apliquen tu precio.</p>
      ${d.baja ? '<p class="bp-sub" style="color:#b23b3b;">Tu cuenta está dada de baja: esta tarjeta no se puede usar en caja.</p>' : tarjetaHTML(d, false)}
      ${d.baja ? '' : `<div class="tm-acciones">
        <button type="button" class="btn btn-primary" id="tarjetaVerGrande">Mostrar para escanear</button>
        <button type="button" class="btn btn-outline" id="tarjetaGuardar">Guardar imagen</button>
      </div>`}`;
    if (d.baja) return;
    document.getElementById('tarjetaVerGrande').addEventListener('click', () => verGrande(d));
    document.getElementById('tarjetaGuardar').addEventListener('click', () => guardarImagen(d));
  }

  // Pantalla completa, fondo claro y QR grande: lo más fácil de leer para el escáner.
  function verGrande(d) {
    const capa = document.createElement('div');
    capa.className = 'tarjeta-mw-capa';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-label', 'Mi tarjeta MW');
    capa.innerHTML = `
      <button type="button" class="tm-cerrar" aria-label="Cerrar">×</button>
      ${tarjetaHTML(d, true)}
      <p class="tm-ayuda">Sube el brillo de tu pantalla y acércalo al escáner.</p>`;
    const cerrar = () => { capa.remove(); document.removeEventListener('keydown', alTeclear); };
    const alTeclear = e => { if (e.key === 'Escape') cerrar(); };
    capa.querySelector('.tm-cerrar').addEventListener('click', cerrar);
    capa.addEventListener('click', e => { if (e.target === capa) cerrar(); });
    document.addEventListener('keydown', alTeclear);
    document.body.appendChild(capa);
  }

  // La tarjeta como PNG (para guardarla en la galería o compartirla a sí misma).
  async function guardarImagen(d) {
    const W = 1080, H = 640;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#5E1A8A'); grad.addColorStop(1, '#3A0F57');
    const radio = 40;
    g.beginPath(); g.moveTo(radio, 0); g.arcTo(W, 0, W, H, radio); g.arcTo(W, H, 0, H, radio); g.arcTo(0, H, 0, 0, radio); g.arcTo(0, 0, W, 0, radio); g.closePath();
    g.fillStyle = grad; g.fill();
    g.strokeStyle = '#CB924F'; g.lineWidth = 3; g.strokeRect(36, 36, W - 72, H - 72);
    try {
      const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = ISOTIPO; });
      g.drawImage(img, 70, 70, 84, 84);
    } catch (e) { /* sin isotipo */ }
    g.fillStyle = '#fff';
    g.font = '600 34px Cinzel, Georgia, serif';
    g.fillText('MW JOYERÍA', 172, 126);
    g.fillStyle = '#C5ABF6';
    g.font = '500 30px Poppins, Arial, sans-serif';
    g.fillText(d.tipo.toUpperCase(), 70, 300);
    g.fillStyle = '#fff';
    g.font = '700 44px Cinzel, Georgia, serif';
    const palabras = d.nombre.split(' ');
    let linea = '', y = 360;
    for (const w of palabras) {
      const prueba = linea ? linea + ' ' + w : w;
      if (g.measureText(prueba).width > 540 && linea) { g.fillText(linea, 70, y); y += 54; linea = w; } else linea = prueba;
    }
    if (linea) g.fillText(linea, 70, y);
    g.fillStyle = '#F8F4EF';
    g.font = '600 40px Poppins, Arial, sans-serif';
    g.fillText(d.usuario, 70, Math.max(y + 70, 520));
    const m = matrizQR(PREFIJO + d.usuario);
    if (m) {
      const lado = 380, x0 = W - lado - 80, y0 = (H - lado) / 2;
      g.fillStyle = '#fff';
      g.fillRect(x0 - 20, y0 - 20, lado + 40, lado + 40);
      const t = lado / m.n;
      g.fillStyle = '#1d0f2b';
      for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) if (m.oscuro(r, c)) g.fillRect(Math.floor(x0 + c * t), Math.floor(y0 + r * t), Math.ceil(t), Math.ceil(t));
    }
    const blob = await new Promise(ok => cv.toBlob(ok, 'image/png'));
    if (!blob) return;
    const nombreArchivo = `tarjeta-mw-${d.usuario}.png`;
    const archivo = typeof File === 'function' ? new File([blob], nombreArchivo, { type: 'image/png' }) : null;
    const esCelular = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (esCelular && archivo && navigator.canShare && navigator.canShare({ files: [archivo] })) {
      try { await navigator.share({ files: [archivo], title: 'Mi tarjeta MW' }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombreArchivo;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (typeof personasRepoListo !== 'undefined') { try { await personasRepoListo; } catch (e) { /* sigue */ } }
    render();
  });
  window.TarjetaVirtualMW = { render, svgQR, PREFIJO };
})();
