import { Router } from "express";
import { isDemoMode } from "../config";
import { obtenerHallazgosEfectivos } from "../services/assessmentService";

export const assessmentRouter = Router();

assessmentRouter.get("/", async (req, res) => {
  try {
    const { dominio, estado, criticidad } = req.query;
    const { hallazgos, fuente } = await obtenerHallazgosEfectivos();
    let lista = hallazgos;
    if (dominio) lista = lista.filter((h) => h.dominio === dominio);
    if (estado) lista = lista.filter((h) => h.estado === estado);
    if (criticidad) lista = lista.filter((h) => h.criticidad === criticidad);
    res.json({ modoDemostracion: isDemoMode, fuenteAssessment: fuente, total: lista.length, hallazgos: lista });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Error desconocido." });
  }
});

assessmentRouter.get("/:id", async (req, res) => {
  const { hallazgos, fuente } = await obtenerHallazgosEfectivos();
  const hallazgo = hallazgos.find((h) => h.id === req.params.id);
  if (!hallazgo) {
    res.status(404).json({ error: "Hallazgo no encontrado." });
    return;
  }
  res.json({ modoDemostracion: isDemoMode, fuenteAssessment: fuente, hallazgo });
});
