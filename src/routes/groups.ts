import { Router } from "express";
import { requiereEscriturasHabilitadas } from "../middleware/requireWrites";
import { ejecutarAccionGobernada } from "../lib/governedAction";
import { actualizarMembresia, crearGrupo, listarGruposEfectivos, obtenerUsuarioEfectivo } from "../services/directoryService";

export const groupsRouter = Router();

function manejarError(res: import("express").Response, error: unknown, codigo = 400): void {
  res.status(codigo).json({ error: error instanceof Error ? error.message : "Error desconocido." });
}

groupsRouter.get("/", async (req, res) => {
  try {
    const { clasificacion, proposito } = req.query as Record<string, string | undefined>;
    let lista = await listarGruposEfectivos();
    if (clasificacion) lista = lista.filter((g) => (g.clasificacion as string[]).includes(clasificacion));
    if (proposito) lista = lista.filter((g) => g.proposito === proposito);
    res.json({ total: lista.length, grupos: lista });
  } catch (error) {
    manejarError(res, error, 502);
  }
});

groupsRouter.post("/", requiereEscriturasHabilitadas, async (req, res) => {
  try {
    const { nombre, descripcion, clasificacion, proposito, solicitante, aprobador, justificacion } = req.body;
    const grupo = await ejecutarAccionGobernada(
      { solicitante, aprobador, justificacion, accion: "Crear grupo", entidad: "Grupo", entidadId: nombre },
      () => crearGrupo({ nombre, descripcion, clasificacion, proposito }),
    );
    res.status(201).json({ grupo });
  } catch (error) {
    manejarError(res, error);
  }
});

groupsRouter.post("/:id/miembros", requiereEscriturasHabilitadas, async (req, res) => {
  try {
    const { usuarioId, agregar, solicitante, aprobador, justificacion } = req.body;
    const grupo = (await listarGruposEfectivos()).find((g) => g.id === req.params.id);
    if (!grupo) throw new Error(`Grupo ${req.params.id} no encontrado.`);
    await ejecutarAccionGobernada(
      {
        solicitante,
        aprobador,
        justificacion,
        accion: agregar ? "Agregar miembro a grupo" : "Quitar miembro de grupo",
        entidad: "Grupo",
        entidadId: req.params.id,
      },
      () => actualizarMembresia(usuarioId, grupo.nombre, agregar),
    );
    res.json({ usuario: await obtenerUsuarioEfectivo(usuarioId), grupos: await listarGruposEfectivos() });
  } catch (error) {
    manejarError(res, error);
  }
});
