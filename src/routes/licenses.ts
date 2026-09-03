import { Router } from "express";
import { config } from "../config";
import { requiereAprobador, requiereEscriturasHabilitadas } from "../middleware/requireWrites";
import { ejecutarAccionGobernada } from "../lib/governedAction";
import { asignarLicenciasUsuario, listarSkusEfectivos, listarUsuariosEfectivos, obtenerUsuarioEfectivo } from "../services/directoryService";
import { ejecutarCampaña, previsualizarCampaña } from "../services/licenseCampaignService";
import { almacen } from "../lib/store";

export const licensesRouter = Router();

function manejarError(res: import("express").Response, error: unknown, codigo = 400): void {
  res.status(codigo).json({ error: error instanceof Error ? error.message : "Error desconocido." });
}

licensesRouter.get("/skus", async (_req, res) => {
  try {
    res.json({ skus: await listarSkusEfectivos() });
  } catch (error) {
    manejarError(res, error, 502);
  }
});

licensesRouter.get("/asignaciones", async (_req, res) => {
  try {
    const usuarios = await listarUsuariosEfectivos();
    res.json({
      total: usuarios.length,
      sinLicencia: usuarios.filter((u) => u.licencias.length === 0).length,
      usuarios: usuarios.map((u) => ({ id: u.id, displayName: u.displayName, area: u.area, licencias: u.licencias, accountEnabled: u.accountEnabled })),
    });
  } catch (error) {
    manejarError(res, error, 502);
  }
});

licensesRouter.post("/:userId", requiereEscriturasHabilitadas, async (req, res) => {
  try {
    const { agregar = [], quitar = [], solicitante, aprobador, justificacion } = req.body;
    const skusAntes = (await obtenerUsuarioEfectivo(req.params.userId))?.licencias ?? [];
    const skus = await listarSkusEfectivos();
    for (const skuPart of agregar as string[]) {
      const sku = skus.find((s) => s.skuPartNumber === skuPart);
      if (sku && sku.disponibles <= 0) {
        throw new Error(`No hay licencias disponibles del SKU "${sku.nombreComercial}" (${sku.disponibles} disponibles).`);
      }
    }
    const usuario = await ejecutarAccionGobernada(
      {
        solicitante,
        aprobador,
        justificacion,
        accion: "Modificar licencias asignadas",
        entidad: "Licencia",
        entidadId: req.params.userId,
      },
      () => asignarLicenciasUsuario(req.params.userId, agregar, quitar),
    );
    res.json({ usuario, impacto: { licenciasAntes: skusAntes, licenciasDespues: usuario.licencias } });
  } catch (error) {
    manejarError(res, error);
  }
});

licensesRouter.get("/campania/vista-previa", async (_req, res) => {
  try {
    res.json(await previsualizarCampaña());
  } catch (error) {
    manejarError(res, error, 500);
  }
});

licensesRouter.post("/campania/ejecutar", requiereEscriturasHabilitadas, requiereAprobador, async (req, res) => {
  try {
    const { frase, tokenRevision, confirmoRevisionImpacto } = req.body;
    const resultado = await ejecutarCampaña({
      aprobadorUpn: req.usuario!.upn,
      frase,
      tokenRevision,
      confirmoRevisionImpacto,
    });
    res.json({
      resultado,
      recomendacion: "Cambio finalizado. Se recomienda dejar nuevamente PHX_ENABLE_WRITES=false hasta la próxima ventana aprobada.",
      aprobadorConfigurado: config.licenseApproverUpn,
    });
  } catch (error) {
    manejarError(res, error);
  }
});

licensesRouter.get("/campania/historial", (_req, res) => {
  res.json({ campañas: almacen.listarCampañas() });
});
