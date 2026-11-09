/**
 * Controladores de gastos.
 * Todas las consultas filtran por user_id: un usuario nunca puede ver ni
 * modificar los gastos de otro.
 */

import { pool } from "../db/pool.js";
import { esCategoriaValida } from "../utils/categorias.js";
import { esFechaValida, validarGasto } from "../utils/validators.js";

/**
 * Construye el WHERE y los valores parametrizados a partir de los filtros
 * de la URL (categoria, desde, hasta).
 * @param {number|string} userId
 * @param {Record<string, unknown>} query
 * @returns {{ where: string, valores: unknown[] } | { error: string }}
 */
function construirFiltros(userId, query) {
  const condiciones = ["user_id = $1"];
  const valores = [userId];

  const { categoria, desde, hasta } = query;

  if (categoria) {
    if (!esCategoriaValida(categoria)) {
      return { error: "La categoría no es válida." };
    }

    valores.push(categoria);
    condiciones.push(`categoria = $${valores.length}`);
  }

  if (desde) {
    if (!esFechaValida(desde)) {
      return { error: "La fecha inicial no es válida." };
    }

    valores.push(desde);
    condiciones.push(`fecha >= $${valores.length}::date`);
  }

  if (hasta) {
    if (!esFechaValida(hasta)) {
      return { error: "La fecha final no es válida." };
    }

    valores.push(hasta);
    condiciones.push(`fecha <= $${valores.length}::date`);
  }

  if (desde && hasta && esFechaValida(desde) && esFechaValida(hasta) && desde > hasta) {
    return { error: "La fecha inicial no puede ser posterior a la final." };
  }

  return { where: condiciones.join(" AND "), valores };
}

/**
 * Comprueba que el id de la URL sea un entero positivo.
 * @param {unknown} valor
 * @returns {boolean}
 */
function idValido(valor) {
  return typeof valor === "string" && /^\d+$/.test(valor) && Number(valor) > 0;
}

/**
 * GET /api/gastos?categoria=&desde=&hasta=
 */
export async function listarGastos(req, res) {
  const filtros = construirFiltros(req.session.user.id, req.query);

  if (filtros.error) {
    return res.status(400).json({ ok: false, message: filtros.error });
  }

  const { rows } = await pool.query(
    `SELECT id,
            nombre,
            categoria,
            to_char(fecha, 'YYYY-MM-DD') AS fecha,
            monto::float8 AS monto,
            created_at,
            updated_at
     FROM expenses
     WHERE ${filtros.where}
     ORDER BY fecha DESC, id DESC
     LIMIT 1000`,
    filtros.valores
  );

  return res.json({
    ok: true,
    gastos: rows,
    cantidad: rows.length,
  });
}

/**
 * GET /api/gastos/resumen?categoria=&desde=&hasta=
 * Devuelve total, cantidad, gasto por mes y gasto por categoría.
 */
export async function resumenGastos(req, res) {
  const filtros = construirFiltros(req.session.user.id, req.query);

  if (filtros.error) {
    return res.status(400).json({ ok: false, message: filtros.error });
  }

  const [totales, porMes, porCategoria] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(monto), 0)::float8 AS total,
              COUNT(*)::int AS cantidad
       FROM expenses
       WHERE ${filtros.where}`,
      filtros.valores
    ),
    pool.query(
      `SELECT to_char(date_trunc('month', fecha), 'YYYY-MM') AS mes,
              SUM(monto)::float8 AS total
       FROM expenses
       WHERE ${filtros.where}
       GROUP BY 1
       ORDER BY 1`,
      filtros.valores
    ),
    pool.query(
      `SELECT categoria,
              SUM(monto)::float8 AS total,
              COUNT(*)::int AS cantidad
       FROM expenses
       WHERE ${filtros.where}
       GROUP BY categoria
       ORDER BY total DESC`,
      filtros.valores
    ),
  ]);

  return res.json({
    ok: true,
    resumen: {
      total: totales.rows[0].total,
      cantidad: totales.rows[0].cantidad,
      porMes: porMes.rows,
      porCategoria: porCategoria.rows,
    },
  });
}

/**
 * POST /api/gastos
 */
export async function crearGasto(req, res) {
  const { errores, datos } = validarGasto(req.body);

  if (Object.keys(errores).length > 0) {
    return res.status(400).json({
      ok: false,
      message: "Revisa los datos del gasto.",
      errors: errores,
    });
  }

  const { rows } = await pool.query(
    `INSERT INTO expenses (user_id, nombre, categoria, fecha, monto)
     VALUES ($1, $2, $3, $4::date, $5)
     RETURNING id,
               nombre,
               categoria,
               to_char(fecha, 'YYYY-MM-DD') AS fecha,
               monto::float8 AS monto,
               created_at,
               updated_at`,
    [req.session.user.id, datos.nombre, datos.categoria, datos.fecha, datos.monto]
  );

  return res.status(201).json({
    ok: true,
    message: "Gasto creado correctamente.",
    gasto: rows[0],
  });
}

/**
 * PUT /api/gastos/:id
 */
export async function actualizarGasto(req, res) {
  if (!idValido(req.params.id)) {
    return res.status(400).json({ ok: false, message: "El gasto no es válido." });
  }

  const { errores, datos } = validarGasto(req.body);

  if (Object.keys(errores).length > 0) {
    return res.status(400).json({
      ok: false,
      message: "Revisa los datos del gasto.",
      errors: errores,
    });
  }

  const { rows } = await pool.query(
    `UPDATE expenses
     SET nombre = $1,
         categoria = $2,
         fecha = $3::date,
         monto = $4,
         updated_at = now()
     WHERE id = $5 AND user_id = $6
     RETURNING id,
               nombre,
               categoria,
               to_char(fecha, 'YYYY-MM-DD') AS fecha,
               monto::float8 AS monto,
               created_at,
               updated_at`,
    [
      datos.nombre,
      datos.categoria,
      datos.fecha,
      datos.monto,
      req.params.id,
      req.session.user.id,
    ]
  );

  if (rows.length === 0) {
    return res.status(404).json({
      ok: false,
      message: "Gasto no encontrado.",
    });
  }

  return res.json({
    ok: true,
    message: "Gasto actualizado correctamente.",
    gasto: rows[0],
  });
}

/**
 * DELETE /api/gastos/:id
 */
export async function eliminarGasto(req, res) {
  if (!idValido(req.params.id)) {
    return res.status(400).json({ ok: false, message: "El gasto no es válido." });
  }

  const { rows } = await pool.query(
    `DELETE FROM expenses
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [req.params.id, req.session.user.id]
  );

  if (rows.length === 0) {
    return res.status(404).json({
      ok: false,
      message: "Gasto no encontrado.",
    });
  }

  return res.json({
    ok: true,
    message: "Gasto eliminado correctamente.",
  });
}
