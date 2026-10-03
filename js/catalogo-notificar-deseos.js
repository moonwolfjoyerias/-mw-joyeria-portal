// MW JOYERÍA — LOG-09 de la auditoría: al dar de alta un producto
// nuevo, Staff/Encargado/Admin pueden revisar la Lista de deseos
// pendiente y decidir manualmente a quién avisar que ya está
// disponible — el documento exige revisión MANUAL, nunca una
// coincidencia automática por nombre. Antes no existía ningún paso
// ligado al alta de un producto; la única forma de avisar era entrar
// aparte a Lista de deseos y cambiarle el estado una por una, sin
// relación con el producto que acababa de entrar.
//
// Un solo archivo para los 3 controladores de Catálogo (staff/
// encargado/admin-catalogo.js, casi copias entre sí) en vez de
// triplicar este modal — se carga junto con lista-deseos-modelo.js /
// lista-deseos-firestore-sync.js en las 3 páginas.

async function abrirRevisionListaDeseosNuevoProducto(producto, empleado) {

  if (typeof listaDeseosRepoListo !== 'undefined') await listaDeseosRepoListo;
  if (typeof obtenerListaDeseos !== 'function') return;

  const pendientes = obtenerListaDeseos().filter(s => s.estado === 'pendiente' || s.estado === 'en_seguimiento');
  if (!pendientes.length) return; // nada que revisar — no hace falta un modal vacío

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const escapar = (texto) => String(texto ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 17.3l-5.5 2.9 1-6-4.5-4 6-0.9L12 3.5l2.9 5.8 6 0.9-4.4 4 1 6z"/></svg></div>
    <h3>¿Alguien pedía algo como "${escapar(producto.nombre)}"?</h3>
    <p class="modal-sub">Hay ${pendientes.length} solicitud${pendientes.length === 1 ? '' : 'es'} pendiente${pendientes.length === 1 ? '' : 's'} en la Lista de deseos. Revísalas y marca las que de verdad coincidan con esta pieza — ninguna se marca sola.</p>
    <div style="max-height:280px;overflow-y:auto;margin:10px 0;">
      ${pendientes.map(s => `
        <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 2px;border-bottom:1px solid var(--mw-border,#e4dcee);cursor:pointer;">
          <input type="checkbox" data-deseo-id="${escapar(s.id)}" style="margin-top:4px;">
          <span>
            <strong>${escapar(s.destinatario === 'emprendedora' ? (s.personaNombre || '(sin nombre)') : 'Público en general')}</strong><br>
            <small>${escapar((s.piezas || []).map(p => p.producto).join(', '))}</small>
          </span>
        </label>
      `).join('')}
    </div>
    <div style="display:flex;gap:10px;margin-top:10px;">
      <button class="btn btn-outline" style="flex:1;" id="deseosOmitirBtn" type="button">Omitir</button>
      <button class="btn btn-primary" style="flex:1;" id="deseosMarcarBtn" type="button">Marcar como disponibles</button>
    </div>
  `;

  overlay.classList.add('open');
  const cerrar = () => overlay.classList.remove('open');
  box.querySelector('[data-close]')?.addEventListener('click', cerrar);
  document.getElementById('deseosOmitirBtn').addEventListener('click', cerrar);

  document.getElementById('deseosMarcarBtn').addEventListener('click', () => {
    const ids = Array.from(box.querySelectorAll('[data-deseo-id]:checked')).map(el => el.getAttribute('data-deseo-id'));
    cerrar();
    if (!ids.length) return;

    ids.forEach(id => actualizarEstadoListaDeseos(id, 'disponible', {
      usuarioId: empleado.usuario || empleado.usuarioId || null,
      usuarioNombre: empleado.nombre || empleado.usuarioNombre || '',
      usuarioRol: empleado.rol || 'staff',
      comentario: `Coincide con el producto nuevo: ${producto.nombre}`,
      productoId: producto.id
    }));

    if (typeof mostrarToast === 'function') {
      mostrarToast(`${ids.length} solicitud${ids.length === 1 ? '' : 'es'} de lista de deseos marcada${ids.length === 1 ? '' : 's'} como disponible${ids.length === 1 ? '' : 's'}.`);
    }
  });

}
