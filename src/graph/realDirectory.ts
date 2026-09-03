import { graphLectura, paginarTodo } from "./client";
import type { GrupoDirectorio, SkuLicencia, UsuarioDirectorio } from "../types";

/**
 * Lecturas reales del tenant vía Microsoft Graph con la identidad
 * "Phoenix Security Assessment – ReadOnly". Cada función es tolerante a
 * permisos faltantes: si un permiso específico no fue concedido a la app
 * registrada (por ejemplo, roles de directorio o configuración de buzón),
 * esa porción del dato queda vacía/por defecto en lugar de romper toda la
 * lectura — así el resto de la plataforma sigue funcionando con lo que sí
 * está disponible.
 */

const RE_EMERGENCIA = /emergenc|break.?glass/i;
const RE_PILOTO = /piloto|pilot\b/i;
const RE_PRODUCCION = /producci[oó]n|production|\bprod\b/i;
const RE_EXCLUSION = /exclu(y|s)/i;
const RE_ENTRAID = /entra ?id|azure ?ad|\baad\b|condicional|conditional/i;
const RE_INTUNE = /intune|dispositivo|device|bitlocker|cumplimiento|compliance/i;
const RE_DEFENDER = /defender|edr|asr|antivirus|malware/i;
const RE_PURVIEW = /purview|dlp|etiqueta|sensitivity|retenci[oó]n|retention/i;

function clasificarGrupo(nombre: string): GrupoDirectorio["clasificacion"] {
  if (RE_ENTRAID.test(nombre)) return ["EntraID"];
  if (RE_INTUNE.test(nombre)) return ["Intune"];
  if (RE_DEFENDER.test(nombre)) return ["Defender"];
  if (RE_PURVIEW.test(nombre)) return ["Purview"];
  return ["Todos"];
}

function propositoGrupo(nombre: string, esEmergencia: boolean): GrupoDirectorio["proposito"] {
  if (esEmergencia) return "Exclusion";
  if (RE_EXCLUSION.test(nombre)) return "Exclusion";
  if (RE_PILOTO.test(nombre)) return "Piloto";
  if (RE_PRODUCCION.test(nombre)) return "Produccion";
  return "Operativo";
}

export async function obtenerSkusReales(): Promise<SkuLicencia[]> {
  const skus = (await paginarTodo("/subscribedSkus")) as any[];
  return skus.map((s) => ({
    skuId: s.skuId,
    skuPartNumber: s.skuPartNumber,
    nombreComercial: s.skuPartNumber,
    total: s.prepaidUnits?.enabled ?? 0,
    asignadas: s.consumedUnits ?? 0,
    disponibles: Math.max(0, (s.prepaidUnits?.enabled ?? 0) - (s.consumedUnits ?? 0)),
  }));
}

export async function obtenerGruposReales(): Promise<GrupoDirectorio[]> {
  const grupos = (await paginarTodo("/groups?$select=id,displayName,description,securityEnabled,mailEnabled&$top=999")) as any[];

  // Los miembros de cada grupo se piden todos en paralelo (no uno por uno en
  // secuencia) para no acumular la latencia de red grupo por grupo.
  return Promise.all(
    grupos.map(async (g): Promise<GrupoDirectorio> => {
      const nombre: string = g.displayName ?? "(sin nombre)";
      const esEmergencia = RE_EMERGENCIA.test(nombre);
      let miembros: string[] = [];
      try {
        const m = (await paginarTodo(`/groups/${g.id}/members?$select=id&$top=999`)) as any[];
        miembros = m.map((x) => x.id);
      } catch (error) {
        console.error(`[phoenix-security] No se pudieron leer los miembros del grupo ${nombre}:`, error);
      }
      return {
        id: g.id,
        nombre,
        descripcion: g.description ?? "",
        clasificacion: clasificarGrupo(nombre),
        tipo: g.securityEnabled ? "Seguridad" : "Microsoft365",
        miembros,
        esGrupoEmergencia: esEmergencia,
        proposito: propositoGrupo(nombre, esEmergencia),
      };
    }),
  );
}

async function obtenerRolesPorUsuario(): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>();
  try {
    const roles = (await paginarTodo("/directoryRoles")) as any[];
    // Igual que con los grupos: los miembros de cada rol se piden en paralelo.
    const porRol = await Promise.all(
      roles.map(async (rol) => {
        try {
          const miembros = (await graphLectura.get(`/directoryRoles/${rol.id}/members?$select=id`)) as any;
          return { nombre: rol.displayName as string, ids: (miembros?.value ?? []).map((m: any) => m.id as string) };
        } catch {
          return { nombre: rol.displayName as string, ids: [] as string[] };
        }
      }),
    );
    for (const { nombre, ids } of porRol) {
      for (const id of ids) {
        const lista = mapa.get(id) ?? [];
        lista.push(nombre);
        mapa.set(id, lista);
      }
    }
  } catch (error) {
    console.error(
      "[phoenix-security] No fue posible leer roles de directorio (requiere Directory.Read.All o RoleManagement.Read.Directory). Los roles quedarán vacíos.",
      error,
    );
  }
  return mapa;
}

async function intentar<T>(promesa: Promise<T>, valorPorDefecto: T, mensaje: string): Promise<T> {
  try {
    return await promesa;
  } catch (error) {
    console.error(`[phoenix-security] ${mensaje}`, error);
    return valorPorDefecto;
  }
}

export async function obtenerUsuariosReales(): Promise<UsuarioDirectorio[]> {
  // La lista de usuarios es la base: si falla, no hay nada que construir y se
  // propaga el error para que el llamador caiga a modo demostración completo.
  // Licencias, grupos y roles son complementos independientes: si a la
  // identidad de solo lectura le falta un permiso específico para alguno de
  // ellos (Directory.Read.All para SKU/roles, etc.), esa sección queda vacía
  // pero los usuarios reales igual se muestran.
  const [usuariosGraph, skus, gruposReales, rolesPorUsuario] = await Promise.all([
    paginarTodo(
      "/users?$select=id,displayName,userPrincipalName,mail,department,jobTitle,accountEnabled,assignedLicenses&$top=999",
    ) as Promise<any[]>,
    intentar(obtenerSkusReales(), [], "No fue posible leer /subscribedSkus (requiere Directory.Read.All u Organization.Read.All). Las licencias quedarán vacías hasta conceder el permiso."),
    intentar(obtenerGruposReales(), [], "No fue posible leer /groups (requiere GroupMember.Read.All o Group.Read.All). Los grupos quedarán vacíos."),
    obtenerRolesPorUsuario(),
  ]);

  const idAPartNumber = new Map(skus.map((s) => [s.skuId, s.skuPartNumber]));
  const gruposPorUsuario = new Map<string, string[]>();
  const emergenciaPorUsuario = new Set<string>();
  for (const g of gruposReales) {
    for (const miembroId of g.miembros) {
      const lista = gruposPorUsuario.get(miembroId) ?? [];
      lista.push(g.nombre);
      gruposPorUsuario.set(miembroId, lista);
      if (g.esGrupoEmergencia) emergenciaPorUsuario.add(miembroId);
    }
  }

  return usuariosGraph.map((u): UsuarioDirectorio => {
    const upn: string = u.userPrincipalName ?? u.mail ?? u.id;
    return {
      id: u.id,
      displayName: u.displayName ?? upn,
      userPrincipalName: upn,
      mail: u.mail ?? upn,
      area: u.department ?? "Sin área asignada",
      cargo: u.jobTitle ?? "",
      accountEnabled: Boolean(u.accountEnabled),
      roles: rolesPorUsuario.get(u.id) ?? [],
      licencias: (u.assignedLicenses ?? []).map((l: any) => idAPartNumber.get(l.skuId)).filter(Boolean),
      grupos: gruposPorUsuario.get(u.id) ?? [],
      // El registro de MFA requiere UserAuthenticationMethod.Read.All o Reports.Read.All,
      // permisos no concedidos actualmente a la identidad de solo lectura.
      mfaRegistrado: false,
      esCuentaEmergencia: emergenciaPorUsuario.has(u.id),
      buzon: {
        // La configuración de buzón (alias, reenvío, delegados) requiere permisos de
        // Exchange/MailboxSettings no concedidos actualmente; se completa con overrides locales.
        alias: [upn],
        respuestaAutomatica: false,
        delegados: [],
        esCompartido: false,
      },
    };
  });
}

export async function obtenerDominiosReales() {
  const dominios = (await paginarTodo("/domains")) as any[];
  return dominios.map((d) => ({
    dominio: d.id as string,
    predeterminado: Boolean(d.isDefault),
    verificado: Boolean(d.isVerified),
  }));
}

export async function obtenerInvitadosReales() {
  const invitados = (await paginarTodo(
    "/users?$filter=userType eq 'Guest'&$select=id,displayName,mail,accountEnabled,externalUserState&$top=999",
  )) as any[];
  return invitados.map((g) => ({
    id: g.id as string,
    displayName: (g.displayName ?? g.mail) as string,
    mail: (g.mail ?? "") as string,
    accountEnabled: Boolean(g.accountEnabled),
    invitacionAceptada: g.externalUserState === "Accepted",
  }));
}
