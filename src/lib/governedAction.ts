import { segregacionDeFunciones } from "../middleware/requireWrites";
import { auditar } from "./audit";

export interface AccionGobernadaParams {
  solicitante: string;
  aprobador: string;
  justificacion: string;
  accion: string;
  entidad: string;
  entidadId: string;
}

/**
 * Valida segregación de funciones y ejecuta una acción gobernada dejando
 * registro de auditoría con solicitante, aprobador y resultado. Pensado para
 * acciones puntuales (bloqueo de cuenta, cambio de licencia individual,
 * membresía de grupo, rol) que no requieren el flujo completo de 8 estados
 * usado por los cambios de configuración de los módulos 5 y 6, pero que sí
 * exigen trazabilidad y doble control.
 */
export async function ejecutarAccionGobernada<T>(params: AccionGobernadaParams, ejecutar: () => T | Promise<T>): Promise<T> {
  const errorSegregacion = segregacionDeFunciones(params.solicitante, params.aprobador);
  if (errorSegregacion) {
    auditar({
      actor: params.solicitante,
      accion: params.accion,
      entidad: params.entidad,
      entidadId: params.entidadId,
      resultado: "Rechazado",
      detalle: errorSegregacion,
    });
    throw new Error(errorSegregacion);
  }
  if (!params.justificacion?.trim()) {
    throw new Error("Debe indicar una justificación para la acción gobernada.");
  }

  try {
    const resultado = await ejecutar();
    auditar({
      actor: params.solicitante,
      accion: params.accion,
      entidad: params.entidad,
      entidadId: params.entidadId,
      resultado: "Exito",
      detalle: `Aprobado por ${params.aprobador}. Justificación: ${params.justificacion}`,
    });
    return resultado;
  } catch (error) {
    auditar({
      actor: params.solicitante,
      accion: params.accion,
      entidad: params.entidad,
      entidadId: params.entidadId,
      resultado: "Fallo",
      detalle: error instanceof Error ? error.message : "Error desconocido",
    });
    throw error;
  }
}
