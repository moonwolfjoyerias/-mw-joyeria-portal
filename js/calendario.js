// MW JOYERÍA — Calendario
// Depende de EVENTOS_EJEMPLO (eventos-ejemplo.js) y de formatearFechaCorta
// (definida en portal-common.js).

const DIAS_SEMANA_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const hoy = new Date();
const mesActualIdx = hoy.getFullYear() * 12 + hoy.getMonth(); // índice absoluto de mes, para acotar navegación
let mesMostradoIdx = mesActualIdx;

document.addEventListener('DOMContentLoaded', () => {
  renderCalendario();
  renderProximosEventos();

  document.getElementById('mesAnteriorBtn').addEventListener('click', () => {
    mesMostradoIdx -= 1;
    renderCalendario();
  });
  document.getElementById('mesSiguienteBtn').addEventListener('click', () => {
    mesMostradoIdx += 1;
    renderCalendario();
  });
  document.getElementById('hoyBtn').addEventListener('click', () => {
    mesMostradoIdx = mesActualIdx;
    renderCalendario();
  });
});

function idxToYearMonth(idx) {
  return { year: Math.floor(idx / 12), month: idx % 12 };
}

function renderCalendario() {
  const { year, month } = idxToYearMonth(mesMostradoIdx);
  document.getElementById('mesTitulo').textContent = `${MESES_LARGO[month]} ${year}`;

  // Acotar navegación a [mesActual - 1, mesActual + 1]
  document.getElementById('mesAnteriorBtn').disabled = mesMostradoIdx <= mesActualIdx - 1;
  document.getElementById('mesSiguienteBtn').disabled = mesMostradoIdx >= mesActualIdx + 1;

  const primerDiaSemana = new Date(year, month, 1).getDay(); // 0=domingo
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const diasMesAnterior = new Date(year, month, 0).getDate();

  const eventosPorFecha = {};
  EVENTOS_EJEMPLO.forEach(ev => {
    (eventosPorFecha[ev.fecha] = eventosPorFecha[ev.fecha] || []).push(ev);
  });

  const hoyStr = hoy.toISOString().slice(0, 10);
  const celdas = [];

  // Días del mes anterior (relleno)
  for (let i = primerDiaSemana - 1; i >= 0; i--) {
    celdas.push({ dia: diasMesAnterior - i, otroMes: true });
  }
  // Días del mes actual
  for (let d = 1; d <= diasEnMes; d++) {
    const fechaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    celdas.push({ dia: d, otroMes: false, fechaStr, esHoy: fechaStr === hoyStr, eventos: eventosPorFecha[fechaStr] || [] });
  }
  // Relleno final hasta completar semanas de 7
  while (celdas.length % 7 !== 0) {
    celdas.push({ dia: celdas.length % 7, otroMes: true });
  }

  const grid = document.getElementById('calendarGrid');
  const weekdaysHtml = DIAS_SEMANA_LARGO.map(d => `<div class="calendar-weekday">${d}</div>`).join('');
  const celdasHtml = celdas.map(c => `
    <div class="calendar-day ${c.otroMes ? 'other-month' : ''} ${c.esHoy ? 'is-today' : ''}">
      <span class="day-num">${c.dia}</span>
      ${(c.eventos || []).map(ev => `
        <button class="calendar-event-pill ${ev.tipo}" data-evento="${ev.id}">${ev.titulo}</button>
      `).join('')}
    </div>
  `).join('');

  grid.innerHTML = weekdaysHtml + celdasHtml;

  grid.querySelectorAll('[data-evento]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEvento(btn.getAttribute('data-evento')));
  });
}

function renderProximosEventos() {
  const wrap = document.getElementById('upcomingList');
  if (!wrap) return;
  const hoyStr = hoy.toISOString().slice(0, 10);
  const proximos = EVENTOS_EJEMPLO
    .filter(ev => ev.fecha >= hoyStr)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 6);

  if (proximos.length === 0) {
    wrap.innerHTML = '<p class="upcoming-empty">No hay eventos próximos por ahora.</p>';
    return;
  }

  wrap.innerHTML = proximos.map(ev => {
    const { dia, mes, diaSemana } = formatearFechaCorta(ev.fecha);
    return `
      <button class="upcoming-card ${ev.tipo}" data-evento="${ev.id}">
        <div class="up-date">
          <span class="up-dow">${diaSemana}</span>
          <span class="up-daynum">${dia}</span>
          <span class="up-mon">${mes}</span>
        </div>
        <div>
          <h4>${ev.titulo}</h4>
          <div class="up-meta">${ev.hora} · ${ev.lugarTexto}</div>
          <div class="up-desc">${ev.descripcion}</div>
        </div>
      </button>
    `;
  }).join('');

  wrap.querySelectorAll('[data-evento]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEvento(btn.getAttribute('data-evento')));
  });
}

function abrirModalEvento(id) {
  const ev = EVENTOS_EJEMPLO.find(e => e.id === id);
  if (!ev) return;
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  const { dia, mes } = formatearFechaCorta(ev.fecha);
  const etiquetaTipo = ev.tipo === 'presencial' ? 'Presencial' : 'Virtual';
  const textoBoton = ev.tipo === 'presencial' ? 'Ver ubicación' : 'Unirme por Zoom';

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    ${ev.tieneFoto ? `
      <div class="event-modal-photo"><img src="../assets/images/isotipo-morado.png" alt=""></div>
    ` : ''}
    <h3>${ev.titulo}</h3>
    <div class="event-modal-meta">
      <span class="badge">${etiquetaTipo}</span>
      <span>${dia} ${mes} · ${ev.hora}</span>
    </div>
    <p class="modal-sub" style="margin-bottom:1.2rem;">${ev.descripcion}</p>
    <p class="modal-sub" style="margin-bottom:1rem;">📍 ${ev.lugarTexto}</p>
    <a href="${ev.enlace}" target="_blank" rel="noopener" class="btn btn-primary" style="width:100%; display:block; text-align:center; box-sizing:border-box;">${textoBoton}</a>
  `;
  overlay.classList.add('open');
}
