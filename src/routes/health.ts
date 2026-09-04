import { Router } from "express";
import { isDemoMode, productionGraphConfigured, readOnlyGraphConfigured } from "../config";
import { escriturasEstanHabilitadas } from "../lib/writeState";

export const healthRouter = Router();

healthRouter.get("/", (req, res) => {
  res.json({
    estado: "ok",
    version: "0.1.0",
    modoDemostracion: isDemoMode,
    lecturaConectadaAGraph: readOnlyGraphConfigured,
    produccionConectadaAGraph: productionGraphConfigured,
    escriturasHabilitadas: escriturasEstanHabilitadas(),
    fecha: new Date().toISOString(),
    usuario: req.usuario,
  });
});
