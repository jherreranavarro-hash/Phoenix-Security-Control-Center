import { Router } from "express";
import { isDemoMode } from "../config";
import { hallazgosDemo } from "../data/demoAssessment";

export const assessmentRouter = Router();

assessmentRouter.get("/", (req, res) => {
  const { dominio, estado, criticidad } = req.query;
  let lista = hallazgosDemo;
  if (dominio) lista = lista.filter((h) => h.dominio === dominio);
  if (estado) lista = lista.filter((h) => h.estado === estado);
  if (criticidad) lista = lista.filter((h) => h.criticidad === criticidad);
  res.json({ modoDemostracion: isDemoMode, total: lista.length, hallazgos: lista });
});

assessmentRouter.get("/:id", (req, res) => {
  const hallazgo = hallazgosDemo.find((h) => h.id === req.params.id);
  if (!hallazgo) {
    res.status(404).json({ error: "Hallazgo no encontrado." });
    return;
  }
  res.json({ modoDemostracion: isDemoMode, hallazgo });
});
