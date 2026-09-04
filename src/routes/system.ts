import { Router } from "express";
import { productionGraphConfigured, readOnlyGraphConfigured } from "../config";
import { requiereRolGobierno } from "../middleware/requireWrites";
import { escriturasEstanHabilitadas, establecerEscrituras } from "../lib/writeState";
import { invalidarCacheDirectorio } from "../services/directoryService";
import { auditar } from "../lib/audit";

export const systemRouter = Router();

systemRouter.get("/estado", (_req, res) => {
  res.json({
    lecturaConectadaAGraph: readOnlyGraphConfigured,
    produccionConfigurada: productionGraphConfigured,
    escriturasHabilitadas: escriturasEstanHabilitadas(),
  });
});

systemRouter.post("/conectar", requiereRolGobierno, (req, res) => {
  if (!productionGraphConfigured) {
    res.status(403).json({
      error:
        "No hay credenciales de producción configuradas en el servidor (PHX_PROD_CLIENT_ID/SECRET). Configúralas y reinicia antes de poder conectar.",
    });
    return;
  }
  establecerEscrituras(true);
  invalidarCacheDirectorio();
  auditar({
    actor: req.usuario!.upn,
    accion: "Conectar escrituras de producción",
    entidad: "Sistema",
    entidadId: "escrituras",
    resultado: "Exito",
    detalle: "Las escrituras reales contra el tenant quedaron habilitadas desde la interfaz.",
  });
  res.json({ escriturasHabilitadas: true });
});

systemRouter.post("/desconectar", requiereRolGobierno, (req, res) => {
  establecerEscrituras(false);
  auditar({
    actor: req.usuario!.upn,
    accion: "Desconectar escrituras de producción",
    entidad: "Sistema",
    entidadId: "escrituras",
    resultado: "Exito",
  });
  res.json({ escriturasHabilitadas: false });
});
