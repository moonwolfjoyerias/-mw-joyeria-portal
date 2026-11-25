// MW JOYERÍA — Burbuja del carrito (Emprendedoras y Líderes)
//
// Un botón arriba (junto a la campana en PC, en la barra en celular), en
// todas sus pantallas menos en Mi pedido, con el número de piezas que
// lleva en su CARRITO (lo que eligió en el Catálogo y todavía no aparta ni
// paga — ver js/pedidos-modelo.js). Al tocarlo lleva a Mi pedido. Se
// actualiza en vivo.
//
// Si la página ya carga pedidos-modelo.js usa ese carrito; si no, escucha
// solo su propio documento carritos/{personaId}, como lo permite la regla.
(function () {
  if (/-apartados(\.html)?$/.test(window.location.pathname)) return;
  const esLider = window.location.pathname.includes('/portal/lider/');
  const DESTINO = esLider ? '../lider/lider-apartados' : '../emprendedora/emprendedora-apartados';
  let boton = null;
  let piezasPropias = null;

  const hoy = () => {
    try { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  };

  function personaActual() {
    const s = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
    return s && s.tipo === 'persona' ? s.personaId : null;
  }

  function contar() {
    if (typeof obtenerCarrito === 'function') return obtenerCarrito().length;
    return piezasPropias || 0;
  }

  function pintar() {
    if (!boton) {
      boton = document.createElement('a');
      boton.className = 'burbuja-carrito';
      boton.href = DESTINO;
      boton.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7a3 3 0 016 0"/></svg>
        <span class="burbuja-carrito-num" aria-hidden="true">0</span>`;
      colocar();
    }
    const n = contar();
    boton.querySelector('.burbuja-carrito-num').textContent = n > 99 ? '99+' : String(n);
    boton.classList.toggle('vacia', n === 0);
    boton.setAttribute('aria-label', `Mi carrito: ${n} pieza${n === 1 ? '' : 's'}`);
    boton.title = n ? `${n} pieza${n === 1 ? '' : 's'} en tu carrito` : 'Mi carrito';
  }

  // En PC va junto a la campana (sin tapar su nombre); al bajar en la
  // página, cuando el encabezado ya no se ve, queda flotando arriba a la
  // derecha. En celular va fija en la barra de arriba, a la izquierda del
  // botón del menú (css/styles.css).
  function colocar() {
    const acciones = document.querySelector('.portal-header-actions');
    if (!acciones) { boton.classList.add('burbuja-carrito--flotante'); document.body.appendChild(boton); return; }
    boton.classList.add('burbuja-carrito--encabezado');
    acciones.insertBefore(boton, acciones.firstChild);
    if (!('IntersectionObserver' in window)) return;
    const centinela = document.createElement('span');
    centinela.className = 'burbuja-carrito-centinela';
    centinela.setAttribute('aria-hidden', 'true');
    acciones.insertBefore(centinela, boton);
    new IntersectionObserver(([e]) => {
      boton.classList.toggle('burbuja-carrito--flotante', !e.isIntersecting && e.boundingClientRect.top < 0);
    }).observe(centinela);
  }

  // Páginas sin pedidos-modelo.js: escucha solo su carrito.
  async function escucharPropio() {
    if (typeof dbFirestore === 'undefined' || !dbFirestore) return;
    let id = null;
    for (let i = 0; i < 100 && !id; i++) { id = personaActual(); if (!id) await new Promise(r => setTimeout(r, 150)); }
    if (!id) return;
    dbFirestore.collection('carritos').doc(id).onSnapshot(d => {
      const datos = d.exists ? d.data() : null;
      piezasPropias = datos && datos.dia === hoy() && Array.isArray(datos.piezas) ? datos.piezas.length : 0;
      pintar();
    }, () => { /* sin acceso: se queda en 0 */ });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    pintar();
    if (typeof obtenerCarrito === 'function') {
      if (typeof carritoRepoListo !== 'undefined') { try { await carritoRepoListo; } catch (e) { /* sigue */ } }
      pintar();
      window.addEventListener('mw:carrito-actualizado', pintar);
    } else {
      escucharPropio();
    }
  });
})();
