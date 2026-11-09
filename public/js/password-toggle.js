/**
 * ============================================================================
 * AUREA FINANZAS · Mostrar u ocultar contraseñas
 * ----------------------------------------------------------------------------
 * Cualquier botón con el atributo data-password-toggle="id-del-input"
 * alterna ese campo entre type="password" y type="text".
 *
 * Se usa en login.html y registro.html:
 *   - login: contraseña
 *   - registro: contraseña y confirmación (cada una con su propio botón)
 *
 * Accesibilidad:
 *   - aria-pressed indica si la contraseña está visible.
 *   - aria-label y title cambian entre "Mostrar" y "Ocultar".
 *   - El foco vuelve al campo para poder seguir escribiendo.
 * ============================================================================
 */

"use strict";

document.querySelectorAll("[data-password-toggle]").forEach((boton) => {
  const input = document.getElementById(boton.dataset.passwordToggle);

  if (!input) return;

  /**
   * Aplica el estado visible/oculto al campo y al botón.
   * @param {boolean} visible
   */
  function actualizarEstado(visible) {
    input.type = visible ? "text" : "password";
    boton.setAttribute("aria-pressed", String(visible));
    boton.setAttribute("aria-label", visible ? "Ocultar contraseña" : "Mostrar contraseña");
    boton.title = visible ? "Ocultar contraseña" : "Mostrar contraseña";
  }

  boton.addEventListener("click", () => {
    const estabaOculta = input.type === "password";
    actualizarEstado(estabaOculta);

    // Devolvemos el foco al campo para no interrumpir la escritura.
    input.focus({ preventScroll: true });

    // Colocamos el cursor al final del texto.
    const final = input.value.length;
    input.setSelectionRange?.(final, final);
  });

  // Si el formulario se reinicia (por ejemplo, tras un registro correcto),
  // la contraseña vuelve a ocultarse.
  boton.closest("form")?.addEventListener("reset", () => actualizarEstado(false));
});
