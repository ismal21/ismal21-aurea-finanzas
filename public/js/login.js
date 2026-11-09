/**
 * ============================================================================
 * AUREA FINANZAS · Validación y avisos del formulario de login
 * ----------------------------------------------------------------------------
 * Qué hace este archivo:
 *   1. Valida el correo y la contraseña mientras el usuario escribe.
 *   2. Muestra un mensaje debajo de cada campo si el formato no es correcto.
 *   3. Al enviar, hace POST a /api/auth/login con fetch.
 *   4. Si el backend responde 401/403, muestra un aviso GENÉRICO:
 *      "Correo o contraseña incorrectos". Nunca dice cuál de los dos falla:
 *      así nadie puede averiguar qué correos están registrados.
 *
 * Se carga con <script src="js/login.js" defer> al final de login.html.
 * ============================================================================
 */

"use strict";

// Si el formulario no existe (otra página), el archivo no hace nada.
const formularioLogin = document.querySelector("#login-form");

if (formularioLogin) {
  iniciarLogin(formularioLogin);
}

/**
 * Inicializa la lógica del formulario de login.
 * @param {HTMLFormElement} form - El formulario de login.
 */
function iniciarLogin(form) {
  /* ------------------------------------------------------------------------
     1. REFERENCIAS AL DOM
     ------------------------------------------------------------------------ */
  const campos = {
    email: form.querySelector("#login-email"),
    password: form.querySelector("#login-password"),
  };

  const botonEnviar = form.querySelector('button[type="submit"]');
  const mensajeFormulario = document.querySelector("#login-message");

  // Campos que el usuario ya ha tocado (o que se validaron al enviar).
  // Evita mostrar "Campo obligatorio" antes de interactuar con el campo.
  const camposTocados = new Set();

  // Evita envíos duplicados mientras la petición está en curso.
  let enviando = false;

  /* ------------------------------------------------------------------------
     2. VALIDACIÓN NATIVA
     Los atributos required/type del HTML son el respaldo si JS no carga.
     Cuando JS sí carga, los desactivamos para usar nuestros mensajes.
     ------------------------------------------------------------------------ */
  form.noValidate = true;

  /* ------------------------------------------------------------------------
     3. REGLAS DE VALIDACIÓN
     Devuelven "" si el campo es válido o el texto del error si no lo es.
     ------------------------------------------------------------------------ */
  const reglas = {
    email(valor) {
      const email = valor.trim();

      if (!email) return "Escribe tu correo electrónico.";
      if (email.length > 120) return "El correo es demasiado largo.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return "Escribe un correo válido (ej.: ana@correo.com).";
      }

      return "";
    },

    password(valor) {
      if (!valor) return "Escribe tu contraseña.";
      if (valor.length > 72) return "La contraseña no puede superar los 72 caracteres.";

      // En el login NO se exige longitud mínima ni composición: la contraseña
      // correcta la decide el backend. Si el usuario se equivoca, la respuesta
      // 401 mostrará el aviso genérico de credenciales incorrectas.
      return "";
    },
  };

  /* ------------------------------------------------------------------------
     4. FUNCIONES DE INTERFAZ
     ------------------------------------------------------------------------ */

  /**
   * Pinta el estado de un campo: borde rojo/verde, mensaje y aria-invalid.
   * @param {HTMLInputElement} input
   * @param {string} mensaje - Error a mostrar; "" si no hay error.
   * @param {boolean} esValido
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

    input.setAttribute("aria-invalid", mensaje ? "true" : "false");
  }

  /**
   * Valida un campo concreto y actualiza su interfaz.
   * @param {"email"|"password"} nombre
   * @param {object} [opciones]
   * @param {boolean} [opciones.forzar=false] - Mostrar errores aunque el campo
   *   todavía no se haya tocado (se usa al enviar).
   * @returns {boolean} true si el campo es válido.
   */
  function validarCampo(nombre, { forzar = false } = {}) {
    const input = campos[nombre];
    const mensaje = reglas[nombre](input.value);
    const tieneValor = input.value.trim() !== "";

    const mostrarError =
      Boolean(mensaje) && (forzar || camposTocados.has(nombre) || tieneValor);

    actualizarInterfaz(input, mostrarError ? mensaje : "", !mensaje && tieneValor);

    return mensaje === "";
  }

  /**
   * Muestra el mensaje general del formulario.
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

  /* ------------------------------------------------------------------------
     5. EVENTOS EN TIEMPO REAL
     - "input": valida con cada tecla.
     - "blur": al salir del campo se marca como tocado y se muestra el error.
     ------------------------------------------------------------------------ */
  Object.entries(campos).forEach(([nombre, input]) => {
    input.addEventListener("input", () => {
      if (input.value.trim() !== "") {
        camposTocados.add(nombre);
      }

      validarCampo(nombre);

      // Al corregir un campo, quitamos el aviso general de credenciales.
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
    event.preventDefault();

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

    await enviarLogin();
  });

  /**
   * Envía las credenciales al backend con fetch.
   * Respuestas esperadas de la API:
   *   - 200 { ok: true, message }
   *   - 401 { ok: false, message }  → credenciales incorrectas
   *   - 429                         → demasiados intentos
   */
  async function enviarLogin() {
    enviando = true;

    const textoOriginal = botonEnviar.textContent;
    botonEnviar.disabled = true;
    botonEnviar.textContent = "Comprobando…";

    const datos = {
      email: campos.email.value.trim().toLowerCase(),
      password: campos.password.value,
      recordarme: form.querySelector("#recordarme")?.checked ?? false,
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

      const resultado = await respuesta.json().catch(() => ({}));

      /* --- Credenciales incorrectas ---------------------------------------
         Un único mensaje para correo inexistente y contraseña errónea.
         No marcamos un campo concreto porque el frontend no sabe cuál falló
         y decirlo permitiría enumerar usuarios registrados. */
      if (respuesta.status === 401 || respuesta.status === 403) {
        mostrarMensajeFormulario(
          "Correo o contraseña incorrectos. Vuelve a intentarlo.",
          "error"
        );

        // Dejamos los campos en estado neutro: el formato era correcto, pero
        // las credenciales no. No marcamos ninguno en rojo para no revelar
        // cuál de los dos falló.
        Object.values(campos).forEach((input) => actualizarInterfaz(input, "", false));

        // Se vacía la contraseña y se devuelve el foco para reintentar.
        campos.password.value = "";
        campos.password.focus();
        return;
      }

      /* --- Demasiados intentos -------------------------------------------- */
      if (respuesta.status === 429) {
        mostrarMensajeFormulario(
          "Demasiados intentos. Espera un momento antes de volver a probar.",
          "error"
        );
        return;
      }

      /* --- Otros errores del servidor ------------------------------------- */
      if (!respuesta.ok) {
        mostrarMensajeFormulario(
          resultado.message || "No se pudo iniciar sesión. Inténtalo de nuevo.",
          "error"
        );
        return;
      }

      /* --- Login correcto -------------------------------------------------- */
      completado = true;

      mostrarMensajeFormulario(
        resultado.message || "Sesión iniciada. Redirigiendo…",
        "success"
      );
      botonEnviar.textContent = "Entrando ✓";

      // Redirigimos al panel de gastos.
      window.setTimeout(() => {
        window.location.href = "gastos.html";
      }, 1200);
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
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
