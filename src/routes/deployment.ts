import { Router } from "express";
import { listarGruposEfectivos, listarUsuariosEfectivos } from "../services/directoryService";
import { calcularAfectadosPorAlcance } from "../services/deploymentService";

export const deploymentRouter = Router();

function manejarError(res: import("express").Response, error: unknown, codigo = 400): void {
  res.status(codigo).json({ error: error instanceof Error ? error.message : "Error desconocido." });
}

deploymentRouter.get("/candidatos", async (req, res) => {
  try {
    const { buscar, area } = req.query as { buscar?: string; area?: string };
    let usuarios = await listarUsuariosEfectivos();
    if (buscar) {
      const q = buscar.toLowerCase();
      usuarios = usuarios.filter(
        (u) => u.displayName.toLowerCase().includes(q) || u.userPrincipalName.toLowerCase().includes(q) || u.area.toLowerCase().includes(q),
      );
    }
    if (area) usuarios = usuarios.filter((u) => u.area === area);

    res.json({
      usuarios: usuarios.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        userPrincipalName: u.userPrincipalName,
        area: u.area,
        esCuentaEmergencia: u.esCuentaEmergencia,
      })),
      grupos: (await listarGruposEfectivos()).map((g) => ({
        id: g.id,
        nombre: g.nombre,
        clasificacion: g.clasificacion,
        esGrupoEmergencia: g.esGrupoEmergencia,
        totalMiembros: g.miembros.length,
      })),
    });
  } catch (error) {
    manejarError(res, error, 502);
  }
});

deploymentRouter.post("/calcular-impacto", async (req, res) => {
  try {
    res.json(await calcularAfectadosPorAlcance(req.body));
  } catch (error) {
    manejarError(res, error);
  }
});
