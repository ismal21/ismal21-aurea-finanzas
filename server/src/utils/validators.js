/**
 * Validación del lado del servidor.
 *
 * El frontend valida para dar buena experiencia, pero estas reglas son las
 * que de verdad protegen la aplicación: cualquiera puede saltarse el navegador
 * y enviar datos con Postman o curl.
 *
 * Los mensajes coinciden con los de public/js/registro.js para que la interfaz
 * se vea coherente cuando el backend devuelve errores por campo.
 */

import { esCategoriaValida } from "./categorias.js";

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BYTES_BCRYPT = 72; // bcrypt ignora todo lo que pase de 72 bytes

/**
 * Convierte un valor desconocido en string sin espacios en los extremos.
 * @param {unknown} valor
 * @returns {string}
 */
function texto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Valida los datos del formulario de registro.
 * @param {Record<string, unknown>} datos
 * @returns {{ errores: Record<string, string>, datos: { nombre: string, email: string, password: string, terminos: boolean } }}
 */
export function validarRegistro(datos = {}) {
  const errores = {};

  const nombre = texto(datos.nombre);
  const email = texto(datos.email).toLowerCase();
  // La contraseña NO se recorta: los espacios pueden formar parte de ella.
  const password = typeof datos.password === "string" ? datos.password : "";
  const confirmPassword =
    typeof datos.confirmPassword === "string" ? datos.confirmPassword : "";
  const terminos = datos.terminos === true;

  if (!nombre) {
    errores.nombre = "Escribe tu nombre completo.";
  } else if (nombre.length < 2) {
    errores.nombre = "El nombre debe tener al menos 2 caracteres.";
  } else if (nombre.length > 60) {
    errores.nombre = "El nombre no puede superar los 60 caracteres.";
  } else if (!/\p{L}/u.test(nombre)) {
    errores.nombre = "El nombre debe contener al menos una letra.";
  }

  if (!email) {
    errores.email = "Escribe tu correo electrónico.";
  } else if (email.length > 120) {
    errores.email = "El correo es demasiado largo.";
  } else if (!REGEX_EMAIL.test(email)) {
    errores.email = "Escribe un correo válido (ej.: ana@correo.com).";
  }

  if (!password) {
    errores.password = "Escribe una contraseña.";
  } else if (password.length < 8) {
    errores.password = "La contraseña debe tener al menos 8 caracteres.";
  } else if (
    password.length > MAX_BYTES_BCRYPT ||
    Buffer.byteLength(password, "utf8") > MAX_BYTES_BCRYPT
  ) {
    errores.password = "La contraseña no puede superar los 72 caracteres.";
  } else if (!/[A-Za-z]/.test(password)) {
    errores.password = "Incluye al menos una letra.";
  } else if (!/\d/.test(password)) {
    errores.password = "Incluye al menos un número.";
  }

  if (!confirmPassword) {
    errores.confirmPassword = "Repite tu contraseña.";
  } else if (confirmPassword !== password) {
    errores.confirmPassword = "Las contraseñas no coinciden.";
  }

  if (!terminos) {
    errores.terminos = "Debes aceptar los términos para continuar.";
  }

  return {
    errores,
    datos: { nombre, email, password, terminos },
  };
}

/**
 * Valida las credenciales del login.
 * Aquí solo comprobamos formato y presencia: la contraseña correcta la decide
 * la base de datos. No se exige longitud mínima para no romper cuentas antiguas.
 * @param {Record<string, unknown>} datos
 * @returns {{ errores: Record<string, string>, datos: { email: string, password: string, recordarme: boolean } }}
 */
export function validarLogin(datos = {}) {
  const errores = {};

  const email = texto(datos.email).toLowerCase();
  const password = typeof datos.password === "string" ? datos.password : "";
  const recordarme = datos.recordarme === true;

  if (!email) {
    errores.email = "Escribe tu correo electrónico.";
  } else if (email.length > 120) {
    errores.email = "El correo es demasiado largo.";
  } else if (!REGEX_EMAIL.test(email)) {
    errores.email = "Escribe un correo válido (ej.: ana@correo.com).";
  }

  if (!password) {
    errores.password = "Escribe tu contraseña.";
  } else if (Buffer.byteLength(password, "utf8") > MAX_BYTES_BCRYPT) {
    errores.password = "La contraseña no puede superar los 72 caracteres.";
  }

  return {
    errores,
    datos: { email, password, recordarme },
  };
}

/**
 * Comprueba que una fecha sea una fecha real en formato YYYY-MM-DD.
 * Evita aceptar cosas como 2026-02-31 o 2026-13-01.
 * @param {unknown} valor
 * @returns {boolean}
 */
export function esFechaValida(valor) {
  if (typeof valor !== "string" || !REGEX_FECHA.test(valor)) {
    return false;
  }

  const [anio, mes, dia] = valor.split("-").map(Number);

  if (anio < 1900 || anio > 2200) {
    return false;
  }

  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/**
 * Valida los datos de un gasto (crear o editar).
 * @param {Record<string, unknown>} datos
 * @returns {{ errores: Record<string, string>, datos: { nombre: string, categoria: string, fecha: string, monto: number } }}
 */
export function validarGasto(datos = {}) {
  const errores = {};

  const nombre = texto(datos.nombre);
  const categoria =
    typeof datos.categoria === "string" ? datos.categoria.trim() : "";
  const fecha = typeof datos.fecha === "string" ? datos.fecha.trim() : "";

  // Aceptamos número o texto ("125.50" o "125,50") y redondeamos a 2 decimales.
  const montoBruto =
    typeof datos.monto === "number"
      ? datos.monto
      : Number(String(datos.monto ?? "").replace(",", "."));
  const monto = Number.isFinite(montoBruto)
    ? Math.round(montoBruto * 100) / 100
    : NaN;

  if (!nombre) {
    errores.nombre = "Escribe el nombre del gasto.";
  } else if (nombre.length < 2) {
    errores.nombre = "El nombre debe tener al menos 2 caracteres.";
  } else if (nombre.length > 80) {
    errores.nombre = "El nombre no puede superar los 80 caracteres.";
  }

  if (!categoria) {
    errores.categoria = "Elige una categoría.";
  } else if (!esCategoriaValida(categoria)) {
    errores.categoria = "La categoría no es válida.";
  }

  if (!fecha) {
    errores.fecha = "Elige la fecha del gasto.";
  } else if (!esFechaValida(fecha)) {
    errores.fecha = "La fecha no es válida.";
  }

  if (!Number.isFinite(monto) || monto <= 0) {
    errores.monto = "Escribe un monto mayor que 0.";
  } else if (monto > 999_999_999.99) {
    errores.monto = "El monto es demasiado grande.";
  }

  return {
    errores,
    datos: { nombre, categoria, fecha, monto },
  };
}
