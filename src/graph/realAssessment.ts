import { graphLectura, paginarTodo } from "./client";

/**
 * Lecturas reales de Microsoft Graph para el motor de Assessment de Entra ID.
 * Igual que realDirectory.ts, cada función es tolerante a permisos
 * faltantes: si /identity/conditionalAccess/policies o la política de
 * métodos de autenticación no están disponibles (falta Policy.Read.All),
 * el llamador recibe una lista/valor vacío en vez de romper todo el
 * Assessment.
 */

export interface PoliticaAccesoCondicionalReal {
  id: string;
  displayName: string;
  estado: "enabled" | "disabled" | "enabledForReportingButNotEnforced";
  incluyeTodosLosUsuarios: boolean;
  incluyeRolesPrivilegiados: boolean;
  incluyeClientesHeredados: boolean;
  exigeMfa: boolean;
  bloquea: boolean;
  exigeRiesgoUsuarioOInicioSesion: boolean;
}

export async function obtenerPoliticasAccesoCondicionalReales(): Promise<PoliticaAccesoCondicionalReal[]> {
  const politicas = (await paginarTodo("/identity/conditionalAccess/policies")) as any[];
  return politicas.map((p): PoliticaAccesoCondicionalReal => {
    const clientAppTypes: string[] = p.conditions?.clientAppTypes ?? [];
    const includeUsers: string[] = p.conditions?.users?.includeUsers ?? [];
    const includeRoles: string[] = p.conditions?.users?.includeRoles ?? [];
    const builtInControls: string[] = p.grantControls?.builtInControls ?? [];
    const userRiskLevels: string[] = p.conditions?.userRiskLevels ?? [];
    const signInRiskLevels: string[] = p.conditions?.signInRiskLevels ?? [];
    return {
      id: p.id,
      displayName: p.displayName ?? "(sin nombre)",
      estado: p.state,
      incluyeTodosLosUsuarios: includeUsers.includes("All"),
      incluyeRolesPrivilegiados: includeRoles.length > 0,
      incluyeClientesHeredados: clientAppTypes.some((c) => c === "exchangeActiveSync" || c === "other"),
      exigeMfa: builtInControls.includes("mfa"),
      bloquea: builtInControls.includes("block"),
      exigeRiesgoUsuarioOInicioSesion: userRiskLevels.length > 0 || signInRiskLevels.length > 0,
    };
  });
}

export interface MetodosAutenticacionResistentesPhishing {
  fido2Habilitado: boolean;
  windowsHelloHabilitado: boolean;
}

export async function obtenerMetodosAutenticacionResistentesPhishing(): Promise<MetodosAutenticacionResistentesPhishing> {
  const respuesta = (await graphLectura.get("/policies/authenticationMethodsPolicy/authenticationMethodConfigurations")) as any;
  const lista: any[] = respuesta?.value ?? [];
  const fido2 = lista.find((m) => m.id === "fido2");
  const hello = lista.find((m) => m.id === "windowsHelloForBusiness");
  return {
    fido2Habilitado: fido2?.state === "enabled",
    windowsHelloHabilitado: hello?.state === "enabled",
  };
}
