import { Router } from "express";
import { almacen } from "../lib/store";
import { hallazgosDemo } from "../data/demoAssessment";
import { catalogoPoliticas } from "../data/policyCatalog";
import {
  actualizarAlcance,
  adjuntarEvidencia,
  confirmarDespliegue,
  crearCambio,
  guardarAlcanceComoEvidencia,
  obtenerCambio,
  registrarResultadoPiloto,
  transicionarEstado,
} from "../services/changeService";
import { calcularAfectadosPorAlcance } from "../services/deploymentService";

export const changesRouter = Router();

function manejarError(res: import("express").Response, error: unknown, codigo = 400): void {
  res.status(codigo).json({ error: error instanceof Error ? error.message : "Error desconocido." });
}

changesRouter.get("/", (req, res) => {
  const { estado, dominio } = req.query;
  let lista = almacen.listarCambios();
  if (estado) lista = lista.filter((c) => c.estado === estado);
  if (dominio) {
    lista = lista.filter((c) => {
      const politica = catalogoPoliticas.find((p) => p.id === c.politicaId);
      const hallazgo = hallazgosDemo.find((h) => h.id === c.hallazgoId);
      return politica?.producto === dominio || hallazgo?.dominio === dominio;
    });
  }
  res.json({ total: lista.length, cambios: lista });
});

changesRouter.get("/:id", (req, res) => {
  try {
    res.json({ cambio: obtenerCambio(req.params.id) });
  } catch (error) {
    manejarError(res, error, 404);
  }
});

changesRouter.post("/", (req, res) => {
  try {
    const cambio = crearCambio(req.body);
    res.status(201).json({ cambio });
  } catch (error) {
    manejarError(res, error);
  }
});

changesRouter.post("/desde-hallazgo/:hallazgoId", (req, res) => {
  const hallazgo = hallazgosDemo.find((h) => h.id === req.params.hallazgoId);
  if (!hallazgo) {
    res.status(404).json({ error: "Hallazgo no encontrado." });
    return;
  }
  const { solicitante, responsableTecnico, aprobador, justificacion } = req.body;
  try {
    const cambio = crearCambio({
      configuracionONombrePolitica: hallazgo.nombre,
      hallazgoId: hallazgo.id,
      politicaId: hallazgo.politicaRelacionadaId,
      solicitante,
      responsableTecnico: responsableTecnico ?? hallazgo.responsable,
      aprobador,
      riesgo: hallazgo.criticidad,
      justificacion: justificacion ?? `Cierre del hallazgo ${hallazgo.id}: ${hallazgo.queFalta}`,
      requisitosPrevios: hallazgo.prerrequisitos,
      impactoEsperado: hallazgo.porQueRelevante,
      planPruebas: hallazgo.validaciones.join("; "),
      planReversion: hallazgo.planReversion,
    });
    res.status(201).json({ cambio });
  } catch (error) {
    manejarError(res, error);
  }
});

changesRouter.post("/desde-politicas", (req, res) => {
  const { politicaIds, solicitante, responsableTecnico, aprobador, justificacion } = req.body as {
    politicaIds: string[];
    solicitante: string;
    responsableTecnico?: string;
    aprobador: string;
    justificacion?: string;
  };
  if (!Array.isArray(politicaIds) || politicaIds.length === 0) {
    res.status(400).json({ error: "Debe seleccionar al menos una política." });
    return;
  }
  try {
    const creados = politicaIds.map((id) => {
      const politica = catalogoPoliticas.find((p) => p.id === id);
      if (!politica) throw new Error(`Política ${id} no encontrada.`);
      return crearCambio({
        configuracionONombrePolitica: politica.nombre,
        politicaId: politica.id,
        solicitante,
        responsableTecnico: responsableTecnico ?? politica.responsable,
        aprobador,
        riesgo: politica.riesgo,
        justificacion: justificacion ?? `Implementación de la política de catálogo: ${politica.nombre}`,
        requisitosPrevios: politica.requisitosPrevios,
        impactoEsperado: politica.impactoOperacional,
        planPruebas: `Piloto controlado antes de extender "${politica.nombre}" a producción.`,
        planReversion: `Deshabilitar o revertir la configuración de "${politica.nombre}" a su estado anterior.`,
      });
    });
    res.status(201).json({ cambios: creados });
  } catch (error) {
    manejarError(res, error);
  }
});

changesRouter.patch("/:id/alcance", async (req, res) => {
  try {
    const cambio = actualizarAlcance(req.params.id, req.body);
    const afectados = await calcularAfectadosPorAlcance(cambio.alcance);
    cambio.alcance.totalUsuariosAfectados = afectados.totalUsuarios;
    cambio.alcance.totalEquiposAfectados = afectados.totalEquipos;
    almacen.guardarCambio(cambio);
    res.json({ cambio, afectados });
  } catch (error) {
    manejarError(res, error);
  }
});

changesRouter.post("/:id/guardar-alcance", (req, res) => {
  try {
    const { actor } = req.body;
    res.json({ cambio: guardarAlcanceComoEvidencia(req.params.id, actor) });
  } catch (error) {
    manejarError(res, error);
  }
});

changesRouter.post("/:id/confirmar-despliegue", (req, res) => {
  try {
    const { actor, ...confirmaciones } = req.body;
    res.json({ cambio: confirmarDespliegue(req.params.id, actor, confirmaciones) });
  } catch (error) {
    manejarError(res, error);
  }
});

changesRouter.post("/:id/resultado-piloto", (req, res) => {
  try {
    const { resultado, actor } = req.body;
    res.json({ cambio: registrarResultadoPiloto(req.params.id, resultado, actor) });
  } catch (error) {
    manejarError(res, error);
  }
});

changesRouter.post("/:id/evidencia", (req, res) => {
  try {
    const { titulo, url, actor } = req.body;
    res.json({ cambio: adjuntarEvidencia(req.params.id, titulo, url, actor) });
  } catch (error) {
    manejarError(res, error);
  }
});

changesRouter.post("/:id/transicion", (req, res) => {
  try {
    const { estado, actor, detalle } = req.body;
    res.json({ cambio: transicionarEstado(req.params.id, estado, actor, detalle) });
  } catch (error) {
    manejarError(res, error);
  }
});
