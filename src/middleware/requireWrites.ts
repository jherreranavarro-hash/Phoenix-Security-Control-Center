import type { NextFunction, Request, Response } from "express";
import { config, productionGraphConfigured } from "../config";

/**
 * Exige que las escrituras contra el tenant estén explícitamente habilitadas
 * (PHX_ENABLE_WRITES=true) y que exista la identidad de producción
 * configurada. Nunca permite una ejecución real "por defecto".
 */
export function requiereEscriturasHabilitadas(req: Request, res: Response, next: NextFunction): void {
  if (!config.enableWrites) {
    res.status(403).json({
      error: "Las escrituras reales contra el tenant están deshabilitadas (PHX_ENABLE_WRITES=false).",
      modoDemostracion: !productionGraphConfigured,
    });
    return;
  }
  next();
}

export function requiereAprobador(req: Request, res: Response, next: NextFunction): void {
  const upn = req.usuario?.upn?.toLowerCase().trim();
  if (!config.licenseApproverUpn) {
    res.status(403).json({ error: "No hay un aprobador autorizado configurado (PHX_LICENSE_APPROVER_UPN)." });
    return;
  }
  if (!upn || upn !== config.licenseApproverUpn) {
    res.status(403).json({
      error: "Esta operación masiva está restringida exclusivamente al aprobador autorizado.",
      aprobadorRequerido: config.licenseApproverUpn,
    });
    return;
  }
  next();
}

export function segregacionDeFunciones(solicitante: string, aprobador: string): string | null {
  if (solicitante.trim().toLowerCase() === aprobador.trim().toLowerCase()) {
    return "El solicitante y el aprobador no pueden ser la misma persona (segregación de funciones).";
  }
  return null;
}
