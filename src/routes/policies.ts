import { Router } from "express";
import { isDemoMode } from "../config";
import { catalogoPoliticas } from "../data/policyCatalog";

export const policiesRouter = Router();

policiesRouter.get("/", (req, res) => {
  const { producto, estado, riesgo } = req.query;
  let lista = catalogoPoliticas;
  if (producto) lista = lista.filter((p) => p.producto === producto);
  if (estado) lista = lista.filter((p) => p.estado === estado);
  if (riesgo) lista = lista.filter((p) => p.riesgo === riesgo);
  res.json({ modoDemostracion: isDemoMode, total: lista.length, politicas: lista });
});

policiesRouter.get("/:id", (req, res) => {
  const politica = catalogoPoliticas.find((p) => p.id === req.params.id);
  if (!politica) {
    res.status(404).json({ error: "Política no encontrada en el catálogo." });
    return;
  }
  res.json({ modoDemostracion: isDemoMode, politica });
});
