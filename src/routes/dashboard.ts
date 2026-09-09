import { Router } from "express";
import { isDemoMode } from "../config";
import { almacen } from "../lib/store";
import { obtenerHallazgosEfectivos } from "../services/assessmentService";
import {
  META_ANUAL,
  PUNTO_INFLEXION,
  calcularPuntajeGlobal,
  coberturaPorDominio,
  contarBrechasPorCriticidad,
  proyeccionMejora,
  rankingAccionesPrioritarias,
  tendenciaMensualDemostrativa,
} from "../services/scoringService";

export const dashboardRouter = Router();

dashboardRouter.get("/resumen", async (_req, res) => {
  const { hallazgos, fuente } = await obtenerHallazgosEfectivos();
  const puntaje = calcularPuntajeGlobal(hallazgos);
  const brechas = contarBrechasPorCriticidad(hallazgos);
  const cambiosPendientes = almacen.listarCambios().filter((c) => c.estado === "Aprobacion").length;
  const actividadReciente = almacen.listarAuditoria(10);

  res.json({
    modoDemostracion: isDemoMode,
    fuenteAssessment: fuente,
    puntajeGlobal: puntaje,
    puntoInflexion: PUNTO_INFLEXION,
    metaAnual: META_ANUAL,
    brechas,
    cambiosPendientesAprobacion: cambiosPendientes,
    actividadReciente,
    planMejoraRecomendado: rankingAccionesPrioritarias(hallazgos, 5).map((h) => ({
      id: h.id,
      nombre: h.nombre,
      dominio: h.dominio,
      criticidad: h.criticidad,
      proximaAccion: h.proximaAccion,
    })),
    indicadoresAvanceMensual: tendenciaMensualDemostrativa(),
    enlaces: {
      assessment: "/#/assessment",
      politicas: "/#/politicas",
      gobierno: "/#/gobierno",
      despliegue: "/#/despliegue",
    },
  });
});

dashboardRouter.get("/kpi", async (_req, res) => {
  const { hallazgos, fuente } = await obtenerHallazgosEfectivos();
  res.json({
    modoDemostracion: isDemoMode,
    fuenteAssessment: fuente,
    puntajeGlobal: calcularPuntajeGlobal(hallazgos),
    puntoInflexion: PUNTO_INFLEXION,
    metaAnual: META_ANUAL,
    coberturaPorDominio: coberturaPorDominio(hallazgos),
    proyeccion: proyeccionMejora(hallazgos),
    rankingAcciones: rankingAccionesPrioritarias(hallazgos, 8),
    tendenciaMensual: tendenciaMensualDemostrativa(),
  });
});
