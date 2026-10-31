// MW JOYERÍA — Escanear el QR de las etiquetas con la cámara
// ===========================================================
// Botón de cámara para el formulario de producto y el buscador del catálogo
// (Admin, Encargado y Staff). Usa el lector del navegador cuando lo tiene
// (Chrome en Android y Mac) y, si no, jsQR (Windows, iPad/iPhone), que se
// descarga solo la primera vez que se abre la cámara. El lector de mano tipo
// teclado sigue funcionando igual.
//
// Lo que dice el código (misma regla que BRILLO, src/pagina/codigoProducto.ts):
//   HUGX000988119XP    → HUG = Huggies  · XP = Oro laminado
//   PULT001318462ACERO → PUL = Pulseras · ACERO = Acero inoxidable
//   BRO71857GT-03      → BRO = Broqueles · GT = Oro laminado
// Inicio: abreviaturas oficiales de la tienda (3 letras; si no, 2).
// Final: XP, GT y CM = Oro laminado; ACERO = Acero inoxidable.
// Lo que no se reconoce se deja como esté.
(function () {
  const CATEGORIA_3 = {
    ANI: 'Anillos', ARE: 'Aretes', ARR: 'Arracadas', BRA: 'Brazaletes', BRO: 'Broqueles',
    CAD: 'Cadenas', COL: 'Collares', DIJ: 'Dijes', HUG: 'Huggies', JUE: 'Juegos',
    PRE: 'Prendedores', PUL: 'Pulseras', ROS: 'Rosarios', SIM: 'Simuladores', TOB: 'Tobilleras'
  };
  const CATEGORIA_2 = {
    AN: 'Anillos', AE: 'Aretes', AA: 'Arracadas', BA: 'Brazaletes', BO: 'Broqueles',
    CA: 'Cadenas', CO: 'Collares', DI: 'Dijes', HU: 'Huggies', JU: 'Juegos',
    PR: 'Prendedores', PU: 'Pulseras', RO: 'Rosarios', SI: 'Simuladores', TO: 'Tobilleras'
  };
  const MATERIAL_FINAL = [
    ['ACERO', 'acero-inoxidable'],
    ['XP', 'oro-laminado'],
    ['GT', 'oro-laminado'],
    ['CM', 'oro-laminado']
  ];
  const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';

  /** El código como se guarda: sin espacios y en mayúsculas. Si el QR trae una liga, su última parte. */
  function limpiarCodigo(texto) {
    let t = String(texto || '').trim();
    if (/^https?:\/\//i.test(t)) t = t.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() || '';
    return t.replace(/\s+/g, '').toUpperCase();
  }

  function datosDeCodigo(texto) {
    const codigo = limpiarCodigo(texto);
    const categoria = CATEGORIA_3[codigo.slice(0, 3)] || CATEGORIA_2[codigo.slice(0, 2)] || null;
    const cuerpo = codigo.replace(/[-_]\d{1,3}$/, ''); // "BRO71857GT-03": la variante no cuenta
    const fin = MATERIAL_FINAL.find(([f]) => cuerpo.endsWith(f));
    return { codigo, categoria, material: fin ? fin[1] : null };
  }

  // ---------------------------------------------------------- lector
  let promesaJsQR = null;
  function cargarJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (!promesaJsQR) {
      promesaJsQR = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = JSQR_URL;
        s.onload = () => (window.jsQR ? resolve(window.jsQR) : reject(new Error('jsQR')));
        s.onerror = () => { promesaJsQR = null; reject(new Error('jsQR')); };
        document.head.appendChild(s);
      });
    }
    return promesaJsQR;
  }

  async function crearLector() {
    if ('BarcodeDetector' in window) {
      try {
        const formatos = await window.BarcodeDetector.getSupportedFormats();
        if (formatos.includes('qr_code')) {
          const d = new window.BarcodeDetector({ formats: ['qr_code', ...formatos.filter(f => f === 'code_128')] });
          return async v => ((await d.detect(v))[0] || {}).rawValue || null;
        }
      } catch (_) { /* se usa jsQR */ }
    }
    const jsQR = await cargarJsQR();
    const lienzo = document.createElement('canvas');
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });
    return async v => {
      if (!v.videoWidth) return null;
      const escala = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
      lienzo.width = Math.round(v.videoWidth * escala);
      lienzo.height = Math.round(v.videoHeight * escala);
      ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height);
      const img = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
      const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
      return r ? r.data : null;
    };
  }

  function mensajeDeError(e) {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'No hay permiso para usar la cámara. Permítelo en el candado de la barra de direcciones y vuelve a intentar.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'Este equipo no tiene cámara disponible.';
    if (n === 'NotReadableError') return 'La cámara la está usando otra aplicación. Ciérrala y vuelve a intentar.';
    if (n === 'SinCamara') return 'Este navegador no deja usar la cámara aquí (se necesita la página con https).';
    if (e && e.message === 'jsQR') return 'No se pudo cargar el lector. Revisa la conexión a internet.';
    return 'No se pudo abrir la cámara.';
  }

  /** Abre la cámara; al leer un QR la cierra y llama onCodigo(texto). */
  function abrir({ titulo = 'Escanear etiqueta', onCodigo }) {
    const fondo = document.createElement('div');
    fondo.className = 'escaner-qr-fondo';
    fondo.innerHTML = `
      <div class="escaner-qr-caja" role="dialog" aria-modal="true">
        <div class="escaner-qr-cabeza">
          <h3></h3>
          <button type="button" class="btn btn-outline escaner-qr-cerrar">Cerrar</button>
        </div>
        <div class="escaner-qr-cuadro">
          <video playsinline muted></video>
          <span class="escaner-qr-mira" aria-hidden="true"></span>
        </div>
        <p class="escaner-qr-mensaje">Abriendo la cámara…</p>
      </div>`;
    fondo.querySelector('h3').textContent = titulo;
    fondo.querySelector('[role=dialog]').setAttribute('aria-label', titulo);
    document.body.appendChild(fondo);
    const video = fondo.querySelector('video');
    const mensaje = fondo.querySelector('.escaner-qr-mensaje');

    let vivo = true;
    let flujo = null;
    let cuadro = 0;
    const cerrar = () => {
      vivo = false;
      cancelAnimationFrame(cuadro);
      if (flujo) flujo.getTracks().forEach(t => t.stop());
      document.removeEventListener('keydown', alTeclear, true);
      fondo.remove();
    };
    // Esc cierra solo el escáner (no el formulario de abajo).
    function alTeclear(e) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      cerrar();
    }
    document.addEventListener('keydown', alTeclear, true);
    fondo.querySelector('.escaner-qr-cerrar').addEventListener('click', cerrar);
    fondo.addEventListener('click', e => { if (e.target === fondo) cerrar(); });

    const fallar = e => {
      if (!vivo) return;
      fondo.querySelector('.escaner-qr-cuadro').remove();
      mensaje.classList.add('error');
      mensaje.textContent = mensajeDeError(e);
    };

    (async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return fallar({ name: 'SinCamara' });
      }
      try {
        flujo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
      } catch (e) { return fallar(e); }
      if (!vivo) { flujo.getTracks().forEach(t => t.stop()); return; }
      video.srcObject = flujo;
      await video.play().catch(() => {});
      let leer;
      try { leer = await crearLector(); } catch (e) { return fallar(e); }
      if (!vivo) return;
      mensaje.textContent = 'Acerca el QR de la etiqueta al recuadro.';
      let ultimo = 0;
      let ocupado = false;
      const paso = async t => {
        if (!vivo) return;
        cuadro = requestAnimationFrame(paso);
        if (ocupado || t - ultimo < 120) return;
        ultimo = t;
        ocupado = true;
        try {
          const texto = String((await leer(video)) || '').trim();
          if (texto && vivo) {
            if (navigator.vibrate) navigator.vibrate(80);
            cerrar();
            onCodigo(texto);
          }
        } catch (_) { /* cuadro ilegible: se intenta con el siguiente */ } finally {
          ocupado = false;
        }
      };
      cuadro = requestAnimationFrame(paso);
    })();
  }

  function crearBoton(titulo, onCodigo) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'boton-camara-qr';
    b.title = 'Escanear con la cámara';
    b.setAttribute('aria-label', 'Escanear con la cámara');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg>';
    b.addEventListener('click', () => abrir({ titulo, onCodigo }));
    return b;
  }

  /**
   * Formulario de producto (#productoCodigo, #productoCategoria, #productoMaterial):
   * botón de cámara junto al código y, al escanear o escribir el código,
   * llena categoría y material (el material dispara su descuento sugerido).
   * Si el código ya existe en el catálogo, solo avisa.
   */
  function conectarCodigoProducto({ catalogo, idEditando } = {}) {
    const input = document.getElementById('productoCodigo');
    if (!input || input.dataset.escaner) return;
    input.dataset.escaner = '1';
    const fila = document.createElement('div');
    fila.className = 'campo-con-camara';
    input.parentNode.insertBefore(fila, input);
    fila.appendChild(input);
    const aviso = document.createElement('small');
    aviso.className = 'field-help escaner-qr-aviso';
    aviso.hidden = true;
    fila.after(aviso);

    let aplicado = limpiarCodigo(input.value);
    const poner = (id, valor) => {
      const sel = document.getElementById(id);
      if (!sel || !valor || sel.value === valor) return;
      if (![...sel.options].some(o => o.value === valor)) return;
      sel.value = valor;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const aplicar = texto => {
      const d = datosDeCodigo(texto);
      input.value = d.codigo;
      if (!d.codigo || d.codigo === aplicado) return;
      aplicado = d.codigo;
      poner('productoCategoria', d.categoria);
      poner('productoMaterial', d.material);
      const lista = typeof catalogo === 'function' ? catalogo() : [];
      const mismo = typeof productoConCodigo === 'function' ? productoConCodigo(lista || [], d.codigo, idEditando) : null;
      aviso.hidden = !mismo;
      if (mismo) {
        aviso.textContent = `Ese código ya lo tiene "${mismo.nombre}". Usa un código distinto.`;
        if (typeof mostrarToast === 'function') mostrarToast(aviso.textContent);
      }
    };
    input.addEventListener('change', () => aplicar(input.value));
    // El lector de mano termina con Enter: que no haga nada más.
    input.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      aplicar(input.value);
    });
    fila.appendChild(crearBoton('Escanear la etiqueta', aplicar));
  }

  /** Buscador: el QR leído se escribe en el buscador y filtra. */
  function conectarBuscador(id) {
    const input = document.getElementById(id);
    if (!input || input.dataset.escaner) return;
    input.dataset.escaner = '1';
    input.after(crearBoton('Buscar por etiqueta', texto => {
      input.value = limpiarCodigo(texto);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }));
  }

  window.MWEscaner = { abrir, datosDeCodigo, limpiarCodigo, conectarCodigoProducto, conectarBuscador };
})();
