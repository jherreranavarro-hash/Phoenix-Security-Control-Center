import { Router } from "express";
import { isDemoMode } from "../config";
import { requiereEscriturasHabilitadas } from "../middleware/requireWrites";
import { ejecutarAccionGobernada } from "../lib/governedAction";
import {
  actualizarRoles,
  bloquearUsuario,
  crearUsuario,
  fuenteDirectorio,
  invalidarCacheDirectorio,
  listarUsuariosEfectivos,
  obtenerUsuarioEfectivo,
} from "../services/directoryService";

export const usersRouter = Router();

function manejarError(res: import("express").Response, error: unknown, codigo = 400): void {
  res.status(codigo).json({ error: error instanceof Error ? error.message : "Error desconocido." });
}

usersRouter.get("/", async (req, res) => {
  try {
    const { buscar, area, estado, licencia } = req.query as Record<string, string | undefined>;
    let lista = await listarUsuariosEfectivos();
    if (buscar) {
      const q = buscar.toLowerCase();
      lista = lista.filter(
        (u) => u.displayName.toLowerCase().includes(q) || u.userPrincipalName.toLowerCase().includes(q) || u.area.toLowerCase().includes(q),
      );
    }
    if (area) lista = lista.filter((u) => u.area === area);
    if (estado) lista = lista.filter((u) => (estado === "activo" ? u.accountEnabled : !u.accountEnabled));
    if (licencia) lista = lista.filter((u) => (licencia === "ninguna" ? u.licencias.length === 0 : u.licencias.includes(licencia)));

    res.json({ modoDemostracion: isDemoMode, fuente: await fuenteDirectorio(), total: lista.length, usuarios: lista });
  } catch (error) {
    manejarError(res, error, 502);
  }
});

usersRouter.get("/:id", async (req, res) => {
  try {
    const usuario = await obtenerUsuarioEfectivo(req.params.id);
    if (!usuario) {
      res.status(404).json({ error: "Usuario no encontrado." });
      return;
    }
    res.json({ usuario });
  } catch (error) {
    manejarError(res, error, 502);
  }
});

usersRouter.post("/", requiereEscriturasHabilitadas, async (req, res) => {
  try {
    const { displayName, area, cargo, userPrincipalName, solicitante, aprobador, justificacion } = req.body;
    const usuario = await ejecutarAccionGobernada(
      {
        solicitante,
        aprobador,
        justificacion,
        accion: "Crear usuario",
        entidad: "Usuario",
        entidadId: userPrincipalName,
      },
      () => crearUsuario({ displayName, area, cargo, userPrincipalName }),
    );
    res.status(201).json({ usuario });
  } catch (error) {
    manejarError(res, error);
  }
});

usersRouter.post("/:id/bloqueo", requiereEscriturasHabilitadas, async (req, res) => {
  try {
    const { bloquear, solicitante, aprobador, justificacion } = req.body;
    const usuario = await ejecutarAccionGobernada(
      {
        solicitante,
        aprobador,
        justificacion,
        accion: bloquear ? "Bloquear cuenta" : "Desbloquear cuenta",
        entidad: "Usuario",
        entidadId: req.params.id,
      },
      () => {
        bloquearUsuario(req.params.id, bloquear);
        return obtenerUsuarioEfectivo(req.params.id);
      },
    );
    res.json({ usuario });
  } catch (error) {
    manejarError(res, error);
  }
});

usersRouter.post("/:id/roles", requiereEscriturasHabilitadas, async (req, res) => {
  try {
    const { roles, solicitante, aprobador, justificacion } = req.body;
    const usuario = await ejecutarAccionGobernada(
      {
        solicitante,
        aprobador,
        justificacion,
        accion: "Modificar roles de Entra ID",
        entidad: "Usuario",
        entidadId: req.params.id,
      },
      () => actualizarRoles(req.params.id, roles),
    );
    res.json({ usuario });
  } catch (error) {
    manejarError(res, error);
  }
});

// Fuerza una nueva lectura desde Microsoft Graph en la siguiente consulta.
usersRouter.post("/actualizar-desde-directorio", (_req, res) => {
  invalidarCacheDirectorio();
  res.json({ ok: true });
});
