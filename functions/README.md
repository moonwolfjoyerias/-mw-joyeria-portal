# Correo de las notificaciones de Emprendedoras/Líderes

`index.js` manda por correo cada notificación **personal** de una e/l (apartados por vencer o cancelados, piezas quitadas, pagos, comisiones, solicitudes aprobadas, etc.) en cuanto se crea. Staff, Encargado y Admin siguen solo con la campana. No se manda correo por las piezas nuevas del catálogo.

- Corre en el servidor de Firebase, así que el correo sale aunque nadie tenga el portal abierto. También cubre los avisos que crea BRILLO MW.
- Envía con [Brevo](https://www.brevo.com): 300 correos al día gratis.
- Manda un solo correo por notificación. En la colección `correosNotificaciones` de Firestore queda el estado de cada envío: `enviado`, `sin_correo` (la e/l no tiene correo registrado) o `error` (con el detalle).
- Usa el campo **Correo** de cada e/l (Admin → Emprendedoras/Líderes). Si la cuenta está de baja o inactiva, no se le manda nada.

## Activarlo (una sola vez)

Requiere que el proyecto `moonwolf-portal` ya esté en el **plan Blaze**.

### 1. Brevo

1. Crea una cuenta gratis en https://www.brevo.com.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: escribe el correo que aparecerá como remitente (por ejemplo, el de MW Joyería) y confírmalo desde el mensaje que te llega.
3. **SMTP & API → API Keys → Generate a new API key**. Copia la clave y no la pegues en ningún archivo del repositorio, porque es público.

### 2. Ubicación de tu Firestore

En Firebase Console → **Firestore Database**, revisa la ubicación de la base de datos:

| Ubicación de Firestore | Región que vas a escribir |
| --- | --- |
| `nam5` | `us-central1` |
| `eur3` | `europe-west1` |
| Una región sola (ej. `us-east1`) | Esa misma |

### 3. Publicar la función desde Google Cloud Shell (no hay que instalar nada)

1. Abre https://shell.cloud.google.com/?project=moonwolf-portal con la cuenta de Google dueña del proyecto.
2. Pega estos comandos, uno por uno:

```bash
git clone https://github.com/moonwolfjoyerias/-mw-joyeria-portal.git
cd ./-mw-joyeria-portal/functions && npm install && cd ..
npx firebase-tools login --no-localhost
npx firebase-tools functions:secrets:set BREVO_API_KEY
npx firebase-tools deploy --only functions
```

- `login`: abre el link que aparece, autoriza con la misma cuenta y pega el código de vuelta.
- `secrets:set`: pega la API key de Brevo cuando la pida. Queda guardada en Secret Manager de Google, no en el código.
- `deploy` pregunta tres datos:
  - `REMITENTE_CORREO`: el correo que verificaste en Brevo.
  - `REMITENTE_NOMBRE`: Enter para dejar "MW Joyería".
  - `REGION_FUNCIONES`: la región del paso 2.

### 4. Probar

1. Ponle tu propio correo a una e/l de prueba.
2. Genera un aviso para ella. Por ejemplo, en Apartados quítale una pieza o marca "No depositó".
3. Revisa la bandeja de entrada y también la de spam.
4. En Firestore → `correosNotificaciones` aparece el estado de ese envío.

Si algo falla, el detalle aparece en Firebase Console → **Functions → Registros**. La primera vez, el `deploy` también activa varias APIs de Google. Si marca un error de permisos de Eventarc, espera unos 5 minutos y vuelve a correr el `deploy`, porque los permisos tardan en propagarse.

## Volver a publicar después de un cambio en `index.js`

En Cloud Shell, desde la carpeta del repositorio:

```bash
git pull && npx firebase-tools deploy --only functions
```

## Costo

Con el volumen del portal queda dentro de lo gratuito: Cloud Functions incluye 2 millones de ejecuciones al mes, Brevo da 300 correos al día y la clave en Secret Manager cuesta centavos de dólar al mes. Si un día se pasan de 300 correos diarios, Brevo deja de enviar hasta el día siguiente (queda `error` en `correosNotificaciones`) o se puede contratar su plan de pago.
