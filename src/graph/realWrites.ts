import { randomBytes } from "node:crypto";
import { graphProduccion } from "./client";

/**
 * Escrituras reales contra el tenant vía Microsoft Graph con la identidad
 * "Phoenix Security Deployment – Production". Solo se invocan cuando
 * PHX_ENABLE_WRITES=true y las credenciales de producción están
 * configuradas (verificado por el llamador). Requiere los permisos de
 * aplicación Group.ReadWrite.All (grupos) y User.ReadWrite.All (usuarios)
 * concedidos con consentimiento de administrador a esa identidad.
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

/**
 * Genera una contraseña temporal que cumple la política de complejidad de
 * Entra ID (al menos 3 de 4 categorías). Pensada para usarse junto con
 * forceChangePasswordNextSignIn=true, para que el usuario la reemplace en
 * su primer inicio de sesión.
 */
export function generarPasswordTemporal(): string {
  const mayus = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const minus = "abcdefghijkmnpqrstuvwxyz";
  const numeros = "23456789";
  const simbolos = "!@#$%^&*";
  const alfabetoCompleto = mayus + minus + numeros + simbolos;
  const azar = (alfabeto: string) => alfabeto[randomBytes(1)[0] % alfabeto.length];

  const caracteres = [azar(mayus), azar(minus), azar(numeros), azar(simbolos)];
  while (caracteres.length < 12) caracteres.push(azar(alfabetoCompleto));
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join("");
}

export async function crearUsuarioReal(datos: {
  displayName: string;
  userPrincipalName: string;
  mailNickname: string;
  area: string;
  cargo: string;
  password: string;
  forzarCambioPassword: boolean;
}): Promise<{ id: string }> {
  const usuario = (await graphProduccion.post("/users", {
    accountEnabled: true,
    displayName: datos.displayName,
    mailNickname: datos.mailNickname,
    userPrincipalName: datos.userPrincipalName,
    department: datos.area || undefined,
    jobTitle: datos.cargo || undefined,
    passwordProfile: {
      password: datos.password,
      forceChangePasswordNextSignIn: datos.forzarCambioPassword,
    },
  })) as any;
  return { id: usuario.id };
}

export async function asignarLicenciaReal(usuarioId: string, skuId: string): Promise<void> {
  await graphProduccion.post(`/users/${usuarioId}/assignLicense`, {
    addLicenses: [{ skuId, disabledPlans: [] }],
    removeLicenses: [],
  });
}
