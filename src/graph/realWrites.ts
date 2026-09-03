import { graphProduccion } from "./client";

/**
 * Escrituras reales contra el tenant vía Microsoft Graph con la identidad
 * "Phoenix Security Deployment – Production". Solo se invocan cuando
 * PHX_ENABLE_WRITES=true y las credenciales de producción están
 * configuradas (verificado por el llamador). Requiere el permiso de
 * aplicación Group.ReadWrite.All concedido con consentimiento de
 * administrador a esa identidad.
 */

function mailNicknameDesdeNombre(nombre: string): string {
  const base = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 48);
  return base || `grupo${Date.now()}`;
}

export async function crearGrupoReal(datos: { nombre: string; descripcion: string }): Promise<{ id: string }> {
  const grupo = (await graphProduccion.post("/groups", {
    displayName: datos.nombre,
    description: datos.descripcion || undefined,
    mailEnabled: false,
    mailNickname: mailNicknameDesdeNombre(datos.nombre),
    securityEnabled: true,
  })) as any;
  return { id: grupo.id };
}

export async function agregarMiembroGrupoReal(grupoId: string, usuarioId: string): Promise<void> {
  await graphProduccion.post(`/groups/${grupoId}/members/$ref`, {
    "@odata.id": `https://graph.microsoft.com/v1.0/directoryObjects/${usuarioId}`,
  });
}

export async function quitarMiembroGrupoReal(grupoId: string, usuarioId: string): Promise<void> {
  await graphProduccion.del(`/groups/${grupoId}/members/${usuarioId}/$ref`);
}
