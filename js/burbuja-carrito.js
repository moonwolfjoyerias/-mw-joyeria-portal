// MW JOYERÍA — Burbuja del carrito (Emprendedoras y Líderes)
//
// Un botón arriba (junto a la campana en PC, en la barra en celular), en todas sus pantallas menos en "Mis
// apartados", con el número de piezas LISTAS PARA PAGAR (las que el equipo
// ya guardó en su bolsita). Al tocarlo lleva a Mis apartados, sin tener que
// abrir el menú. Se actualiza en vivo.
//
// En las páginas que ya cargan Apartados (apartados-modelo.js) usa esos
// datos; en las demás lee solo sus propias ventanas (ventanasApartado donde
// usuarioId es ella), igual que lo permite la regla de Firestore.
(function () {
  if (/-apartados(\.html)?$/.test(window.location.pathname)) return;
  const esLider = window.location.pathname.includes('/portal/lider/');
  const DESTINO = esLider ? '../lider/lider-apartados' : '../emprendedora/emprendedora-apartados';
  let boton = null;
  let ventanasPropias = null;

  const listas = ventanas => ventanas
    .filter(v => v && v.estado === 'activa' && Array.isArray(v.apartados))
    .reduce((s, v) => s + v.apartados.filter(p => p.estado === 'activa' && p.enBolsita).length, 0);

  function personaActual() {
    const s = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
    return s && s.tipo === 'persona' ? s.personaId : null;
  }

  function contar() {
    if (ventanasPropias) return listas(ventanasPropias);
    if (typeof obtenerVentanasApartado === 'function') {
      const id = personaActual();
      return listas(obtenerVentanasApartado().filter(v => !id || v.usuarioId === id));
    }
    return 0;
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
    const nombre = document.body.dataset.miCarrito === '1' || /Mi carrito/.test(document.querySelector('.sidebar-nav, nav')?.textContent || '') ? 'Mi carrito' : 'Mis apartados';
    boton.querySelector('.burbuja-carrito-num').textContent = n > 99 ? '99+' : String(n);
    boton.classList.toggle('vacia', n === 0);
    boton.setAttribute('aria-label', `${nombre}: ${n} pieza${n === 1 ? '' : 's'} lista${n === 1 ? '' : 's'} para pagar`);
    boton.title = n ? `${n} pieza${n === 1 ? '' : 's'} lista${n === 1 ? '' : 's'} para pagar` : nombre;
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

  // Páginas sin Apartados: escucha solo sus propias ventanas.
  async function escucharPropias() {
    if (typeof dbFirestore === 'undefined' || !dbFirestore) return;
    let id = null;
    for (let i = 0; i < 100 && !id; i++) { id = personaActual(); if (!id) await new Promise(r => setTimeout(r, 150)); }
    if (!id) return;
    dbFirestore.collection('ventanasApartado').where('usuarioId', '==', id).onSnapshot(s => {
      ventanasPropias = s.docs.map(d => d.data());
      pintar();
    }, () => { /* sin acceso: se queda en 0 */ });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    pintar();
    if (typeof obtenerVentanasApartado === 'function') {
      if (typeof apartadosRepoListo !== 'undefined') { try { await apartadosRepoListo; } catch (e) { /* sigue */ } }
      pintar();
      window.addEventListener('mw:apartados-actualizados', pintar);
    } else {
      escucharPropias();
    }
  });
})();
