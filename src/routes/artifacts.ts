import { Router } from "express";
import { generarArtefacto, generarInformeGobierno, generarInventarioGeneral, type TipoArtefacto } from "../services/artifactService";
import { generarInformeFormalAssessment } from "../services/formalReportService";
import { generarInformePoliticasRecomendadas } from "../services/policyReportService";

export const artifactsRouter = Router();

const TIPOS: TipoArtefacto[] = [
  "politica-gobierno",
  "procedimiento-operativo",
  "evaluacion-riesgo",
  "plan-pruebas-piloto",
  "registro-cambio-reversion",
  "informe-implementacion",
  "plan-mejora-continua",
  "inventario-configuraciones",
];

artifactsRouter.get("/tipos", (_req, res) => {
  res.json({ tipos: TIPOS });
});

artifactsRouter.get("/inventario", (_req, res) => {
  const { nombreArchivo, contenido } = generarInventarioGeneral();
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}"`);
  res.send(contenido);
});

artifactsRouter.get("/informe-gobierno", async (_req, res) => {
  try {
    const { nombreArchivo, contenido } = await generarInformeGobierno();
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}"`);
    res.send(contenido);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Error generando el informe." });
  }
});

artifactsRouter.get("/informe-gobierno.docx", async (_req, res) => {
  try {
    const buffer = await generarInformeFormalAssessment();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="informe-assessment-gobierno-${Date.now()}.docx"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error generando el informe." });
  }
});

artifactsRouter.get("/informe-politicas.docx", async (_req, res) => {
  try {
    const buffer = await generarInformePoliticasRecomendadas();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="informe-politicas-recomendadas-${Date.now()}.docx"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error generando el informe." });
  }
});

artifactsRouter.get("/:tipo/:cambioId", (req, res) => {
  const tipo = req.params.tipo as TipoArtefacto;
  if (!TIPOS.includes(tipo)) {
    res.status(400).json({ error: "Tipo de artefacto no reconocido." });
    return;
  }
  try {
    const { nombreArchivo, contenido } = generarArtefacto(tipo, req.params.cambioId);
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}"`);
    res.send(contenido);
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Error desconocido." });
  }
});
