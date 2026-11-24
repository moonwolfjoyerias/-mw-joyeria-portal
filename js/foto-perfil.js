// MW JOYERÍA — Foto de perfil (Emprendedoras, Líderes, Encargado y Admin)
//
// Cada foto vive en fotosPerfil/{clave}, separada de los datos de la
// persona, para que la Líder pueda ver las fotos de su equipo sin poder
// leer nada más de ellas (ver firestore.rules). La clave es el personaId
// de la e/l, o "interna-{uid}" para Encargado/Admin. Staff no tiene foto:
// su cuenta es compartida.
//
// La foto se recorta en un círculo que la persona acomoda (arrastrar y
// acercar) y se guarda chica (320×320 JPEG, ~25 KB): cabe de sobra en un
// documento y se carga rápido con datos móviles.
(function () {
  const COLECCION = 'fotosPerfil';
  const LADO = 320;
  const MAX_CARACTERES = 250000;
  const cache = new Map(); // clave → fotoUrl ('' = sin foto)

  const db = () => (typeof dbFirestore !== 'undefined' && dbFirestore) ? dbFirestore : null;
  const sesion = () => (typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null);
  const esFotoValida = (url) => typeof url === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(url);
  const escAttr = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ---------- Claves ----------
  function clavePropia() {
    const s = sesion();
    if (!s) return null;
    if (s.tipo === 'interna') return s.rol === 'staff' ? null : (s.uid ? `interna-${s.uid}` : null);
    return s.personaId || s.uid || null;
  }

  // ---------- Leer ----------
  async function obtener(clave) {
    if (!clave) return '';
    if (cache.has(clave)) return cache.get(clave);
    const base = db();
    if (!base) return '';
    try {
      const d = await base.collection(COLECCION).doc(String(clave)).get();
      const url = d.exists && esFotoValida(d.data().fotoUrl) ? d.data().fotoUrl : '';
      cache.set(clave, url);
      return url;
    } catch (e) {
      return '';
    }
  }

  // Varias de una vez (lista de Emprendedoras, equipo de la Líder).
  async function obtenerVarias(claves) {
    const unicas = [...new Set((claves || []).filter(Boolean).map(String))];
    const res = new Map();
    const faltan = unicas.filter(c => { if (cache.has(c)) { res.set(c, cache.get(c)); return false; } return true; });
    // De 10 en 10 para no abrir cientos de lecturas a la vez.
    for (let i = 0; i < faltan.length; i += 10) {
      const grupo = faltan.slice(i, i + 10);
      const urls = await Promise.all(grupo.map(obtener));
      grupo.forEach((c, j) => res.set(c, urls[j]));
    }
    return res;
  }

  // Por usuario MW#### (el árbol de mi-equipo a veces solo trae la membresía).
  async function obtenerPorUsuarios(usuarios) {
    const res = new Map();
    const base = db();
    const lista = [...new Set((usuarios || []).filter(Boolean).map(u => String(u).trim().toUpperCase()))];
    if (!base || !lista.length) return res;
    for (let i = 0; i < lista.length; i += 30) {
      try {
        const snap = await base.collection(COLECCION).where('usuario', 'in', lista.slice(i, i + 30)).get();
        snap.forEach(d => {
          const url = esFotoValida(d.data().fotoUrl) ? d.data().fotoUrl : '';
          if (url) { res.set(String(d.data().usuario).toUpperCase(), url); cache.set(d.id, url); }
        });
      } catch (e) { /* sin fotos: se quedan las iniciales */ }
    }
    return res;
  }

  // ---------- Guardar / quitar ----------
  async function guardar(clave, fotoUrl, extra = {}) {
    const base = db();
    if (!base || !clave) throw new Error('Sin conexión con la base de datos.');
    if (!esFotoValida(fotoUrl) || fotoUrl.length > MAX_CARACTERES) throw new Error('La imagen no es válida.');
    const doc = { fotoUrl, actualizadoEn: new Date().toISOString() };
    if (extra.usuario) doc.usuario = String(extra.usuario).trim().toUpperCase();
    if (extra.nombre) doc.nombre = String(extra.nombre).slice(0, 120);
    await base.collection(COLECCION).doc(String(clave)).set(doc);
    cache.set(String(clave), fotoUrl);
    avisarCambio(clave);
  }

  async function quitar(clave) {
    const base = db();
    if (!base || !clave) throw new Error('Sin conexión con la base de datos.');
    await base.collection(COLECCION).doc(String(clave)).delete();
    cache.set(String(clave), '');
    avisarCambio(clave);
  }

  function avisarCambio(clave) {
    window.dispatchEvent(new CustomEvent('mw:foto-perfil', { detail: { clave: String(clave) } }));
    if (String(clave) === String(clavePropia())) pintarEncabezado();
  }

  // ---------- Pintar ----------
  function htmlAvatar(fotoUrl, iniciales, alt) {
    return esFotoValida(fotoUrl)
      ? `<img src="${fotoUrl}" alt="${escAttr(alt || '')}" class="fp-img" loading="lazy" decoding="async">`
      : escAttr(iniciales || '');
  }

  function pintar(el, fotoUrl, iniciales, alt) {
    if (!el) return;
    el.innerHTML = htmlAvatar(fotoUrl, iniciales, alt);
    el.classList.toggle('con-foto', esFotoValida(fotoUrl));
  }

  // Burbuja de perfil del encabezado (todas las páginas de portal).
  // auth-guard.js vuelve a escribir la inicial en la burbuja cuando termina
  // de leer la sesión (a veces después de que aquí ya se puso la foto), así
  // que se vigila la burbuja y se vuelve a poner la foto si la borran.
  let vigilandoEncabezado = false;
  async function pintarEncabezado() {
    const avatar = document.querySelector('.profile-btn .profile-avatar');
    const clave = clavePropia();
    if (!avatar || !clave) return;
    const url = await obtener(clave);
    const aplicar = () => {
      const img = avatar.querySelector('img.fp-img');
      if (!img) avatar.dataset.inicial = avatar.textContent.trim() || avatar.dataset.inicial || '';
      const actual = cache.get(String(clave)) || '';
      if (actual && (!img || img.src !== actual)) pintar(avatar, actual, '', '');
      else if (!actual && img) pintar(avatar, '', avatar.dataset.inicial || '', '');
    };
    if (!vigilandoEncabezado) {
      vigilandoEncabezado = true;
      new MutationObserver(aplicar).observe(avatar, { childList: true, characterData: true, subtree: true });
    }
    if (url !== undefined) aplicar();
  }

  // ---------- Editor: subir y acomodar en el círculo ----------
  function leerArchivo(archivo) {
    return new Promise((resolve, reject) => {
      if (!archivo || !archivo.type || !archivo.type.startsWith('image/')) { reject(new Error('Elige un archivo de imagen (JPG o PNG).')); return; }
      if (archivo.size > 15 * 1024 * 1024) { reject(new Error('La imagen pesa más de 15 MB; elige otra.')); return; }
      const url = URL.createObjectURL(archivo);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo abrir esa imagen.')); };
      img.src = url;
    });
  }

  function elegirArchivo() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', () => { resolve(input.files && input.files[0]); input.remove(); }, { once: true });
      input.click();
    });
  }

  // opciones: { titulo, fotoActual, iniciales, onGuardar(dataUrl) → Promise, onQuitar() → Promise }
  function abrirEditor(opciones = {}) {
    const fondo = document.createElement('div');
    fondo.className = 'fp-fondo';
    fondo.innerHTML = `
      <div class="fp-caja" role="dialog" aria-modal="true" aria-labelledby="fpTitulo">
        <div class="fp-cabeza">
          <h3 id="fpTitulo">${escAttr(opciones.titulo || 'Foto de perfil')}</h3>
          <button type="button" class="fp-cerrar" data-fp-cerrar aria-label="Cerrar">×</button>
        </div>
        <div class="fp-paso fp-paso-inicio">
          <div class="fp-actual">${htmlAvatar(opciones.fotoActual, opciones.iniciales, 'Tu foto actual')}</div>
          <p class="fp-ayuda">Usa una foto donde se vea bien tu cara. Después la podrás acomodar dentro del círculo.</p>
          <div class="fp-acciones">
            <button type="button" class="btn btn-primary" data-fp-elegir>${opciones.fotoActual ? 'Cambiar foto' : 'Elegir foto'}</button>
            ${opciones.fotoActual && opciones.onQuitar ? '<button type="button" class="btn btn-outline fp-quitar" data-fp-quitar>Quitar foto</button>' : ''}
          </div>
        </div>
        <div class="fp-paso fp-paso-recorte" hidden>
          <div class="fp-marco">
            <canvas class="fp-lienzo" width="560" height="560" aria-label="Vista previa: arrastra para acomodar la foto"></canvas>
          </div>
          <label class="fp-zoom"><span>Acercar</span><input type="range" min="1" max="4" step="0.01" value="1" data-fp-zoom aria-label="Acercar o alejar la foto"></label>
          <p class="fp-ayuda">Arrastra la foto para acomodarla dentro del círculo.</p>
          <div class="fp-acciones">
            <button type="button" class="btn btn-outline" data-fp-otra>Elegir otra</button>
            <button type="button" class="btn btn-primary" data-fp-guardar>Guardar foto</button>
          </div>
        </div>
        <p class="fp-error" role="alert" hidden></p>
      </div>`;
    document.body.appendChild(fondo);
    const focoPrevio = document.activeElement;
    const $ = (s) => fondo.querySelector(s);
    const error = $('.fp-error');
    const lienzo = $('.fp-lienzo');
    const ctx = lienzo.getContext('2d');
    const zoomInput = $('[data-fp-zoom]');
    const estado = { img: null, url: null, escalaBase: 1, zoom: 1, x: 0, y: 0 };

    const mostrarError = (t) => { error.textContent = t; error.hidden = !t; };
    const cerrar = () => {
      if (estado.url) URL.revokeObjectURL(estado.url);
      document.removeEventListener('keydown', tecla);
      fondo.remove();
      if (focoPrevio && focoPrevio.focus) focoPrevio.focus();
    };
    const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);

    const W = lienzo.width;
    const limitar = () => {
      const esc = estado.escalaBase * estado.zoom;
      const w = estado.img.naturalWidth * esc, h = estado.img.naturalHeight * esc;
      estado.x = Math.min(0, Math.max(W - w, estado.x));
      estado.y = Math.min(0, Math.max(W - h, estado.y));
    };
    const dibujar = () => {
      const esc = estado.escalaBase * estado.zoom;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, W);
      ctx.drawImage(estado.img, estado.x, estado.y, estado.img.naturalWidth * esc, estado.img.naturalHeight * esc);
    };
    const cambiarZoom = (z, cx = W / 2, cy = W / 2) => {
      const anterior = estado.escalaBase * estado.zoom;
      estado.zoom = Math.min(4, Math.max(1, z));
      const nueva = estado.escalaBase * estado.zoom;
      // Acercar hacia el punto (cx, cy), no hacia la esquina.
      estado.x = cx - (cx - estado.x) * (nueva / anterior);
      estado.y = cy - (cy - estado.y) * (nueva / anterior);
      zoomInput.value = String(estado.zoom);
      limitar(); dibujar();
    };

    async function elegir() {
      mostrarError('');
      const archivo = await elegirArchivo();
      if (!archivo) return;
      try {
        const { img, url } = await leerArchivo(archivo);
        if (estado.url) URL.revokeObjectURL(estado.url);
        Object.assign(estado, { img, url, zoom: 1 });
        estado.escalaBase = Math.max(W / img.naturalWidth, W / img.naturalHeight);
        estado.x = (W - img.naturalWidth * estado.escalaBase) / 2;
        estado.y = (W - img.naturalHeight * estado.escalaBase) / 2;
        zoomInput.value = '1';
        $('.fp-paso-inicio').hidden = true;
        $('.fp-paso-recorte').hidden = false;
        dibujar();
        $('[data-fp-guardar]').focus();
      } catch (e) {
        mostrarError(e.message);
      }
    }

    // Arrastrar (dedo o mouse) y pellizcar para acercar.
    const punteros = new Map();
    let distanciaInicial = 0, zoomInicial = 1;
    const aLienzo = (e) => { const r = lienzo.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (W / r.height) }; };
    lienzo.addEventListener('pointerdown', (e) => {
      if (!estado.img) return;
      lienzo.setPointerCapture(e.pointerId);
      punteros.set(e.pointerId, aLienzo(e));
      if (punteros.size === 2) {
        const [a, b] = [...punteros.values()];
        distanciaInicial = Math.hypot(a.x - b.x, a.y - b.y); zoomInicial = estado.zoom;
      }
    });
    lienzo.addEventListener('pointermove', (e) => {
      if (!punteros.has(e.pointerId)) return;
      const antes = punteros.get(e.pointerId);
      const ahora = aLienzo(e);
      punteros.set(e.pointerId, ahora);
      if (punteros.size === 1) {
        estado.x += ahora.x - antes.x; estado.y += ahora.y - antes.y;
        limitar(); dibujar();
      } else if (punteros.size === 2 && distanciaInicial) {
        const [a, b] = [...punteros.values()];
        cambiarZoom(zoomInicial * Math.hypot(a.x - b.x, a.y - b.y) / distanciaInicial, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
    });
    const soltar = (e) => { punteros.delete(e.pointerId); if (punteros.size < 2) distanciaInicial = 0; };
    lienzo.addEventListener('pointerup', soltar);
    lienzo.addEventListener('pointercancel', soltar);
    lienzo.addEventListener('wheel', (e) => {
      if (!estado.img) return;
      e.preventDefault();
      const p = aLienzo(e);
      cambiarZoom(estado.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), p.x, p.y);
    }, { passive: false });
    zoomInput.addEventListener('input', () => cambiarZoom(Number(zoomInput.value)));
    // Teclado: flechas mueven, + / − acercan.
    lienzo.tabIndex = 0;
    lienzo.addEventListener('keydown', (e) => {
      if (!estado.img) return;
      const paso = 16;
      const mov = { ArrowLeft: [paso, 0], ArrowRight: [-paso, 0], ArrowUp: [0, paso], ArrowDown: [0, -paso] }[e.key];
      if (mov) { e.preventDefault(); estado.x += mov[0]; estado.y += mov[1]; limitar(); dibujar(); }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); cambiarZoom(estado.zoom + 0.1); }
      if (e.key === '-') { e.preventDefault(); cambiarZoom(estado.zoom - 0.1); }
    });

    function recortar() {
      const salida = document.createElement('canvas');
      salida.width = LADO; salida.height = LADO;
      const c = salida.getContext('2d');
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, LADO, LADO);
      c.drawImage(lienzo, 0, 0, W, W, 0, 0, LADO, LADO);
      let calidad = 0.86;
      let url = salida.toDataURL('image/jpeg', calidad);
      while (url.length > MAX_CARACTERES && calidad > 0.5) { calidad -= 0.1; url = salida.toDataURL('image/jpeg', calidad); }
      return url;
    }

    fondo.addEventListener('click', async (e) => {
      if (e.target === fondo || e.target.closest('[data-fp-cerrar]')) { cerrar(); return; }
      if (e.target.closest('[data-fp-elegir], [data-fp-otra]')) { elegir(); return; }
      const guardarBtn = e.target.closest('[data-fp-guardar]');
      if (guardarBtn && estado.img) {
        guardarBtn.disabled = true; guardarBtn.textContent = 'Guardando…'; mostrarError('');
        try { await opciones.onGuardar(recortar()); cerrar(); } catch (err) {
          mostrarError('No se pudo guardar la foto: ' + (err && err.message ? err.message : 'intenta de nuevo.'));
          guardarBtn.disabled = false; guardarBtn.textContent = 'Guardar foto';
        }
        return;
      }
      const quitarBtn = e.target.closest('[data-fp-quitar]');
      if (quitarBtn && opciones.onQuitar) {
        quitarBtn.disabled = true; mostrarError('');
        try { await opciones.onQuitar(); cerrar(); } catch (err) {
          mostrarError('No se pudo quitar la foto: ' + (err && err.message ? err.message : 'intenta de nuevo.'));
          quitarBtn.disabled = false;
        }
      }
    });
    setTimeout(() => ($('[data-fp-elegir]') || $('[data-fp-cerrar]')).focus(), 30);
    return { cerrar };
  }

  // Abre el editor para la foto PROPIA de quien inició sesión.
  async function editarPropia({ nombre = '', usuario = '', iniciales = '' } = {}) {
    const clave = clavePropia();
    if (!clave) { if (typeof mostrarToast === 'function') mostrarToast('Esta cuenta no puede tener foto de perfil.'); return; }
    const actual = await obtener(clave);
    abrirEditor({
      titulo: 'Tu foto de perfil',
      fotoActual: actual,
      iniciales,
      onGuardar: async (url) => {
        await guardar(clave, url, { nombre, usuario });
        if (typeof mostrarToast === 'function') mostrarToast('Foto de perfil actualizada.');
      },
      onQuitar: async () => {
        await quitar(clave);
        if (typeof mostrarToast === 'function') mostrarToast('Quitaste tu foto de perfil.');
      }
    });
  }

  // Mi cuenta (e/l, Líder, Encargado y Admin): botón "Cambiar foto" bajo
  // el círculo y la foto dentro de él. cuenta.js / lider-cuenta.js /
  // admin-mi-cuenta.js / encargado-mi-cuenta.js siguen pintando las
  // iniciales como siempre; si la persona tiene foto, aquí se pone encima
  // (y se vuelve a poner si esas páginas repintan el círculo).
  async function conectarMiCuenta() {
    if (!/mi-cuenta(\.html)?$/.test(location.pathname)) return;
    const caja = document.getElementById('perfilIniciales') || document.getElementById('miCuentaFotoPreview');
    const clave = clavePropia();
    if (!caja || !clave) return;
    const envoltura = caja.closest('.profile-photo-wrap') || caja.parentNode;
    let url = await obtener(clave);
    const inicialesActuales = () => (caja.querySelector('img') ? (caja.dataset.inicial || '') : caja.textContent.trim());
    const aplicar = () => {
      if (!caja.querySelector('img')) caja.dataset.inicial = caja.textContent.trim();
      if (url) {
        if (!caja.querySelector('img.fp-img') || caja.querySelector('img.fp-img').src !== url) pintar(caja, url, '', 'Tu foto de perfil');
      } else if (caja.querySelector('img.fp-img')) {
        pintar(caja, '', caja.dataset.inicial || '', '');
      }
      if (boton) boton.lastChild.textContent = url ? ' Cambiar foto' : ' Poner foto';
    };
    let boton = envoltura.parentNode.querySelector('.fp-boton-perfil');
    if (!boton) {
      boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'fp-boton-perfil';
      boton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span> Poner foto</span>';
      envoltura.insertAdjacentElement('afterend', boton);
      boton.addEventListener('click', () => {
        const s = sesion() || {};
        const nombre = (document.getElementById('perfilNombre') || document.getElementById('miCuentaNombre'))?.textContent.trim() || s.nombre || '';
        editarPropia({ nombre, usuario: s.tipo === 'interna' ? '' : s.usuario, iniciales: inicialesActuales() });
      });
    }
    new MutationObserver(() => aplicar()).observe(caja, { childList: true });
    window.addEventListener('mw:foto-perfil', async (e) => {
      if (e.detail.clave !== String(clave)) return;
      url = cache.get(String(clave)) || '';
      aplicar();
    });
    aplicar();
  }

  // Pone las fotos en los círculos de iniciales de una lista ya pintada:
  // cualquier elemento con data-foto-persona="{personaId}" o
  // data-foto-usuario="MW####". Sin foto, se quedan las iniciales.
  async function pintarEn(contenedor) {
    const raiz = contenedor || document;
    const porPersona = [...raiz.querySelectorAll('[data-foto-persona]')];
    const porUsuario = [...raiz.querySelectorAll('[data-foto-usuario]:not([data-foto-persona])')];
    if (!porPersona.length && !porUsuario.length) return;
    const [fotos, fotosUsuario] = await Promise.all([
      obtenerVarias(porPersona.map(el => el.dataset.fotoPersona)),
      obtenerPorUsuarios(porUsuario.map(el => el.dataset.fotoUsuario))
    ]);
    porPersona.forEach(el => {
      const url = fotos.get(String(el.dataset.fotoPersona));
      if (url && el.isConnected) pintar(el, url, '', el.dataset.fotoAlt || '');
    });
    porUsuario.forEach(el => {
      const url = fotosUsuario.get(String(el.dataset.fotoUsuario).trim().toUpperCase());
      if (url && el.isConnected) pintar(el, url, '', el.dataset.fotoAlt || '');
    });
  }

  window.MWFotoPerfil = { clavePropia, obtener, obtenerVarias, obtenerPorUsuarios, guardar, quitar, pintar, pintarEn, htmlAvatar, pintarEncabezado, abrirEditor, editarPropia, esFotoValida };

  // La burbuja del encabezado (y Mi cuenta) se conectan solas en cuanto hay sesión.
  document.addEventListener('DOMContentLoaded', () => {
    let intentos = 0;
    const probar = () => {
      if (clavePropia() && db()) { pintarEncabezado(); conectarMiCuenta(); return; }
      if (++intentos < 40) setTimeout(probar, 250);
    };
    probar();
  });
})();
