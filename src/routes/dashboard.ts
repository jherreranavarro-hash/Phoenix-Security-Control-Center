import { Router } from "express";
import { isDemoMode } from "../config";
import { almacen } from "../lib/store";
import { hallazgosDemo } from "../data/demoAssessment";
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

dashboardRouter.get("/resumen", (_req, res) => {
  const puntaje = calcularPuntajeGlobal();
  const brechas = contarBrechasPorCriticidad();
  const cambiosPendientes = almacen.listarCambios().filter((c) => c.estado === "Aprobacion").length;
  const actividadReciente = almacen.listarAuditoria(10);

  res.json({
    modoDemostracion: isDemoMode,
    puntajeGlobal: puntaje,
    puntoInflexion: PUNTO_INFLEXION,
    metaAnual: META_ANUAL,
    brechas,
    cambiosPendientesAprobacion: cambiosPendientes,
    actividadReciente,
    planMejoraRecomendado: rankingAccionesPrioritarias(hallazgosDemo, 5).map((h) => ({
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

dashboardRouter.get("/kpi", (_req, res) => {
  res.json({
    modoDemostracion: isDemoMode,
    puntajeGlobal: calcularPuntajeGlobal(),
    puntoInflexion: PUNTO_INFLEXION,
    metaAnual: META_ANUAL,
    coberturaPorDominio: coberturaPorDominio(),
    proyeccion: proyeccionMejora(),
    rankingAcciones: rankingAccionesPrioritarias(hallazgosDemo, 8),
    tendenciaMensual: tendenciaMensualDemostrativa(),
  });
});
