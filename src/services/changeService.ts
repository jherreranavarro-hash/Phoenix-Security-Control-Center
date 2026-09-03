import { almacen } from "../lib/store";
import { generarId } from "../lib/id";
import { auditar } from "../lib/audit";
import { gruposDemo } from "../data/demoTenant";
import type { AlcanceDespliegue, CambioGobernado, EstadoCambio } from "../types";

const TRANSICIONES_VALIDAS: Record<EstadoCambio, EstadoCambio[]> = {
  Evaluacion: ["Diseno", "Rechazado"],
  Diseno: ["Piloto", "Rechazado"],
  Piloto: ["Aprobacion", "Rechazado"],
  Aprobacion: ["Produccion", "Rechazado"],
  Produccion: ["Cerrado", "Revertido"],
  Revertido: ["Cerrado"],
  Cerrado: [],
  Rechazado: [],
};

function alcanceVacio(): AlcanceDespliegue {
  return {
    gruposIncluidos: [],
    usuariosIndividuales: [],
    gruposExcluidos: gruposDemo.filter((g) => g.esGrupoEmergencia).map((g) => g.id),
    incluyeCuentasEmergenciaExcluidas: true,
    totalUsuariosAfectados: 0,
    totalEquiposAfectados: 0,
    validacionesPrevias: [],
    guardadoComoEvidencia: false,
  };
}

export interface DatosNuevoCambio {
  configuracionONombrePolitica: string;
  politicaId?: string;
  hallazgoId?: string;
  solicitante: string;
  responsableTecnico: string;
  aprobador: string;
  riesgo: CambioGobernado["riesgo"];
  justificacion: string;
  requisitosPrevios: string[];
  impactoEsperado: string;
  planPruebas: string;
  planReversion: string;
}

export function crearCambio(datos: DatosNuevoCambio): CambioGobernado {
  if (datos.solicitante.trim().toLowerCase() === datos.aprobador.trim().toLowerCase()) {
    throw new Error("El solicitante y el aprobador no pueden ser la misma persona (segregación de funciones).");
  }
  const ahora = new Date().toISOString();
  const cambio: CambioGobernado = {
    id: generarId("CHG"),
    ...datos,
    exclusiones: [],
    resultadoPiloto: undefined,
    evidencias: [],
    riesgoResidual: "Pendiente de evaluar tras el piloto.",
    estado: "Evaluacion",
    alcance: alcanceVacio(),
    confirmacion: {
      personasAfectadasConfirmado: false,
      gruposAfectadosConfirmado: false,
      exclusionesConfirmado: false,
      ventanaCambioConfirmado: false,
      planReversionConfirmado: false,
      resultadoEsperadoConfirmado: false,
    },
    creadoEn: ahora,
    actualizadoEn: ahora,
    historial: [{ fecha: ahora, actor: datos.solicitante, accion: "Cambio creado", detalle: "Estado inicial: Evaluación" }],
  };
  almacen.guardarCambio(cambio);
  auditar({ actor: datos.solicitante, accion: "Crear cambio gobernado", entidad: "Cambio", entidadId: cambio.id, resultado: "Exito" });
  return cambio;
}

export function obtenerCambio(id: string): CambioGobernado {
  const cambio = almacen.obtenerCambio(id);
  if (!cambio) throw new Error(`Cambio ${id} no encontrado.`);
  return cambio;
}

export function actualizarAlcance(id: string, alcance: Partial<AlcanceDespliegue>): CambioGobernado {
  const cambio = obtenerCambio(id);
  const gruposExcluidosOriginal = new Set(cambio.alcance.gruposExcluidos);
  const emergenciaIds = gruposDemo.filter((g) => g.esGrupoEmergencia).map((g) => g.id);

  const nuevosGruposExcluidos = new Set([...(alcance.gruposExcluidos ?? Array.from(gruposExcluidosOriginal))]);
  emergenciaIds.forEach((id) => nuevosGruposExcluidos.add(id)); // las cuentas de emergencia jamás pueden quedar incluidas

  cambio.alcance = {
    ...cambio.alcance,
    ...alcance,
    gruposExcluidos: Array.from(nuevosGruposExcluidos),
    incluyeCuentasEmergenciaExcluidas: true,
    guardadoComoEvidencia: false,
  };
  cambio.actualizadoEn = new Date().toISOString();
  cambio.historial.push({ fecha: cambio.actualizadoEn, actor: "sistema", accion: "Alcance de despliegue actualizado" });
  almacen.guardarCambio(cambio);
  return cambio;
}

export function guardarAlcanceComoEvidencia(id: string, actor: string): CambioGobernado {
  const cambio = obtenerCambio(id);
  cambio.alcance.guardadoComoEvidencia = true;
  cambio.actualizadoEn = new Date().toISOString();
  cambio.historial.push({ fecha: cambio.actualizadoEn, actor, accion: "Alcance final guardado como evidencia" });
  almacen.guardarCambio(cambio);
  auditar({ actor, accion: "Guardar alcance como evidencia", entidad: "Cambio", entidadId: id, resultado: "Exito" });
  return cambio;
}

export function confirmarDespliegue(
  id: string,
  actor: string,
  confirmaciones: {
    personasAfectadasConfirmado: boolean;
    gruposAfectadosConfirmado: boolean;
    exclusionesConfirmado: boolean;
    ventanaCambioConfirmado: boolean;
    planReversionConfirmado: boolean;
    resultadoEsperadoConfirmado: boolean;
  },
): CambioGobernado {
  const cambio = obtenerCambio(id);
  const faltantes = Object.entries(confirmaciones).filter(([, v]) => v !== true);
  if (faltantes.length > 0) {
    throw new Error(
      `No se puede confirmar el despliegue: faltan confirmaciones explícitas de ${faltantes.map(([k]) => k).join(", ")}.`,
    );
  }
  cambio.confirmacion = { ...confirmaciones, confirmadoPor: actor, confirmadoEn: new Date().toISOString() };
  cambio.actualizadoEn = new Date().toISOString();
  cambio.historial.push({ fecha: cambio.actualizadoEn, actor, accion: "Despliegue confirmado explícitamente" });
  almacen.guardarCambio(cambio);
  auditar({ actor, accion: "Confirmar despliegue", entidad: "Cambio", entidadId: id, resultado: "Exito" });
  return cambio;
}

export function transicionarEstado(id: string, nuevoEstado: EstadoCambio, actor: string, detalle?: string): CambioGobernado {
  const cambio = obtenerCambio(id);
  const permitidas = TRANSICIONES_VALIDAS[cambio.estado];
  if (!permitidas.includes(nuevoEstado)) {
    throw new Error(`Transición no permitida: de "${cambio.estado}" a "${nuevoEstado}".`);
  }

  if (nuevoEstado === "Aprobacion") {
    if (!cambio.alcance.guardadoComoEvidencia) {
      throw new Error("No se puede pasar a Aprobación sin guardar el alcance final del despliegue como evidencia.");
    }
    if (!cambio.resultadoPiloto) {
      throw new Error("No se puede pasar a Aprobación sin registrar el resultado del piloto.");
    }
  }

  if (nuevoEstado === "Produccion") {
    if (actor.trim().toLowerCase() === cambio.solicitante.trim().toLowerCase()) {
      throw new Error("El solicitante no puede aprobar ni ejecutar su propio cambio (segregación de funciones).");
    }
    if (actor.trim().toLowerCase() !== cambio.aprobador.trim().toLowerCase()) {
      throw new Error(`Solo el aprobador designado (${cambio.aprobador}) puede autorizar el paso a Producción.`);
    }
    const c = cambio.confirmacion;
    if (
      !c.personasAfectadasConfirmado ||
      !c.gruposAfectadosConfirmado ||
      !c.exclusionesConfirmado ||
      !c.ventanaCambioConfirmado ||
      !c.planReversionConfirmado ||
      !c.resultadoEsperadoConfirmado
    ) {
      throw new Error("No se puede desplegar a Producción sin todas las confirmaciones explícitas del despliegue.");
    }
  }

  cambio.estado = nuevoEstado;
  cambio.actualizadoEn = new Date().toISOString();
  cambio.historial.push({ fecha: cambio.actualizadoEn, actor, accion: `Transición a ${nuevoEstado}`, detalle });
  almacen.guardarCambio(cambio);
  auditar({ actor, accion: `Transición de cambio a ${nuevoEstado}`, entidad: "Cambio", entidadId: id, resultado: "Exito", detalle });
  return cambio;
}

export function registrarResultadoPiloto(id: string, resultado: string, actor: string): CambioGobernado {
  const cambio = obtenerCambio(id);
  cambio.resultadoPiloto = resultado;
  cambio.actualizadoEn = new Date().toISOString();
  cambio.historial.push({ fecha: cambio.actualizadoEn, actor, accion: "Resultado de piloto registrado" });
  almacen.guardarCambio(cambio);
  return cambio;
}

export function adjuntarEvidencia(id: string, titulo: string, url: string, actor: string): CambioGobernado {
  const cambio = obtenerCambio(id);
  cambio.evidencias.push({ titulo, url, fecha: new Date().toISOString() });
  cambio.actualizadoEn = new Date().toISOString();
  cambio.historial.push({ fecha: cambio.actualizadoEn, actor, accion: "Evidencia adjuntada", detalle: titulo });
  almacen.guardarCambio(cambio);
  return cambio;
}
