/**
 * Middlewares de cierre de la cadena:
 *   - notFound: responde 404 cuando ninguna ruta coincidió.
 *   - errorHandler: captura cualquier error y responde sin filtrar detalles.
 */

/**
 * 404 para rutas no registradas.
 * Las rutas /api/* siempre responden JSON.
 */
export function notFound(req, res) {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      ok: false,
      message: "Ruta no encontrada.",
    });
  }

  return res.status(404).send("No encontrado");
}

/**
 * Manejador central de errores. Express lo reconoce por tener 4 parámetros.
 * @param {Error & { type?: string, status?: number }} error
 */
export function errorHandler(error, req, res, next) {
  // Si la respuesta ya empezó a enviarse, no se puede cambiar el estado.
  if (res.headersSent) {
    return next(error);
  }

  // JSON mal formado enviado por el cliente.
  if (error.type === "entity.parse.failed" || error instanceof SyntaxError) {
    return res.status(400).json({
      ok: false,
      message: "El cuerpo de la petición no es JSON válido.",
    });
  }

  // En desarrollo es útil ver el error completo en la terminal.
  console.error("Error no controlado:", error);

  if (req.path.startsWith("/api/")) {
    return res.status(500).json({
      ok: false,
      message: "Error interno del servidor.",
    });
  }

  return res.status(500).send("Error interno del servidor.");
}
