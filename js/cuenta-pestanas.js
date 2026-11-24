// MW JOYERÍA — Mi cuenta en pestañas (Sistema visual MW)
//
// Mi cuenta medía unas 7 pantallas de celular en una sola columna. Aquí se
// reparte en pestañas, sin mover nada de lugar en el HTML (cada bloque
// sigue con sus ids, así que cuenta.js / lider-cuenta.js lo llenan igual):
//   Perfil        → datos de la persona y su Tarjeta MW
//   Premios       → Rifa mensual, Rifa del mes y Reto de Constancia
//   Comisiones    → (solo Líder) Rango y comisiones
//   Inscripciones → Solicitar inscripción
// La pestaña abierta queda en la dirección (#premios, etc.), y el enlace
// "Solicitar inscripción" del menú de perfil (#solicitar-inscripcion)
// abre directo la de Inscripciones.
document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('mw2')) return;
  const layout = document.querySelector('.account-layout');
  const columna = layout && layout.querySelector('.benefits-col');
  const perfil = layout && layout.querySelector('.profile-card');
  if (!layout || !columna || !perfil) return;

  const grupoDe = (panel) => {
    if (panel.id === 'tarjetaVirtualPanel') return 'perfil';
    if (panel.querySelector('#misSolicitudesLista')) return 'inscripciones';
    if (panel.querySelector('#cuentaRankFill, #ticketNiveles')) return 'comisiones';
    return 'premios';
  };
  const bloques = [{ el: perfil, grupo: 'perfil' }]
    .concat([...columna.children].filter(el => el.classList.contains('benefit-panel')).map(el => ({ el, grupo: grupoDe(el) })));

  const NOMBRES = { perfil: 'Perfil', premios: 'Premios', comisiones: 'Comisiones', inscripciones: 'Inscripciones' };
  const grupos = Object.keys(NOMBRES).filter(g => bloques.some(b => b.grupo === g));
  if (grupos.length < 2) return;

  const barra = document.createElement('div');
  barra.className = 'pestanas cuenta-pestanas';
  barra.setAttribute('role', 'tablist');
  barra.setAttribute('aria-label', 'Secciones de Mi cuenta');
  barra.innerHTML = grupos.map(g => `<button type="button" class="pestana" role="tab" id="pestana-${g}" data-pestana="${g}" aria-selected="false">${NOMBRES[g]}</button>`).join('');
  layout.parentNode.insertBefore(barra, layout);

  const mostrar = (grupo, { foco = false, recordar = true } = {}) => {
    if (!grupos.includes(grupo)) grupo = grupos[0];
    barra.querySelectorAll('[data-pestana]').forEach(b => {
      const activa = b.dataset.pestana === grupo;
      b.setAttribute('aria-selected', String(activa));
      b.tabIndex = activa ? 0 : -1;
      if (activa && foco) b.focus();
    });
    bloques.forEach(({ el, grupo: g }) => {
      el.classList.toggle('pestana-oculta', g !== grupo);
      el.setAttribute('role', 'tabpanel');
      el.setAttribute('aria-labelledby', `pestana-${g}`);
    });
    layout.dataset.pestana = grupo;
    if (recordar) {
      try { history.replaceState(null, '', grupo === grupos[0] ? location.pathname + location.search : `#${grupo}`); } catch (e) { /* sin historial */ }
    }
  };

  barra.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pestana]');
    if (b) mostrar(b.dataset.pestana);
  });
  // Flechas ← → entre pestañas, como en cualquier lista de pestañas.
  barra.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = grupos.indexOf(layout.dataset.pestana);
    const siguiente = grupos[(i + (e.key === 'ArrowRight' ? 1 : -1) + grupos.length) % grupos.length];
    e.preventDefault();
    mostrar(siguiente, { foco: true });
  });

  const desdeHash = () => {
    const h = location.hash.replace('#', '');
    if (h === 'solicitar-inscripcion') return 'inscripciones';
    return grupos.includes(h) ? h : grupos[0];
  };
  mostrar(desdeHash(), { recordar: false });
  window.addEventListener('hashchange', () => mostrar(desdeHash(), { recordar: false }));
});
