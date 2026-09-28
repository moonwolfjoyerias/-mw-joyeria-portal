# Conectar la beta a Firebase (Fase 2: Auth + Catálogo)

Esta fase conecta dos cosas a Firebase real:

1. **Login (Auth)** — las 30 cuentas de ejemplo (21 personas + 9 cuentas internas) pueden entrar con su mismo usuario/contraseña de siempre, pero ahora verificado por Firebase Authentication en vez de comparado en el navegador.
2. **Catálogo** — los productos (Staff/Encargado/Admin los editan, Emprendedora/Líder los navegan) se leen y guardan en Firestore, compartidos entre todos en tiempo real.

Todo lo demás (Personas/cuentas, Apartados, Comisiones, Plan MW, Nómina, Actividades, etc.) **sigue en localStorage sin cambios** — queda para una fase siguiente. Mientras `MODO_DEMO` esté en `true`, nada de esto se activa: el portal sigue funcionando exactamente igual que hoy.

## 1. Crear el proyecto de Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/) → **Agregar proyecto** → dale un nombre (ej. `mw-joyeria`) → puedes desactivar Google Analytics si no lo necesitas.
2. Dentro del proyecto, ve a **Authentication** → pestaña **Sign-in method** → habilita el proveedor **Correo electrónico/contraseña**.
3. Ve a **Firestore Database** → **Crear base de datos** → elige **modo producción** → selecciona la región más cercana (ej. `us-central` o `southamerica-east1`).
4. Si vas a usar fotos de productos u otros archivos, ve a **Storage** → **Comenzar** (opcional para esta fase; el Catálogo funciona sin esto si las imágenes son URLs externas).
5. Ve a **Configuración del proyecto** (ícono de engrane) → pestaña general → sección **Tus apps** → **Agregar app** → ícono `</>` (Web) → dale un nombre → **Registrar app**. Copia el objeto `firebaseConfig` que te muestra (se ve así):

   ```js
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "...",
   };
   ```

6. Pégame ese objeto (o pégalo tú mismo en `js/firebase-config.js`, ver paso 2).

## 2. Configurar el portal con tus credenciales

Abre `js/firebase-config.js` y:

- Reemplaza el objeto `FIREBASE_CONFIG` vacío con el `firebaseConfig` que copiaste.
- Cambia `MODO_DEMO = true` a `MODO_DEMO = false`.

Nada más cambia — el resto del archivo ya está listo para detectar esto automáticamente.

## 3. Publicar las reglas de seguridad de Firestore

Ve a **Firestore Database** → pestaña **Reglas** → borra el contenido de ejemplo → pega el contenido completo de [`firestore.rules`](firestore.rules) (está en la raíz de este repo) → **Publicar**.

(Alternativa con la CLI de Firebase, si la tienes instalada: `firebase deploy --only firestore:rules` desde la raíz del repo, con `firebase.json` apuntando a este archivo.)

Estas reglas cubren `users/{uid}` (perfil/rol de cada cuenta) y `productos/{id}` (Catálogo); todo lo demás queda denegado por defecto hasta su propia migración, para que nadie pueda leer/escribir esas colecciones desde el navegador antes de tiempo.

## 4. Sembrar las cuentas existentes en Firebase Auth

Esto crea, en Firebase Auth + Firestore, una cuenta por cada persona/cuenta interna que ya existe como dato de ejemplo en el portal (MW0001, staff01, admin01, etc.), para que el equipo pueda seguir entrando con lo mismo que ya conoce.

1. Descarga tu clave de cuenta de servicio: **Configuración del proyecto** → pestaña **Cuentas de servicio** → **Generar nueva clave privada**. Guarda el `.json` en un lugar seguro **fuera de este repositorio** (nunca lo subas a git).
2. Instala la dependencia (una sola vez):
   ```
   npm install firebase-admin
   ```
3. Corre el script de siembra:
   ```
   node scripts/seed-firebase.js /ruta/a/tu-service-account.json
   ```
   Verás una línea `✓ Creada: ...` por cada cuenta. Es seguro volver a correrlo si algo falla a la mitad — a las cuentas que ya existen solo les actualiza el perfil, no las duplica.

## 5. Probar

Con `MODO_DEMO = false` y tu configuración pegada:

- Abre `login.html` y entra con cualquier usuario/contraseña de ejemplo que ya conoces (ej. `admin01`). Debe pasar por Firebase Auth real ahora (lo notarás porque tarda un poco más que antes, ya que hace una llamada de red).
- Entra a Catálogo (Staff/Encargado/Admin) y agrega o edita un producto — ábrelo en otra pestaña/dispositivo con otra cuenta y confirma que el cambio se ve ahí también (eso confirma que ya está en Firestore, no solo en tu navegador).
- Entra como Emprendedora/Líder y confirma que el Catálogo público se ve igual y que "Apartar" sigue funcionando (descuenta existencia correctamente).

## Si algo falla

- **No puedo iniciar sesión / "Usuario o contraseña incorrectos"**: confirma que corriste el script de siembra (paso 4) y que el usuario/contraseña son exactamente los de siempre — el script usa el mismo usuario/contraseña que ya existían en los datos de ejemplo.
- **Catálogo aparece vacío**: la primera vez que alguien con rol Staff/Encargado/Admin entra en modo Firebase, el Catálogo se guarda desde lo que tenga en pantalla. Si ves vacío, revisa la consola del navegador (F12) por errores de permisos — normalmente significa que las reglas del paso 3 no se publicaron o el usuario no tiene un perfil (`users/{uid}`) con `rol` correcto.
- **Quiero volver a modo demo temporalmente**: pon `MODO_DEMO = true` de nuevo en `js/firebase-config.js` — no borra nada de Firebase, solo hace que el portal ignore la configuración real y vuelva a usar localStorage.

## Qué queda pendiente para después de la beta

Personas/cuentas y Apartados siguen en localStorage por ahora (ver `AUDITORIA-FIREBASE.md` para el plan completo). Cuando quieras migrarlos, avísame y seguimos con el mismo patrón incremental que usamos aquí.
