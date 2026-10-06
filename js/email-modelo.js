// MW JOYERÍA — Correos reales al equipo (FEAT-08, primera prueba)
//
// Usa EmailJS (envío 100% desde el navegador, sin backend ni Firebase
// Blaze) — ver js/email-config.js para las credenciales y cómo
// activarlas. Mientras EMAILJS_CONFIG.publicKey esté vacío, toda esta
// capa es un no-op silencioso: ninguna acción real del portal (agregar
// un producto, crear un evento, apartar una pieza) depende de que el
// correo se llegue a mandar.
//
// Quién recibe qué (acordado con el equipo):
//   - Nuevo evento de calendario / nueva pieza en el catálogo →
//     automático, a todas las Emprendedoras/Líderes activas.
//   - Aviso administrativo/marketing → manual, desde Configuración →
//     Correos, con la audiencia que Admin elija.
// No se manda correo por cada notificación interna (apartados,
// solicitudes, etc.) — sería demasiado volumen para el plan gratis de
// EmailJS y no es lo que se pidió.

let _emailjsListo = false;

function _emailjsDisponible() {
  return !!(EMAILJS_CONFIG?.publicKey && EMAILJS_CONFIG?.serviceId && EMAILJS_CONFIG?.templateId && typeof emailjs !== 'undefined');
}

function _inicializarEmailJS() {
  if (_emailjsListo) return true;
  if (!_emailjsDisponible()) return false;
  emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
  _emailjsListo = true;
  return true;
}

// Un solo correo. Nunca truena ni interrumpe la acción que lo disparó
// si EmailJS no está configurado todavía o si la red/el servicio
// falla — el correo es un plus, no un requisito para que la acción
// real (guardar el producto, crear el evento) se complete.
async function enviarCorreo({ paraCorreo, paraNombre, asunto, mensaje, ctaLink, ctaTexto }) {
  if (!paraCorreo || !_inicializarEmailJS()) return;
  try {
    await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
      to_email: paraCorreo,
      to_name: paraNombre || '',
      subject: asunto || 'MW Joyería',
      message: mensaje || '',
      cta_link: ctaLink || '',
      cta_label: ctaTexto || ''
    });
  } catch (error) {
    // noop — ver comentario de arriba.
  }
}

// Mismo correo a una lista de personas — uno por uno, con una pequeña
// pausa entre cada uno: el plan gratis de EmailJS limita cuántas
// peticiones acepta por segundo, y mandar varias a la vez (Promise.all)
// chocaría con ese límite y perdería correos sin avisar a nadie.
async function enviarCorreoMasivo(destinatarios, { asunto, mensaje, ctaLink, ctaTexto } = {}) {
  for (const persona of destinatarios) {
    await enviarCorreo({ paraCorreo: persona.correo, paraNombre: persona.nombre, asunto, mensaje, ctaLink, ctaTexto });
    await new Promise(resolve => setTimeout(resolve, 350));
  }
}

// A quién le toca un correo según la audiencia elegida — mismo
// criterio de "activa" que ya usa el resto del portal (una cuenta de
// baja/inactiva no debe seguir recibiendo correos). Se protege con
// typeof porque no todas las páginas que mandan correo cargan
// personas-ejemplo.js/cuentas-internas-modelo.js (ej. admin-calendario.html
// solo necesita la audiencia 'emprendedoras_lideres').
function obtenerDestinatariosCorreoPorAudiencia(audiencia) {
  const personas = typeof obtenerPersonas === 'function' ? obtenerPersonas() : [];
  const emprendedorasLideres = personas
    .filter(p => ['emprendedora', 'lider'].includes(p.rol) && p.estado === 'activa' && p.correo)
    .map(p => ({ correo: p.correo, nombre: p.nombre }));

  const cuentasInternas = typeof obtenerCuentasInternas === 'function' ? obtenerCuentasInternas() : [];
  const porRolInterno = (rol) => cuentasInternas
    .filter(c => c.rol === rol && c.activa !== false && c.correo)
    .map(c => ({ correo: c.correo, nombre: c.nombre }));

  if (audiencia === 'emprendedoras_lideres') return emprendedorasLideres;
  if (audiencia === 'staff') return porRolInterno('staff');
  if (audiencia === 'encargado') return porRolInterno('encargado');
  if (audiencia === 'admin') return porRolInterno('admin');
  if (audiencia === 'todos') {
    return [...emprendedorasLideres, ...porRolInterno('staff'), ...porRolInterno('encargado'), ...porRolInterno('admin')];
  }
  return [];
}

// ============================================================
// DISPARADORES AUTOMÁTICOS (llamados desde admin-calendario.js /
// encargado-calendario.js / admin-catalogo.js / encargado-catalogo.js
// tras guardar — un solo lugar para los dos, ya que cada rol tiene su
// propio archivo con su propia función agregarEvento()/agregarProducto()).
// ============================================================

function enviarCorreoNuevoEventoCalendario(evento) {
  const destinatarios = obtenerDestinatariosCorreoPorAudiencia('emprendedoras_lideres');
  if (!destinatarios.length) return;
  const fecha = evento.fecha ? new Date(`${evento.fecha}T00:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  const detalle = [
    fecha ? `Fecha: ${fecha}${evento.hora ? ` a las ${evento.hora}` : ''}.` : '',
    evento.lugarTexto ? `Lugar: ${evento.lugarTexto}.` : ''
  ].filter(Boolean).join(' ');
  enviarCorreoMasivo(destinatarios, {
    asunto: `Nuevo evento: ${evento.titulo}`,
    mensaje: `Hay un nuevo evento en el calendario de MW Joyería: "${evento.titulo}". ${detalle}\n\n${evento.descripcion || ''}`.trim()
  });
}

function enviarCorreoNuevoProductoCatalogo(producto) {
  const destinatarios = obtenerDestinatariosCorreoPorAudiencia('emprendedoras_lideres');
  if (!destinatarios.length) return;
  enviarCorreoMasivo(destinatarios, {
    asunto: `Nueva pieza en el catálogo: ${producto.nombre}`,
    mensaje: `Ya está disponible una nueva pieza en el catálogo de MW Joyería: "${producto.nombre}". ${producto.descripcion || ''}`.trim()
  });
}
