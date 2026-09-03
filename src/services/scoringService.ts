import { hallazgosDemo } from "../data/demoAssessment";
import type { Criticidad, Dominio, Hallazgo } from "../types";

const PESO_CRITICIDAD: Record<Criticidad, number> = { Critica: 4, Alta: 3, Media: 2, Baja: 1 };
const PUNTAJE_ESTADO: Record<string, number> = { Implementado: 100, Parcial: 50, Brecha: 0 };

export const PUNTO_INFLEXION = 70;
export const META_ANUAL = 85;

const DOMINIOS_EVALUABLES: Dominio[] = ["EntraID", "Intune", "Defender", "Purview", "Exchange"];
const METAS_DOMINIO: Record<string, number> = {
  EntraID: 90,
  Intune: 85,
  Defender: 90,
  Purview: 75,
  Exchange: 80,
};

function hallazgosEvaluables(lista: Hallazgo[] = hallazgosDemo): Hallazgo[] {
  return lista.filter((h) => h.estado === "Implementado" || h.estado === "Parcial" || h.estado === "Brecha");
}

export function calcularPuntajeGlobal(lista: Hallazgo[] = hallazgosDemo): number {
  const evaluables = hallazgosEvaluables(lista);
  if (evaluables.length === 0) return 0;
  const sumaPesos = evaluables.reduce((acc, h) => acc + PESO_CRITICIDAD[h.criticidad], 0);
  const sumaPonderada = evaluables.reduce((acc, h) => acc + PESO_CRITICIDAD[h.criticidad] * PUNTAJE_ESTADO[h.estado], 0);
  return Math.round(sumaPonderada / sumaPesos);
}

export function contarBrechasPorCriticidad(lista: Hallazgo[] = hallazgosDemo) {
  const brechas = lista.filter((h) => h.estado === "Brecha");
  return {
    criticas: brechas.filter((h) => h.criticidad === "Critica").length,
    altas: brechas.filter((h) => h.criticidad === "Alta").length,
    medias: brechas.filter((h) => h.criticidad === "Media").length,
    bajas: brechas.filter((h) => h.criticidad === "Baja").length,
    implementados: lista.filter((h) => h.estado === "Implementado").length,
  };
}

export function coberturaPorDominio(lista: Hallazgo[] = hallazgosDemo) {
  return DOMINIOS_EVALUABLES.map((dominio) => {
    const delDominio = hallazgosEvaluables(lista.filter((h) => h.dominio === dominio));
    const actual = delDominio.length
      ? Math.round(delDominio.reduce((acc, h) => acc + PUNTAJE_ESTADO[h.estado], 0) / delDominio.length)
      : 0;
    const meta = METAS_DOMINIO[dominio] ?? 85;
    return { dominio, actual, meta, brecha: Math.max(0, meta - actual) };
  });
}

export function proyeccionMejora(lista: Hallazgo[] = hallazgosDemo) {
  const actual = calcularPuntajeGlobal(lista);
  const brechasAccionables = lista.filter(
    (h) => h.estado !== "Implementado" && h.estado !== "NoAplica" && h.estado !== "RequiereLicencia",
  ).length;
  const ritmoMensual = Math.min(8, Math.max(2, Math.round(brechasAccionables / 3)));
  return {
    dia30: Math.min(100, actual + ritmoMensual),
    dia60: Math.min(100, actual + ritmoMensual * 2),
    dia90: Math.min(100, actual + ritmoMensual * 3),
    esProyeccionDemostrativa: true,
  };
}

export function rankingAccionesPrioritarias(lista: Hallazgo[] = hallazgosDemo, limite = 6): Hallazgo[] {
  return [...lista]
    .filter((h) => h.estado === "Brecha" || h.estado === "Parcial")
    .sort((a, b) => {
      const pesoA = PESO_CRITICIDAD[a.criticidad] * (100 - PUNTAJE_ESTADO[a.estado]);
      const pesoB = PESO_CRITICIDAD[b.criticidad] * (100 - PUNTAJE_ESTADO[b.estado]);
      return pesoB - pesoA;
    })
    .slice(0, limite);
}

export function tendenciaMensualDemostrativa() {
  const actual = calcularPuntajeGlobal();
  return [
    { mes: "Abr", puntaje: Math.max(0, actual - 18) },
    { mes: "May", puntaje: Math.max(0, actual - 14) },
    { mes: "Jun", puntaje: Math.max(0, actual - 9) },
    { mes: "Jul", puntaje: Math.max(0, actual - 5) },
    { mes: "Ago", puntaje: Math.max(0, actual - 2) },
    { mes: "Sep", puntaje: actual },
  ];
}
