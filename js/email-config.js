// MW JOYERÍA — Configuración de EmailJS (envío real de correos)
//
// Mismo patrón que js/firebase-config.js: mientras publicKey esté
// vacío, el portal sigue funcionando exactamente igual que hoy —
// enviarCorreo()/enviarCorreoMasivo() (ver js/email-modelo.js) se
// vuelven un no-op silencioso, nada de lo que ya funciona (agregar un
// producto, crear un evento, apartar una pieza) depende de que el
// correo se llegue a mandar.
//
// Para activarlo de verdad:
//   1. Crea una cuenta gratis en https://www.emailjs.com/
//   2. Email Services → Add New Email Service → conecta el correo que
//      va a aparecer como remitente de "MW Joyería" (un Gmail normal
//      funciona bien para empezar).
//   3. Email Templates → Create New Template. En el cuerpo de la
//      plantilla usa EXACTAMENTE estas variables (es lo único que este
//      portal manda):
//        {{to_name}}   — nombre de quien recibe
//        {{subject}}   — asunto del correo
//        {{message}}   — cuerpo del mensaje
//        {{cta_link}}  — link opcional (puede venir vacío)
//        {{cta_label}} — texto del botón/link opcional (puede venir vacío)
//      Y en la pestaña "Settings" de esa misma plantilla, en el campo
//      "To Email" pon {{to_email}} — si no, EmailJS no sabe a quién
//      mandarlo.
//   4. Account → General → copia tu "Public Key".
//   5. Pega los 3 valores de abajo. No hace falta tocar nada más del
//      código — ya está todo conectado (calendario, catálogo y el
//      aviso manual de Admin en Configuración → Correos).
const EMAILJS_CONFIG = {
  publicKey: '',
  serviceId: '',
  templateId: ''
};
