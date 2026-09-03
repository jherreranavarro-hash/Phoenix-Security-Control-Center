import { Router } from "express";
import { config, isDemoMode, productionGraphConfigured, readOnlyGraphConfigured } from "../config";

export const healthRouter = Router();

healthRouter.get("/", (req, res) => {
  res.json({
    estado: "ok",
    version: "0.1.0",
    modoDemostracion: isDemoMode,
    lecturaConectadaAGraph: readOnlyGraphConfigured,
    produccionConectadaAGraph: productionGraphConfigured,
    escriturasHabilitadas: config.enableWrites,
    fecha: new Date().toISOString(),
    usuario: req.usuario,
  });
});
