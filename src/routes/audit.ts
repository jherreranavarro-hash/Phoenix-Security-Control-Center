import { Router } from "express";
import { almacen } from "../lib/store";

export const auditRouter = Router();

auditRouter.get("/", (req, res) => {
  const limite = Number(req.query.limite ?? 200);
  res.json({ registros: almacen.listarAuditoria(limite) });
});
