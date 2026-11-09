/**
 * Rutas de gastos.
 * Todas requieren sesión: se montan bajo /api/gastos desde app.js.
 */

import { Router } from "express";
import {
  actualizarGasto,
  crearGasto,
  eliminarGasto,
  listarGastos,
  resumenGastos,
} from "../controllers/gastos.controller.js";
import { requiereSesion } from "../middlewares/requireAuth.js";

export const gastosRouter = Router();

gastosRouter.use(requiereSesion);

gastosRouter.get("/", listarGastos);
gastosRouter.get("/resumen", resumenGastos);
gastosRouter.post("/", crearGasto);
gastosRouter.put("/:id", actualizarGasto);
gastosRouter.delete("/:id", eliminarGasto);
