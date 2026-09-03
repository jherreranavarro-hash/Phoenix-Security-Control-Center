import type { NextFunction, Request, Response } from "express";
import { config } from "../config";

export interface UsuarioSesion {
  upn: string;
  nombre: string;
  roles: string[];
  origen: "EasyAuth" | "Demostracion";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioSesion;
    }
  }
}

interface ClaimEasyAuth {
  typ: string;
  val: string;
}

interface ClientPrincipal {
  auth_typ: string;
  claims: ClaimEasyAuth[];
  name_typ: string;
  role_typ: string;
}

/**
 * Resuelve la identidad del usuario autenticado.
 *
 * En Azure App Service, con "App Service Authentication" (Easy Auth) activado
 * con el proveedor Microsoft, cada solicitud llega con el encabezado
 * `x-ms-client-principal` (JSON codificado en base64) inyectado por la
 * plataforma — nunca generado ni verificado por esta aplicación. Ningún
 * secreto de autenticación pasa por el navegador ni por este código.
 *
 * En desarrollo local, sin Easy Auth disponible, se usa un usuario de
 * demostración configurado por variables de entorno, dejando claro en la
 * interfaz que la sesión no proviene de un inicio de sesión Microsoft real.
 */
export function resolverIdentidad(req: Request, _res: Response, next: NextFunction): void {
  const encabezado = req.header("x-ms-client-principal");

  if (encabezado) {
    try {
      const principal = JSON.parse(Buffer.from(encabezado, "base64").toString("utf-8")) as ClientPrincipal;
      const claim = (tipo: string) => principal.claims?.find((c) => c.typ === tipo)?.val;
      const upn = claim("preferred_username") ?? claim("emails") ?? claim("upn") ?? claim("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn") ?? "";
      const nombre = claim("name") ?? upn;
      const roles = principal.claims?.filter((c) => c.typ === "roles").map((c) => c.val) ?? [];
      req.usuario = { upn, nombre, roles, origen: "EasyAuth" };
      return next();
    } catch (error) {
      console.error("[phoenix-security] Encabezado de Easy Auth inválido:", error);
    }
  }

  req.usuario = {
    upn: config.devUser.upn,
    nombre: config.devUser.name,
    roles: config.devUser.roles,
    origen: "Demostracion",
  };
  next();
}

export function requiereAutenticacion(req: Request, res: Response, next: NextFunction): void {
  if (!req.usuario?.upn) {
    res.status(401).json({ error: "No fue posible identificar al usuario autenticado." });
    return;
  }
  next();
}
