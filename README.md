# Aurea Finanzas · HTML, CSS, JavaScript, Node.js y PostgreSQL

Aplicación de control de finanzas con dos temas, oscuro elegante y claro cálido: frontend en HTML, CSS y JavaScript, y backend en **Node.js + Express + PostgreSQL**.
Incluye la página principal, el registro y el login, ambos con **validación en tiempo real** y avisos de error. El backend crea cuentas, verifica contraseñas hasheadas y mantiene la sesión con una cookie.
Tras iniciar sesión se abre el **panel de gastos**: alta, edición y eliminación de gastos, filtros por categoría y rango de fechas, gráficas de gasto mensual y por categoría, y exportación a CSV.

---

## 1. Estructura de archivos

```
login/
├── public/
│   ├── index.html               ← página principal
│   ├── registro.html            ← formulario de crear cuenta
│   ├── login.html               ← inicio de sesión con validación
│   ├── gastos.html              ← panel de gastos (requiere sesión)
│   ├── css/
│   │   └── styles.css           ← estilos compartidos
│   └── js/
│       ├── password-toggle.js   ← mostrar/ocultar contraseñas (compartido)
│       ├── registro.js          ← validación en tiempo real del registro
│       ├── login.js             ← validación y aviso de credenciales del login
│       └── gastos.js            ← CRUD, filtros, gráficas y CSV del panel
│
├── server/                      ← backend Express + PostgreSQL
│   ├── package.json
│   ├── .env                     ← variables privadas (no se sube a Git)
│   ├── .env.example             ← plantilla de variables
│   ├── .gitignore
│   └── src/
│       ├── index.js             ← arranque del servidor
│       ├── app.js               ← configuración de Express
│       ├── config.js            ← lectura de variables de entorno
│       ├── routes/
│       │   ├── auth.routes.js
│       │   └── gastos.routes.js
│       ├── controllers/
│       │   ├── auth.controller.js
│       │   └── gastos.controller.js
│       ├── middlewares/
│       │   ├── rateLimiters.js
│       │   ├── requireAuth.js   ← exige sesión en API y páginas
│       │   └── errorHandler.js
│       ├── utils/
│       │   ├── categorias.js    ← lista canónica de categorías
│       │   └── validators.js    ← validación de auth y de gastos
│       └── db/
│           ├── pool.js          ← pool de conexiones
│           ├── setup.js         ← crea las tablas al arrancar
│           └── schema.sql       ← tablas users y expenses
│
└── README.md
```

---

## 2. Cómo ver el proyecto

### Requisitos

- Node.js 22.9 o superior (probado con Node 24).
- PostgreSQL 14 o superior en marcha (probado con PostgreSQL 16).

### Primera vez

```bash
# Desde la raíz del proyecto
cd server
npm install

# Copiar la plantilla de variables y generar un secreto de sesión.
cp .env.example .env
openssl rand -hex 32   # pega el resultado en SESSION_SECRET dentro de .env

# Crear la base de datos (una sola vez).
# Usa como propietario tu usuario del sistema (debe existir como rol en PostgreSQL).
sudo -u postgres createdb -O "$USER" aurea_finanzas_db

# Arrancar en modo desarrollo (reinicia al guardar cambios)
npm run dev
```

Luego abre `http://localhost:3000`.

- `index.html` es la portada pública.
- `registro.html` y `login.html` permiten crear la cuenta e iniciar sesión.
- Al iniciar sesión se redirige automáticamente a `gastos.html`.
- Si intentas abrir `gastos.html` sin sesión, el servidor te devuelve al login.

Express sirve también la carpeta `public/`, así que frontend y API comparten el mismo origen. Eso evita configurar CORS y hace que las rutas relativas `/api/...` funcionen sin tocar el JavaScript.

### Flujo de uso

1. Entra en la portada y pulsa «Crear cuenta» o abre `registro.html`.
2. Completa el registro. La cuenta se crea, pero **no se inicia sesión automáticamente**: te redirige al login.
3. Inicia sesión. La API crea la sesión y la cookie `aurea.sid`, y el navegador pasa a `gastos.html`.
4. En el panel puedes crear gastos, filtrarlos, editarlos, eliminarlos, ver las gráficas y exportar el CSV.
5. «Salir» destruye la sesión en el servidor y te devuelve al login.

### Comandos disponibles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Arranca con `node --watch` y recarga al guardar |
| `npm start` | Arranca sin vigilancia de cambios (modo normal) |

### Si solo quieres ver el diseño sin backend

```bash
cd public
python3 -m http.server 5500
```

Abre `http://localhost:5500`. Las validaciones de los formularios funcionan, pero el envío fallará porque no hay API. `gastos.html` se podrá abrir, pero no tendrá sesión ni datos. Para probar el registro, el login y los gastos de verdad, usa `npm run dev` en `server/`.

### Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Falta la variable de entorno DATABASE_URL` | No existe `server/.env` | `cp .env.example .env` y revisa `DATABASE_URL`. |
| `ECONNREFUSED` al arrancar | PostgreSQL no está en marcha | Inicia el servicio: `sudo systemctl start postgresql`. |
| `database "aurea_finanzas_db" does not exist` | No se creó la base | Ejecuta el `createdb` de la primera vez. |
| `EADDRINUSE: port 3000` | Otro proceso usa el puerto | Cambia `PORT` en `.env` o detén el proceso que lo ocupa. |
| `gastos.html` me devuelve al login | No hay sesión o caducó | Inicia sesión de nuevo. |
| `401` en `/api/gastos` | La cookie de sesión no existe o expiró | Inicia sesión y comprueba que el navegador acepta cookies. |
| Todos los usuarios pierden la sesión | Cambiaste `SESSION_SECRET` | Deja un secreto estable; al cambiarlo se invalidan las cookies anteriores. |
| No aparecen gastos recién creados | El filtro por defecto es el año actual, o hay una categoría/fecha activa | Pulsa «Ver todo» o ajusta el rango. |
| `La categoría no es válida` | Se envió una categoría fuera de la lista | Usa una de las categorías canónicas. |
| El navegador muestra estilos antiguos | Caché del navegador | Recarga forzada con `Ctrl+Shift+R`. |

---

## 3. Cómo se conectan HTML, CSS y JavaScript

En el `<head>` de cada HTML está esta línea:

```html
<link rel="stylesheet" href="css/styles.css">
```

- `link` carga un recurso externo; no muestra contenido.
- `rel="stylesheet"` indica que es una hoja de estilos.
- `href` es una ruta **relativa al HTML**: como `index.html` está en `public/` y el CSS en `public/css/`, se escribe `css/styles.css`.
- La misma hoja se comparte entre todas las páginas: cambias un color una vez y se actualiza todo el sitio.

El navegador sigue este orden:

1. Lee el HTML y construye el árbol del documento.
2. Descarga el CSS y lo aplica según los **selectores**.
3. Si dos reglas chocan, gana la de mayor especificidad (o la última si empatan).

### Anatomía de una regla CSS

```css
.hero-title {                          /* selector: class="hero-title" */
  font-family: var(--font-display);    /* propiedad: valor */
  font-size: 4rem;
  color: var(--text);
}
```

| Selector | Qué selecciona | Ejemplo en el proyecto |
|---|---|---|
| `.clase` | todos los elementos con esa clase | `.btn`, `.hero-title` |
| `#id` | el elemento con ese id (único) | `#registro-form` |
| `etiqueta` | todas las etiquetas de ese tipo | `body`, `a`, `input` |
| `padre hijo` | descendientes | `.hero-points li` |
| `:hover` | al pasar el ratón | `.btn-primary:hover` |
| `:focus-visible` | al enfocar con teclado | `:focus-visible` |
| `.padre.is-invalid .input` | input dentro de un campo con error | estados de validación |
| `@media` | según el tamaño de pantalla | `@media (max-width: 900px)` |

### Cómo se carga el JavaScript

Cada página carga solo los scripts que necesita, siempre al final del `<body>` y con `defer`:

| Página | Scripts |
|---|---|
| `index.html` | Ninguno propio; es una portada informativa. |
| `registro.html` | `password-toggle.js`, `registro.js` |
| `login.html` | `password-toggle.js`, `login.js` |
| `gastos.html` | `gastos.js` |

`defer` descarga el archivo en paralelo, pero espera a que el HTML esté leído antes de ejecutarlo. Por eso los `document.querySelector(...)` encuentran todos los elementos.

`password-toggle.js` se comparte entre login y registro. No usa ids concretos: busca botones con `data-password-toggle` y el input indicado en ese atributo. Así el mismo archivo sirve para varios campos sin duplicar código.

### Cómo se comunica el frontend con el backend

- El frontend y la API comparten origen (`http://localhost:3000`), así que las llamadas usan rutas relativas: `/api/auth/login`, `/api/gastos`, etc.
- `fetch` envía y recibe JSON. En `gastos.js`, la función `api()` centraliza las cabeceras, el parseo y el manejo de errores.
- Las cookies se envían automáticamente al ser el mismo origen. El JavaScript **no** lee la cookie: solo el servidor sabe si la sesión es válida.
- Si una petición responde `401`, `api()` redirige a `login.html`; el resto de errores se muestran como aviso sin romper la página.
- Los datos del usuario se insertan con `textContent` y `createElement`, no con `innerHTML`. Así un nombre de gasto con `<script>` se muestra como texto y no se ejecuta (protección básica frente a XSS).

---

## 4. Etiquetas usadas y su función

| Etiqueta | Función |
|---|---|
| `<!DOCTYPE html>` | Indica al navegador que el documento es HTML5. |
| `<html lang="es">` | Raíz del documento; `lang` declara el idioma. |
| `<head>` | Metadatos: no se ve en la página. |
| `<meta charset="UTF-8">` | Codificación de caracteres; permite tildes y símbolos. |
| `<meta name="viewport" ...>` | Adapta el diseño al ancho real del móvil. |
| `<meta name="description" ...>` | Descripción que usan los buscadores. |
| `<title>` | Texto de la pestaña del navegador. |
| `<link>` | Carga recursos externos (CSS, fuentes…). |
| `<script src="..." defer>` | Carga JavaScript sin bloquear el HTML; se ejecuta al terminar de leerlo. |
| `<body>` | Todo el contenido visible. |
| `<header>` | Cabecera de la página o de una sección. |
| `<nav>` | Agrupa enlaces de navegación. |
| `<main>` | Contenido principal único del documento. |
| `<section>` | Bloque temático (hero, beneficios, registro…). |
| `<article>` | Contenido con sentido propio (tarjetas de beneficios y de resumen). |
| `<aside>` | Contenido complementario (panel de marca del login o gráficas del panel). |
| `<div>` | Contenedor genérico para agrupar y aplicar CSS. |
| `<h1>` … `<h3>` | Títulos por jerarquía. Un solo `h1` por página. |
| `<p>` | Párrafo de texto. |
| `<a href="...">` | Enlace. `href` es el destino. |
| `<ul>` / `<ol>` / `<li>` | Lista sin orden / con orden / cada elemento. |
| `<span>` | Fragmento de texto en línea para darle estilo. |
| `<em>` / `<strong>` | Énfasis / importancia. |
| `<small>` | Texto secundario o legal. |
| `<blockquote>` / `<cite>` | Cita y su autoría. |
| `<form>` | Agrupa controles y define cómo se envían (`action`, `method`). |
| `<label for="...">` | Etiqueta de un campo; su `for` coincide con el `id` del input. |
| `<input>` | Campo de entrada. `type` define el comportamiento. |
| `<input type="date">` | Selector de fecha nativo del navegador. |
| `<input type="number">` | Campo numérico; con `step="0.01"` acepta decimales. |
| `<select>` / `<option>` | Lista desplegable y cada una de sus opciones. |
| `<button type="submit">` | Envía el formulario. |
| `<button type="button">` | Botón que no envía el formulario; se usa con JavaScript. |
| `<table>` / `<thead>` / `<tbody>` | Tabla y sus zonas de encabezado y cuerpo. |
| `<tr>` / `<th>` / `<td>` | Fila, celda de encabezado y celda de datos. |
| `<svg>` | Gráfico vectorial (iconos). |
| `<footer>` | Pie de página. |

### Atributos importantes del formulario

```html
<form id="registro-form" action="/api/auth/registro" method="post">
  <input id="email" name="email" type="email" required
         aria-describedby="email-hint email-error">
  <p class="field-error" id="email-error" aria-live="polite"></p>
</form>
```

- `action`: ruta que recibe los datos. En el registro y el login coincide con el endpoint real de la API.
- `method="post"`: envía los datos en el cuerpo de la petición.
- `name`: **clave** con la que el backend lee el valor.
- `id`: conecta el `label` con el input y sirve para JavaScript.
- `required`, `type`, `minlength`, `maxlength`: validación nativa de respaldo.
- `aria-describedby`: asocia el campo con su ayuda y su mensaje de error.
- `aria-live="polite"`: el lector de pantalla anuncia el error cuando aparece.
- `autocomplete`: ayuda al navegador a rellenar datos.

> `registro.js` ejecuta `form.noValidate = true`. Así el navegador no muestra sus propios globos y la interfaz usa solo los mensajes personalizados. Si el JS no carga, los atributos `required` siguen funcionando como respaldo.

> El formulario de gastos no usa `action` ni `method`: `gastos.js` intercepta el evento `submit`, valida y envía los datos con `fetch`. Es el mismo resultado, pero permite actualizar la tabla y las gráficas sin recargar la página.

---

## 5. Cómo está organizado el CSS

`public/css/styles.css` está dividido en bloques numerados:

1. **Variables** (`:root`): colores, radios, fuentes y medidas.
2. **Reset y estilos base**: márgenes, fondos, tipografía y foco.
3. **Utilidades y layout**: `.container` centra el contenido con un ancho máximo.
4. **Botones**: base `.btn` y variantes `primary`, `outline`, `ghost`.
5. **Cabecera y navegación**.
6. **Hero** de la portada.
7. **Dashboard** decorativo de la portada.
8. **Secciones** de beneficios, pasos y llamada a la acción.
9. **Pie de página**.
10. **Autenticación**: layout de login y registro.
11. **Formulario**: campos, estados de validación, medidor de contraseña y mensajes.
12. **Animaciones**.
13. **Responsive**: media queries generales.
14. **Panel de gastos**: tarjetas, tabla, gráficas y *toast*.

### Variables (custom properties)

```css
:root {
  --bg: #080b10;
  --gold: #d4b483;
  --text: #e9eef5;
}

body {
  background-color: var(--bg);
  color: var(--text);
}
```

Se declaran con `--` y se usan con `var(--nombre)`. Cambiar `--gold` cambia todos los acentos del sitio.

### Fuentes

Hay dos familias declaradas en `:root`:

- `--font-display`: **Playfair Display**, para títulos y el nombre de marca.
- `--font-body`: **Inter**, para el texto general y los números.

Se cargan desde Google Fonts con un `<link>` en el `<head>` de las cuatro páginas. Ese enlace declara los pesos disponibles (Inter 300–700 y Playfair 400–600). Si se añade un peso nuevo en CSS, hay que incluirlo también en la URL de Google Fonts.

El `body` usa `--font-body`. Los títulos usan `--font-display`. En el panel de gastos, las cifras de resumen y de la tabla usan Inter con `font-weight: 300/500` y `font-variant-numeric: tabular-nums`, para que los dígitos queden alineados y con un aspecto más minimalista.

### Flexbox vs. Grid

- **Flexbox** (`display: flex`): una dirección (fila o columna). Se usa en la cabecera, botones, listas y gráfico de barras.
- **Grid** (`display: grid`): filas y columnas. Se usa en el hero, las tarjetas, los pasos y el layout de autenticación.

```css
.hero-grid {
  display: grid;
  grid-template-columns: 1.02fr 0.98fr; /* dos columnas proporcionales */
  gap: 5rem;
}
```

### Un detalle: alturas del gráfico

En `index.html` cada barra tiene `style="--h: 52%"`. Es una variable CSS escrita en el HTML:

```css
.chart-bars span {
  height: var(--h);
}
```

Así el HTML solo aporta el dato y el CSS decide el aspecto.

### El layout del login

El login reutiliza las mismas clases de autenticación que el registro (`.auth`, `.auth-aside`, `.auth-card`, `.field`, `.input`). La diferencia está en `body.page-login`:

```css
.page-login .auth {
  grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
}

.page-login .auth-aside {
  border-right: 0;
  border-left: 1px solid var(--border);
}
```

Así el formulario queda a la izquierda y el panel de marca a la derecha. En móvil, una media query pone el panel arriba con `order: -1` y deja el formulario debajo. Reutilizar clases evita duplicar estilos y mantiene las dos pantallas coherentes.

---

## 6. Validación en tiempo real (`public/js/registro.js`)

El script se carga al final de `registro.html`:

```html
<script src="js/registro.js" defer></script>
```

`defer` hace que se ejecute **después** de leer el HTML, sin bloquearlo.

### Reglas que se validan

| Campo | Reglas |
|---|---|
| Nombre | Obligatorio, entre 2 y 60 caracteres, al menos una letra. |
| Email | Obligatorio, formato `texto@dominio.ext`, máximo 120 caracteres. |
| Contraseña | Obligatoria, entre 8 y 72 caracteres, al menos una letra y un número. |
| Confirmar contraseña | Obligatoria y debe coincidir con la contraseña. |
| Términos | El checkbox debe estar marcado. |

Los mensajes están en español y se muestran debajo de cada campo.

### Cuándo se valida

| Evento | Qué ocurre |
|---|---|
| `input` | Se dispara con cada tecla en nombre, email y contraseñas. Valida al instante. |
| `change` | Se dispara al marcar o desmarcar el checkbox de términos. |
| `blur` | Al salir del campo se marca como “tocado” y se muestra el error si está vacío. |
| `submit` | Se validan todos los campos, se enfoca el primero con error y se bloquea el envío. |

El `Set` llamado `camposTocados` evita mostrar “Campo obligatorio” antes de que el usuario interactúe con el campo. Si ya escribió algo, el error aparece y desaparece en vivo.

### Cómo se pinta el estado

Cada campo está dentro de un `<div class="field">`. El JS añade o quita clases:

```html
<div class="field is-invalid"> ... </div>
<div class="field is-valid"> ... </div>
```

Y el CSS responde:

```css
.field.is-invalid .input {
  border-color: rgba(229, 145, 145, 0.6);
  background: rgba(229, 145, 145, 0.04);
}

.field.is-valid .input {
  border-color: rgba(99, 214, 163, 0.45);
}

.field-error:empty {
  display: none; /* sin mensaje, no ocupa espacio */
}
```

Además, el campo recibe `aria-invalid="true"` o `"false"` y el mensaje se escribe en el `<p class="field-error" aria-live="polite">` correspondiente.

### Medidor de seguridad

Mientras se escribe la contraseña se calcula una puntuación de 0 a 5:

- longitud ≥ 8 y ≥ 12,
- mayúsculas y minúsculas,
- al menos un número,
- al menos un símbolo.

Se muestra como **Básica**, **Buena** o **Fuerte** con una barra de color. Es informativo: la regla que bloquea el envío es la de 8 caracteres + letra + número.

### Mostrar y ocultar contraseñas

`public/js/password-toggle.js` se carga tanto en `login.html` como en `registro.html`. Cada botón declara el campo que controla:

```html
<button type="button" data-password-toggle="password"
        aria-label="Mostrar contraseña" aria-pressed="false">…</button>
```

Al pulsarlo:

1. Cambia el `type` del input entre `password` y `text`.
2. Actualiza `aria-pressed`, `aria-label` y `title`.
3. Devuelve el foco al campo y coloca el cursor al final.
4. Al reiniciar el formulario (por ejemplo, tras un registro correcto), vuelve a ocultar la contraseña.

En el registro hay dos botones independientes: uno para la contraseña y otro para la confirmación. Los iconos de ojo abierto/tachado se alternan solo con CSS según `aria-pressed`.

### Ejemplo de una regla

```js
password(valor) {
  if (!valor) return "Escribe una contraseña.";
  if (valor.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (valor.length > 72) return "La contraseña no puede superar los 72 caracteres.";
  if (!/[A-Za-z]/.test(valor)) return "Incluye al menos una letra.";
  if (!/\d/.test(valor)) return "Incluye al menos un número.";
  return ""; // sin error
}
```

Cada regla devuelve `""` si el campo es válido o un texto si hay error.

### Qué pasa al enviar

Cuando todos los campos son válidos, `registro.js` usa `fetch` para hacer un `POST` a `/api/auth/registro`. El backend vuelve a validar los datos, crea la cuenta con la contraseña hasheada y responde `201`. Si algo falla, el frontend pinta el `message` y los errores por campo que devuelve la API.

### Por qué la validación del navegador no es suficiente

La validación del navegador se puede saltar fácilmente: desactivando JavaScript, modificando el HTML o enviando datos con otra herramienta. El frontend existe para dar buena experiencia; por eso el backend repite estas reglas en `validators.js`, que es la única validación en la que se puede confiar.

---

## 7. Validación del login (`public/js/login.js`)

`login.html` carga el script al final del documento:

```html
<script src="js/login.js" defer></script>
```

Igual que en el registro, `defer` espera a que el HTML esté leído y `form.noValidate = true` desactiva los globos nativos del navegador.

### Reglas que se validan antes de enviar

| Campo | Reglas |
|---|---|
| Correo | Obligatorio, formato `texto@dominio.ext`, máximo 120 caracteres. |
| Contraseña | Obligatoria, máximo 72 caracteres. |

En el login **no** se exige longitud mínima ni mayúsculas/números: la contraseña correcta la decide el backend. Si se aplicaran las reglas del registro, una cuenta antigua con una contraseña más corta no podría entrar.

Se usan los mismos eventos que en el registro: `input` (cada tecla), `blur` (al salir del campo) y `submit` (validar todo y enfocar el primer campo inválido).

### Aviso de correo o contraseña incorrectos

Cuando el backend responde **401** o **403**, el formulario muestra un único mensaje general en `#login-message`:

> Correo o contraseña incorrectos. Vuelve a intentarlo.

Es deliberado que haya **un solo texto para los dos casos**:

- Si dijéramos "ese correo no existe" o "la contraseña es incorrecta", cualquiera podría averiguar qué correos están registrados (enumeración de usuarios).
- Tampoco se marca un campo concreto en rojo, porque el frontend no puede saber cuál de los dos falló.
- Después del aviso se vacía el campo de contraseña y se le devuelve el foco para reintentar.

### Otros mensajes del login

| Situación | Mensaje |
|---|---|
| Campo vacío o con formato inválido | Mensaje debajo del campo correspondiente. |
| 401 / 403 | "Correo o contraseña incorrectos. Vuelve a intentarlo." |
| 429 | "Demasiados intentos. Espera un momento antes de volver a probar." |
| Otro error del servidor | El `message` que devuelva la API o un texto genérico. |
| Fallo de red / backend apagado | "No se pudo conectar con el servidor. Comprueba que el backend esté en marcha." |
| 200 | "Sesión iniciada. Redirigiendo…" y salto a `gastos.html`. |

> Si abres el HTML con `file://` o con un servidor estático sin API, el envío terminará en un error de conexión. Para probar el login de verdad usa `npm run dev` en `server/`.

> La comprobación de credenciales solo es fiable en el backend. Este script mejora la experiencia y evita mensajes que revelen información, pero nunca debe sustituir la verificación real de la contraseña en el servidor.

---

## 8. Backend con Express y PostgreSQL

### Dependencias instaladas

| Paquete | Para qué |
|---|---|
| `express` | Servidor HTTP, rutas y middlewares. |
| `pg` | Conexión y pool de PostgreSQL. |
| `bcrypt` | Hash de contraseñas con coste 12. |
| `express-session` | Sesiones con cookie. |
| `connect-pg-simple` | Guarda las sesiones en PostgreSQL, no en memoria. |
| `express-rate-limit` | Limita intentos de login y registros por IP. |

No se usa `nodemon`: Node 24 incluye `node --watch`. Tampoco `body-parser`: Express ya trae `express.json()`.

El backend está organizado en capas: **rutas → middlewares → controladores → pool de PostgreSQL**. Las rutas solo declaran el endpoint; los controladores contienen la lógica; las utilidades agrupan validaciones y categorías; los middlewares protegen o formatean errores.

### Recorrido de una petición

```
Navegador
   ↓ fetch JSON
express.json()            limita y parsea el cuerpo (16 KB)
cabeceras de seguridad    nosniff, Referrer-Policy
sesión (PostgreSQL)       lee la cookie aurea.sid
   ↓
/api/auth o /api/gastos
   ↓
rate limit (solo auth)    corta excesos con 429
requiereSesion            401 si no hay sesión
   ↓
controlador               valida, consulta y decide la respuesta
   ↓
pool.query($1, $2, …)     SQL parametrizado
   ↓
PostgreSQL
   ↓
respuesta JSON { ok, … }
```

`app.js` termina con `notFound` y `errorHandler`. Las rutas `/api/*` inexistentes responden `404` en JSON y los errores no controlados `500` en JSON; las rutas de página responden texto. Un JSON mal formado se detecta y se devuelve `400` sin llegar al controlador.

### Variables de entorno

El archivo `server/.env` no se sube a Git (está en `.gitignore`). `server/.env.example` sirve de plantilla:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql:///aurea_finanzas_db?host=/var/run/postgresql
SESSION_SECRET=una-cadena-larga-y-aleatoria
```

- `DATABASE_URL` usa el **socket local** de PostgreSQL y autenticación `peer`: el servidor se conecta como el usuario del sistema, sin contraseña. Es cómodo en local; en GitHub no hay ningún secreto de base de datos en el repositorio.
- En producción se usa una URL TCP con un rol dedicado: `postgresql://usuario:clave@host:5432/aurea_finanzas_db`.
- `SESSION_SECRET` firma la cookie de sesión. Genera uno con `openssl rand -hex 32`. Si lo cambias, todas las sesiones existentes dejan de valer.
- `NODE_ENV=production` activa la cookie `secure` (solo se envía por HTTPS).
- Los scripts de `package.json` cargan el archivo con `node --env-file-if-exists=.env`; no se usa `dotenv`.
- Si falta una variable obligatoria, `config.js` detiene el arranque con un mensaje claro en lugar de fallar en la primera petición.

### Base de datos

Al arrancar, `src/db/setup.js` ejecuta `schema.sql` y crea lo necesario si no existe. El esquema es idempotente (`IF NOT EXISTS`), así que se puede ejecutar en cada arranque sin borrar datos.

```
users (1) ──────────< expenses (N)
```

**Tabla `users`**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `BIGSERIAL` | Clave primaria. |
| `nombre` | `VARCHAR(60)` | Obligatorio. |
| `email` | `VARCHAR(120)` | Obligatorio; se normaliza a minúsculas. |
| `password_hash` | `TEXT` | Hash bcrypt, nunca la contraseña. |
| `created_at` | `TIMESTAMPTZ` | Fecha de creación. |

El índice único sobre `lower(email)` hace que `Ana@correo.com` y `ana@correo.com` sean la misma cuenta.

**Tabla `expenses`**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `BIGSERIAL` | Clave primaria. |
| `user_id` | `BIGINT` | Referencia a `users(id)` con `ON DELETE CASCADE`. |
| `nombre` | `VARCHAR(80)` | Obligatorio. |
| `categoria` | `VARCHAR(30)` | Validada contra la lista canónica. |
| `fecha` | `DATE` | Sin hora, para evitar desfases de zona horaria. |
| `monto` | `NUMERIC(12,2)` | `CHECK (monto > 0)`. |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | Auditoría básica. |

Los índices `(user_id, fecha DESC)` y `(user_id, categoria)` aceleran el listado y los filtros. Al borrar una cuenta, la cascada elimina también sus gastos.

**Tabla `session`:** la crea automáticamente `connect-pg-simple` para guardar las sesiones en PostgreSQL. No se consulta desde los controladores.

El pool de `src/db/pool.js` mantiene hasta 10 conexiones, cierra las inactivas a los 30 segundos y espera como máximo 5 segundos por una conexión. Se comparte entre todos los controladores y el almacén de sesiones, y tiene un listener de errores para que una conexión caída no tumbe el proceso.

Las contraseñas nunca se guardan en texto plano: se hashean con bcrypt (coste 12) y el hash no sale nunca en una respuesta JSON.

### Categorías

La lista canónica vive en `server/src/utils/categorias.js` y debe coincidir con las opciones de `gastos.html`:

`Alimentación`, `Vivienda`, `Transporte`, `Salud`, `Ocio`, `Educación`, `Compras`, `Servicios`, `Otros`.

El backend rechaza cualquier categoría que no esté en esa lista; no basta con modificar el `<select>` en el navegador.

Para **añadir o quitar una categoría** hay que tocar tres sitios y reiniciar el servidor:

1. `server/src/utils/categorias.js` (lista canónica y validación).
2. El `<select id="gasto-categoria">` de `public/gastos.html` (formulario).
3. El `<select id="filtro-categoria">` de `public/gastos.html` (filtros).

No hace falta tocar la base de datos: `categoria` es texto y la validación se hace en la aplicación.

### Endpoints

| Método | Ruta | Respuesta correcta | Errores habituales |
|---|---|---|---|
| `POST` | `/api/auth/registro` | `201` + `{ ok, message, user }` | `400` validación, `409` correo duplicado, `429` demasiados registros |
| `POST` | `/api/auth/login` | `200` + `{ ok, message, user }` y cookie de sesión | `400` validación, `401` credenciales, `429` demasiados intentos |
| `POST` | `/api/auth/logout` | `200` + `{ ok, message }` | — |
| `GET` | `/api/auth/me` | `200` + `{ ok, user }` | `401` sin sesión |

Los errores de validación mantienen el formato que ya espera el frontend:

```json
{
  "ok": false,
  "message": "Revisa los campos marcados antes de continuar.",
  "errors": { "email": "Escribe un correo válido (ej.: ana@correo.com)." }
}
```

Así `mostrarErroresDelServidor()` pinta cada mensaje debajo de su campo. Los errores no controlados responden `500` con un mensaje genérico; el detalle solo queda en la terminal del servidor.

### Endpoints de gastos

Todas estas rutas exigen sesión. Sin ella responden `401` y el frontend vuelve al login.

| Método | Ruta | Qué hace | Respuesta correcta | Errores |
|---|---|---|---|---|
| `GET` | `/api/gastos` | Lista los gastos del usuario (máximo 1000, fecha descendente) | `200` + `{ ok, gastos, cantidad }` | `400` filtros inválidos, `401` sin sesión |
| `GET` | `/api/gastos/resumen` | Totales, gasto por mes y por categoría | `200` + `{ ok, resumen }` | `400` filtros inválidos, `401` sin sesión |
| `POST` | `/api/gastos` | Crea un gasto | `201` + `{ ok, message, gasto }` | `400` validación, `401` sin sesión |
| `PUT` | `/api/gastos/:id` | Edita todos los campos de un gasto | `200` + `{ ok, message, gasto }` | `400` validación o id inválido, `401`, `404` |
| `DELETE` | `/api/gastos/:id` | Elimina un gasto | `200` + `{ ok, message }` | `400` id inválido, `401`, `404` |

Las dos rutas `GET` aceptan los mismos filtros, combinables:

| Parámetro | Ejemplo | Efecto |
|---|---|---|
| `categoria` | `Alimentación` | Solo esa categoría. |
| `desde` | `2026-01-01` | Fecha igual o posterior. |
| `hasta` | `2026-12-31` | Fecha igual o anterior. |

Ejemplos:

```bash
# Todos los gastos del usuario
curl -b cookies.txt http://localhost:3000/api/gastos

# Alimentación entre febrero y marzo
curl -b cookies.txt --get \
  --data-urlencode 'categoria=Alimentación' \
  --data-urlencode 'desde=2026-02-01' \
  --data-urlencode 'hasta=2026-03-31' \
  http://localhost:3000/api/gastos

# Resumen para las gráficas
curl -b cookies.txt http://localhost:3000/api/gastos/resumen

# Crear un gasto
curl -b cookies.txt -X POST http://localhost:3000/api/gastos \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"Mercado","categoria":"Alimentación","fecha":"2026-02-15","monto":450.75}'

# Editar y eliminar
curl -b cookies.txt -X PUT http://localhost:3000/api/gastos/1 \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"Mercado grande","categoria":"Alimentación","fecha":"2026-02-16","monto":520}'

curl -b cookies.txt -X DELETE http://localhost:3000/api/gastos/1
```

Respuesta del listado:

```json
{
  "ok": true,
  "gastos": [
    {
      "id": "12",
      "nombre": "Mercado",
      "categoria": "Alimentación",
      "fecha": "2026-02-15",
      "monto": 450.75,
      "created_at": "2026-02-15T18:00:00.000Z",
      "updated_at": "2026-02-15T18:00:00.000Z"
    }
  ],
  "cantidad": 1
}
```

Respuesta del resumen:

```json
{
  "ok": true,
  "resumen": {
    "total": 1951.25,
    "cantidad": 3,
    "porMes": [
      { "mes": "2026-01", "total": 1200.5 },
      { "mes": "2026-02", "total": 750.75 }
    ],
    "porCategoria": [
      { "categoria": "Alimentación", "total": 1651.25, "cantidad": 2 },
      { "categoria": "Transporte", "total": 300, "cantidad": 1 }
    ]
  }
}
```

Los `id` de PostgreSQL son `BIGSERIAL`; `pg` los entrega como texto para no perder precisión. El frontend los compara con `String(id)`.

Validaciones del gasto: nombre de 2 a 80 caracteres, categoría de la lista, fecha real en formato `YYYY-MM-DD` (se rechazan cosas como `2026-02-30`) y monto mayor que 0 con dos decimales.

Si la validación falla, el `400` incluye `errors` por campo, igual que en autenticación:

```json
{
  "ok": false,
  "message": "Revisa los datos del gasto.",
  "errors": { "monto": "Escribe un monto mayor que 0." }
}
```

`gastos.js` une el `message` general con esos errores para mostrarlos en el formulario.

### Aislamiento entre usuarios

Cada consulta incluye `WHERE user_id = $1` con el id de la sesión, también en `UPDATE` y `DELETE`. Un usuario no puede listar, editar ni borrar gastos de otro: si intenta usar un id ajeno, recibe `404` como si no existiera. Nunca se confía en un `user_id` enviado por el cliente.

### Sesiones

- Cookie `aurea.sid` con `httpOnly` (JavaScript no puede leerla), `sameSite=lax` y `secure` en producción.
- Por defecto dura lo que la pestaña del navegador. Si el usuario marca "Mantener mi sesión iniciada", dura 30 días.
- Al iniciar sesión se **regenera** la sesión para evitar fijación de sesión.
- Al cerrar sesión se destruye en el servidor y se borra la cookie.
- La sesión se guarda en PostgreSQL, así que reiniciar el backend no cierra a los usuarios.

### Seguridad aplicada

- Validación repetida en el servidor: el navegador se puede saltar.
- bcrypt con coste 12; nunca se devuelve `password_hash`.
- Login con mensaje genérico y comparación contra un hash ficticio cuando el correo no existe, para no filtrar información por tiempo de respuesta.
- Rate limit: 10 intentos fallidos de login cada 15 minutos y 20 registros por hora, por IP.
- Consultas SQL parametrizadas (`$1`, `$2`...) para evitar inyección SQL.
- Límite de 16 KB en el cuerpo JSON.
- `x-powered-by` desactivado y cabeceras `nosniff` y `Referrer-Policy`.
- Errores internos registrados en la terminal, pero el cliente solo recibe un mensaje genérico.

### Probar la API con curl

Registro:

```bash
curl -i -X POST http://localhost:3000/api/auth/registro \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"Ana Torres","email":"ana@correo.com","password":"secreta123","confirmPassword":"secreta123","terminos":true}'
```

Login guardando la cookie:

```bash
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@correo.com","password":"secreta123","recordarme":false}'
```

Consultar la sesión:

```bash
curl -i -b cookies.txt http://localhost:3000/api/auth/me
```

### Notas para producción

- Crea un rol de base de datos dedicado con permisos solo sobre esta base; no uses el superusuario `postgres`.
- Usa HTTPS: con `NODE_ENV=production` la cookie `secure` no se envía por HTTP.
- Si hay un proxy inverso delante, configura `trust proxy` para que el rate limit vea la IP real.
- Cuando el esquema crezca, sustituye la creación automática de tablas por migraciones versionadas.
- Añade `helmet`, backups y monitorización antes de exponer la app a Internet.

---

## 9. Panel de gastos (`gastos.html`)

La página se sirve solo con sesión: `app.get("/gastos.html", requiereSesionPagina)` se declara antes de `express.static`, así que un visitante sin cookie recibe un `302` al login. Además, `gastos.js` llama a `/api/auth/me` al cargar y, si cualquier petición responde `401`, vuelve a `login.html`.

### Qué incluye

- **Cabecera**: mantiene el contexto del panel; solo ofrece «Mis gastos» (página actual) y «Salir». No hay enlace a la portada para no salir del flujo de sesión.
- **Tema claro u oscuro**: botón circular con iconos de sol y luna en la cabecera. El oscuro es el predeterminado y la elección se conserva entre visitas.
- **Formulario**: nombre, categoría, fecha y monto. El mismo formulario sirve para crear y editar; al pulsar «Editar» en una fila se rellenan los campos y aparece el botón «Cancelar edición».
- **Tarjetas de resumen**: total del periodo, número de gastos, promedio por gasto y categoría principal.
- **Búsqueda**: filtro por categoría y rango `desde`/`hasta`. «Ver todo» limpia los filtros. Al abrir la página se filtra por el año actual para que la gráfica muestre los 12 meses. El listado se limita a 1000 gastos, ordenados por fecha descendente.
- **Movimientos**: tabla ordenada por fecha descendente, con editar y eliminar (pide confirmación). Los botones de cada fila se gestionan con delegación de eventos: un solo listener en el `<tbody>`.
- **Gasto por mes**: barras construidas con HTML y CSS, sin librerías de gráficas. La altura es proporcional al máximo del periodo y cada barra muestra el monto al pasar el ratón o al enfocarla con teclado.
- **Por categoría**: barras horizontales con monto, número de gastos y porcentaje del total.
- **Exportar CSV**: descarga el listado filtrado con BOM UTF-8, para que Excel abra bien las tildes.
- **Avisos**: *toasts* para confirmaciones y errores, y estados vacíos cuando no hay datos.

### Cómo se cargan los datos

```js
const [lista, resumen] = await Promise.all([
  api(`/api/gastos${query}`),
  api(`/api/gastos/resumen${query}`),
]);
```

El listado y el resumen se piden en paralelo. Un contador de petición (`peticionActual`) descarta respuestas antiguas si el usuario cambia los filtros rápido, para que no se pinte información que ya no corresponde.

La gráfica mensual usa `porMes` del resumen. Si hay un rango de fechas, rellena los meses intermedios con cero (hasta 24 columnas); si el rango es mayor, muestra solo los meses con gastos.

### Tema claro y oscuro

- El tema **oscuro** es el predeterminado para conservar el diseño original.
- El botón sol/luna de la cabecera alterna entre ambos temas. En oscuro muestra el sol (pasar a claro) y en claro muestra la luna (volver a oscuro).
- La preferencia se guarda en `localStorage` con la clave `aurea-tema`. No se envía al backend ni se mezcla con la sesión.
- Un script breve en el `<head>` aplica el tema guardado antes de pintar la página, para evitar un destello claro al recargar.
- `data-theme="light"` en `<html>` activa la paleta clara. Todos los overrides están dentro de `html[data-theme="light"]` en la sección 15 de `styles.css`, así que **no afectan a la portada, el login ni el registro**.
- Si el navegador bloquea `localStorage`, se usa el tema oscuro y el cambio funciona solo durante esa visita.
- El botón mantiene `aria-pressed` y `aria-label` actualizados para que el cambio también sea claro con lector de pantalla.

### Formato

- Moneda con `Intl.NumberFormat("es-MX", { currency: "MXN" })`.
- Fechas con `Intl.DateTimeFormat("es-MX")` y conversión a fecha local, para evitar que `2026-02-01` se muestre como 31 de enero por el desfase UTC.

### Estilos

La sección 14 de `styles.css` contiene el layout del panel: rejilla principal + lateral, tarjetas, formulario, tabla, gráficas, *toast* y sus *media queries*. En pantallas de hasta 720 px la tabla se convierte en tarjetas apiladas usando `data-label` y `::before`, y el panel lateral pasa a una columna.

La sección 15 añade el botón de tema y la paleta clara. La paleta oscura sigue siendo la de `:root`; la clara redefine las variables y los fondos que estaban escritos con RGBA dentro de `html[data-theme="light"]`.

---

## 10. Decisiones de diseño y limitaciones

### Arquitectura elegida

- **MVC por capas** sobre el pipeline de middlewares de Express: rutas → middlewares → controladores → PostgreSQL. Cada archivo tiene una responsabilidad y las rutas no contienen lógica.
- **Sesiones en PostgreSQL** en lugar de JWT: el frontend lo sirve el mismo Express, así que una cookie `httpOnly` es más sencilla y permite cerrar sesión de verdad en el servidor.
- **SQL explícito con `pg`**, sin ORM: consultas parametrizadas, control total y menos dependencias.
- **Autorización por propietario**: cada consulta filtra por `user_id` de la sesión. No se confía en ids enviados por el cliente.
- **Validación en dos capas**: el navegador da feedback inmediato y el backend repite las reglas porque es la única validación fiable.
- **Frontend sin frameworks**: HTML, CSS y JavaScript con módulos por página. Las gráficas son HTML/CSS, y el CSV se genera en el navegador.

### Por qué no otras piezas

| Alternativa | Por qué no se usó |
|---|---|
| JWT | No hay clientes externos; la cookie de sesión cubre el caso y permite revocar sesiones. |
| ORM (Prisma, Sequelize) | Para 9 endpoints, SQL directo es más claro y no añade generación ni migraciones automáticas. |
| Capa `services/` y `repositories/` | El proyecto es pequeño; añadirla ahora sería indirección sin beneficio. Es la mejora natural si crece. |
| Librería de gráficas | Las barras mensuales y el desglose por categoría se resuelven con HTML/CSS y menos peso. |
| React/Vue | El panel tiene poca interactividad y el DOM directo es suficiente. |

### Limitaciones conocidas

- **Sin paginación**: el listado devuelve como máximo 1000 gastos. Con historiales grandes habría que paginar.
- **Sin migraciones versionadas**: `schema.sql` crea tablas al arrancar; no hay historial de cambios ni rollback.
- **Sin tests automatizados**: las comprobaciones fueron manuales con `curl` y navegador headless. Es la deuda técnica más importante.
- **Sin capa de repositorio**: los controladores dependen directamente del pool de PostgreSQL.
- **Sin `helmet` ni token CSRF explícito**: hay cabeceras básicas y `sameSite=lax`, suficiente para desarrollo local, pero insuficiente para producción.
- **Filtro inicial por año**: un gasto de otro año no aparece hasta pulsar «Ver todo». Es una decisión de usabilidad, no una pérdida de datos.

---

## 11. Accesibilidad aplicada

- Cada `input` tiene su `<label for="...">`.
- Los errores se enlazan con `aria-describedby`.
- `aria-invalid` cambia según el estado del campo.
- Los mensajes usan `aria-live="polite"` para que se anuncien sin interrumpir.
- El foco se mueve al primer campo inválido al intentar enviar.
- Los estados de foco son visibles y el diseño respeta `prefers-reduced-motion`.
- En el panel de gastos, cada barra mensual es enfocable con el teclado y anuncia mes y monto con `aria-label`; los avisos usan `aria-live="polite"`.
- La tabla mantiene encabezados `scope="col"` y, en móvil, cada celda conserva su etiqueta visible.

---

## 12. Próximos pasos

1. Practicar el DOM y la validación modificando `registro.js`, `login.js` y `gastos.js`.
2. Crear la página de recuperación de contraseña (el enlace "¿La olvidaste?" ya está preparado).
3. Añadir presupuestos por categoría y comparar lo gastado con el límite.
4. Añadir paginación o carga incremental si el historial crece mucho (hoy el listado se limita a 1000 filas).
5. Escribir tests de los endpoints con `supertest` y `node:test`.
6. Endurecer el despliegue: `helmet`, HTTPS, migraciones, backups y variables de entorno del servidor.

---

© 2026 · Proyecto de práctica con HTML, CSS, JavaScript, Node.js, Express y PostgreSQL.
