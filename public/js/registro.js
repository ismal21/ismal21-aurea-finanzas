/**
 * ============================================================================
 * AUREA FINANZAS · Validación en tiempo real del formulario de registro
 * ----------------------------------------------------------------------------
 * Qué hace este archivo:
 *   1. Escucha lo que el usuario escribe en cada campo.
 *   2. Valida ese campo al instante y muestra un mensaje debajo si hay error.
 *   3. Marca el campo en verde cuando es válido.
 *   4. Calcula la seguridad de la contraseña mientras se escribe.
 *   5. Al enviar, comprueba todo y hace POST a /api/auth/registro con fetch.
 *
 * Por qué se valida también en el backend:
 *   La validación del navegador se puede saltar (desactivando JS, usando
 *   Postman, etc.). El frontend existe para dar buena experiencia; el backend
 *   es la única validación en la que se puede confiar.
 *
 * Se carga con <script src="js/registro.js" defer> al final del HTML.
 * ============================================================================
 */

"use strict";

// Buscamos el formulario. Si no existe (por ejemplo, en otra página), no se
// ejecuta nada: así el archivo se puede reutilizar sin romper nada.
const formulario = document.querySelector("#registro-form");

if (formulario) {
  iniciarValidacion(formulario);
}

/**
 * Inicializa toda la lógica del formulario.
 * @param {HTMLFormElement} form - El formulario de registro.
 */
function iniciarValidacion(form) {
  /* ------------------------------------------------------------------------
     1. REFERENCIAS AL DOM
     Guardamos los elementos una sola vez para no buscarlos en cada tecla.
     ------------------------------------------------------------------------ */
  const campos = {
    nombre: form.querySelector("#nombre"),
    email: form.querySelector("#email"),
    password: form.querySelector("#password"),
    confirmPassword: form.querySelector("#confirmPassword"),
    terminos: form.querySelector("#terminos"),
  };

  const botonEnviar = form.querySelector('button[type="submit"]');
  const mensajeFormulario = document.querySelector("#form-message");

  // Elementos del medidor de seguridad de la contraseña
  const medidor = document.querySelector("#password-strength");
  const medidorBarra = medidor?.querySelector(".strength-meter span");
  const medidorTexto = medidor?.querySelector("strong");

  // Campos que el usuario ya ha tocado (o que se han validado al enviar).
  // Sirve para no mostrar "Campo obligatorio" antes de que el usuario
  // interactúe con el campo.
  const camposTocados = new Set();

  // Evita envíos duplicados mientras la petición está en curso.
  let enviando = false;

  /* ------------------------------------------------------------------------
     2. VALIDACIÓN NATIVA
     Los atributos required/type/minlength del HTML son el respaldo si JS no
     carga. Cuando JS sí carga, los desactivamos para mostrar nuestros propios
     mensajes y no dos validaciones distintas a la vez.
     ------------------------------------------------------------------------ */
  form.noValidate = true;

  /* ------------------------------------------------------------------------
     3. REGLAS DE VALIDACIÓN
     Cada función recibe el valor del campo y devuelve:
       - ""            → no hay error (campo válido)
       - "mensaje..."  → texto que se mostrará debajo del campo
     ------------------------------------------------------------------------ */
  const reglas = {
    nombre(valor) {
      const nombre = valor.trim();

      if (!nombre) return "Escribe tu nombre completo.";
      if (nombre.length < 2) return "El nombre debe tener al menos 2 caracteres.";
      if (nombre.length > 60) return "El nombre no puede superar los 60 caracteres.";
      if (!/\p{L}/u.test(nombre)) return "El nombre debe contener al menos una letra.";

      return "";
    },

    email(valor) {
      const email = valor.trim();

      if (!email) return "Escribe tu correo electrónico.";
      if (email.length > 120) return "El correo es demasiado largo.";
      // Validación básica: texto + @ + texto + . + al menos 2 letras.
      // No intenta cubrir todos los casos raros del estándar: el backend
      // vuelve a comprobarlo.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return "Escribe un correo válido (ej.: ana@correo.com).";
      }

      return "";
    },

    password(valor) {
      if (!valor) return "Escribe una contraseña.";
      if (valor.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
      if (valor.length > 72) return "La contraseña no puede superar los 72 caracteres.";
      if (!/[A-Za-z]/.test(valor)) return "Incluye al menos una letra.";
      if (!/\d/.test(valor)) return "Incluye al menos un número.";

      return "";
    },

    confirmPassword(valor) {
      if (!valor) return "Repite tu contraseña.";
      if (valor !== campos.password.value) return "Las contraseñas no coinciden.";

      return "";
    },

    terminos(_valor, input) {
      return input.checked ? "" : "Debes aceptar los términos para continuar.";
    },
  };

  /* ------------------------------------------------------------------------
     4. FUNCIONES DE INTERFAZ
     ------------------------------------------------------------------------ */

  /**
   * Pinta el estado de un campo: borde rojo/verde, mensaje y aria-invalid.
   * @param {HTMLInputElement} input - Campo que se actualiza.
   * @param {string} mensaje - Error a mostrar; "" si no hay error.
   * @param {boolean} esValido - true si el campo tiene un valor correcto.
   */
  function actualizarInterfaz(input, mensaje, esValido = false) {
    const contenedor = input.closest(".field");
    const cajaError = document.getElementById(`${input.id}-error`);

    if (contenedor) {
      contenedor.classList.toggle("is-invalid", Boolean(mensaje));
      contenedor.classList.toggle("is-valid", esValido && !mensaje);
    }

    if (cajaError) {
      cajaError.textContent = mensaje;
    }

    // aria-invalid informa a lectores de pantalla del estado del campo.
    input.setAttribute("aria-invalid", mensaje ? "true" : "false");
  }

  /**
   * Valida un campo concreto y actualiza su interfaz.
   * @param {string} nombre - Clave del campo dentro de `campos`.
   * @param {object} [opciones]
   * @param {boolean} [opciones.forzar=false] - Mostrar errores aunque el campo
   *   todavía no se haya tocado (se usa al enviar el formulario).
   * @returns {boolean} true si el campo es válido.
   */
  function validarCampo(nombre, { forzar = false } = {}) {
    const input = campos[nombre];
    const esCheckbox = input.type === "checkbox";
    const valor = esCheckbox ? "" : input.value;
    const mensaje = reglas[nombre](valor, input);

    const tieneValor = esCheckbox ? input.checked : input.value.trim() !== "";

    // No mostramos el error de un campo vacío hasta que el usuario lo toca
    // o intenta enviar. Si ya escribió algo, el error aparece al instante.
    const mostrarError = Boolean(mensaje) && (forzar || camposTocados.has(nombre) || tieneValor);

    actualizarInterfaz(input, mostrarError ? mensaje : "", !mensaje && tieneValor);

    return mensaje === "";
  }

  /**
   * Calcula la seguridad de la contraseña y actualiza la barra.
   * Es solo informativo: la regla que bloquea el envío es la de `password`.
   */
  function actualizarFortaleza() {
    if (!medidor || !medidorBarra || !medidorTexto) return;

    const valor = campos.password.value;
    medidor.hidden = valor.length === 0;

    if (!valor) {
      medidorBarra.style.width = "0%";
      return;
    }

    // Puntuación de 0 a 5: longitud + variedad de caracteres.
    let puntos = 0;
    if (valor.length >= 8) puntos += 1;
    if (valor.length >= 12) puntos += 1;
    if (/[a-z]/.test(valor) && /[A-Z]/.test(valor)) puntos += 1;
    if (/\d/.test(valor)) puntos += 1;
    if (/[^A-Za-z0-9]/.test(valor)) puntos += 1;

    const nivel = puntos <= 2 ? "debil" : puntos <= 4 ? "media" : "fuerte";
    const etiquetas = { debil: "Básica", media: "Buena", fuerte: "Fuerte" };
    const porcentajes = { debil: 33, media: 66, fuerte: 100 };

    // data-level permite que el CSS cambie el color de la barra.
    medidor.dataset.level = nivel;
    medidorBarra.style.width = `${porcentajes[nivel]}%`;
    medidorTexto.textContent = etiquetas[nivel];
  }

  /**
   * Muestra un mensaje general encima o debajo del botón.
   * @param {string} texto
   * @param {"error"|"success"} tipo
   */
  function mostrarMensajeFormulario(texto, tipo) {
    if (!mensajeFormulario) return;

    mensajeFormulario.textContent = texto;
    mensajeFormulario.classList.remove("is-error", "is-success");
    mensajeFormulario.classList.add(tipo === "success" ? "is-success" : "is-error");
  }

  function limpiarMensajeFormulario() {
    if (!mensajeFormulario) return;

    mensajeFormulario.textContent = "";
    mensajeFormulario.classList.remove("is-error", "is-success");
  }

  /**
   * Pinta en cada campo los errores que devuelve el backend.
   * El backend responde, por ejemplo: { email: "Ya existe una cuenta..." }.
   * @param {Record<string, string>} errores
   */
  function mostrarErroresDelServidor(errores) {
    if (!errores || typeof errores !== "object") return;

    Object.entries(errores).forEach(([nombre, mensaje]) => {
      const input = campos[nombre];
      if (!input) return;

      camposTocados.add(nombre);
      actualizarInterfaz(input, String(mensaje), false);
    });
  }

  /**
   * Limpia el estado visual después de un registro correcto.
   * (El mensaje de éxito se conserva para que el usuario lo vea.)
   */
  function reiniciarInterfaz() {
    camposTocados.clear();

    Object.entries(campos).forEach(([nombre, input]) => {
      actualizarInterfaz(input, "", false);
      input.setAttribute("aria-invalid", "false");
    });

    if (medidor) medidor.hidden = true;
    if (medidorBarra) medidorBarra.style.width = "0%";
  }

  /* ------------------------------------------------------------------------
     5. EVENTOS EN TIEMPO REAL
     - "input": se dispara con cada tecla (texto, email, password).
     - "change": se dispara al marcar/desmarcar el checkbox.
     - "blur": al salir del campo; ahí sí mostramos el error de vacío.
     ------------------------------------------------------------------------ */
  Object.entries(campos).forEach(([nombre, input]) => {
    const eventoTipado = input.type === "checkbox" ? "change" : "input";

    input.addEventListener(eventoTipado, () => {
      // Un campo con contenido ya se considera "tocado": sus errores se
      // muestran y se corrigen en vivo mientras se escribe.
      if (input.type === "checkbox" || input.value.trim() !== "") {
        camposTocados.add(nombre);
      }

      validarCampo(nombre);

      if (nombre === "password") {
        actualizarFortaleza();

        // Si ya hay algo escrito en "confirmar", vuelve a comprobarlo cuando
        // cambia la contraseña original.
        if (campos.confirmPassword.value.trim() !== "") {
          validarCampo("confirmPassword");
        }
      }

      // Al corregir un campo, quitamos el mensaje general de error.
      if (mensajeFormulario?.classList.contains("is-error")) {
        limpiarMensajeFormulario();
      }
    });

    input.addEventListener("blur", () => {
      camposTocados.add(nombre);
      validarCampo(nombre);
    });
  });

  /* ------------------------------------------------------------------------
     6. ENVÍO DEL FORMULARIO
     ------------------------------------------------------------------------ */
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); // evitamos la recarga de página

    if (enviando) return;

    limpiarMensajeFormulario();

    // Validamos todos los campos y forzamos que se muestren sus errores.
    const resultados = Object.keys(campos).map((nombre) => {
      camposTocados.add(nombre);
      return validarCampo(nombre, { forzar: true });
    });

    if (resultados.includes(false)) {
      const primerInvalido = form.querySelector(".field.is-invalid input");
      primerInvalido?.focus();

      mostrarMensajeFormulario("Revisa los campos marcados antes de continuar.", "error");
      return;
    }

    await enviarRegistro();
  });

  /**
   * Envía los datos al backend con fetch y gestiona la respuesta.
   * El backend responde en JSON:
   *   - 201 { ok: true, message, user }
   *   - 400 { ok: false, message, errors: { campo: "mensaje" } }
   */
  async function enviarRegistro() {
    enviando = true;

    const textoOriginal = botonEnviar.textContent;
    botonEnviar.disabled = true;
    botonEnviar.textContent = "Creando cuenta…";

    // Los datos se envían ya normalizados (sin espacios y email en minúsculas).
    const datos = {
      nombre: campos.nombre.value.trim(),
      email: campos.email.value.trim().toLowerCase(),
      password: campos.password.value,
      confirmPassword: campos.confirmPassword.value,
      terminos: campos.terminos.checked,
    };

    let completado = false;

    try {
      const respuesta = await fetch(form.action, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(datos),
      });

      // Si el servidor no devuelve JSON válido, usamos un objeto vacío.
      const resultado = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        mostrarErroresDelServidor(resultado.errors);
        mostrarMensajeFormulario(
          resultado.message || "No se pudo crear la cuenta. Inténtalo de nuevo.",
          "error"
        );
        return;
      }

      completado = true;

      mostrarMensajeFormulario(
        resultado.message || "Cuenta creada correctamente. Redirigiendo…",
        "success"
      );
      botonEnviar.textContent = "Cuenta creada ✓";

      // Limpiamos el formulario y su estado visual.
      form.reset();
      reiniciarInterfaz();

      // Redirigimos al login. Cambia esta ruta si tu login está en otro sitio.
      window.setTimeout(() => {
        window.location.href = "/login.html";
      }, 1500);
    } catch (error) {
      console.error("Error al enviar el registro:", error);
      mostrarMensajeFormulario(
        "No se pudo conectar con el servidor. Comprueba que el backend esté en marcha.",
        "error"
      );
    } finally {
      enviando = false;

      // Si hubo éxito dejamos el botón deshabilitado hasta la redirección.
      if (!completado) {
        botonEnviar.disabled = false;
        botonEnviar.textContent = textoOriginal;
      }
    }
  }
}
