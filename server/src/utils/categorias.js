/**
 * Categorías permitidas para los gastos.
 * Deben coincidir con las opciones del formulario en public/gastos.html.
 */

export const CATEGORIAS = [
  "Alimentación",
  "Vivienda",
  "Transporte",
  "Salud",
  "Ocio",
  "Educación",
  "Compras",
  "Servicios",
  "Otros",
];

/**
 * @param {unknown} valor
 * @returns {boolean}
 */
export function esCategoriaValida(valor) {
  return typeof valor === "string" && CATEGORIAS.includes(valor);
}
