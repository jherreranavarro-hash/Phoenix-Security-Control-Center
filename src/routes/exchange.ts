import { Router } from "express";
import { requiereEscriturasHabilitadas } from "../middleware/requireWrites";
import { ejecutarAccionGobernada } from "../lib/governedAction";
import { actualizarExchange, listarUsuariosEfectivos, obtenerUsuarioEfectivo } from "../services/directoryService";

export const exchangeRouter = Router();

function manejarError(res: import("express").Response, error: unknown, codigo = 400): void {
  res.status(codigo).json({ error: error instanceof Error ? error.message : "Error desconocido." });
}

exchangeRouter.get("/buzones-compartidos", async (_req, res) => {
  try {
    res.json({ buzones: (await listarUsuariosEfectivos()).filter((u) => u.buzon.esCompartido) });
  } catch (error) {
    manejarError(res, error, 502);
  }
});

exchangeRouter.get("/:userId", async (req, res) => {
  try {
    const usuario = await obtenerUsuarioEfectivo(req.params.userId);
    if (!usuario) {
      res.status(404).json({ error: "Usuario no encontrado." });
      return;
    }
    res.json({ buzon: usuario.buzon });
  } catch (error) {
    manejarError(res, error, 502);
  }
});

exchangeRouter.patch("/:userId", requiereEscriturasHabilitadas, async (req, res) => {
  try {
    const { alias, reenvio, respuestaAutomatica, delegados, esCompartido, solicitante, aprobador, justificacion } = req.body;
    const usuario = await ejecutarAccionGobernada(
      {
        solicitante,
        aprobador,
        justificacion,
        accion: "Modificar configuración de Exchange",
        entidad: "Buzon",
        entidadId: req.params.userId,
      },
      () => actualizarExchange(req.params.userId, { alias, reenvio, respuestaAutomatica, delegados, esCompartido }),
    );
    res.json({ usuario });
  } catch (error) {
    manejarError(res, error);
  }
});
