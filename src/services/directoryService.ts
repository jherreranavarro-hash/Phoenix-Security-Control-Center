import { almacen } from "../lib/store";
import { gruposDemo, skusDemo, usuariosDemo } from "../data/demoTenant";
import { readOnlyGraphConfigured } from "../config";
import { obtenerGruposReales, obtenerSkusReales, obtenerUsuariosReales } from "../graph/realDirectory";
import type { GrupoDirectorio, SkuLicencia, UsuarioDirectorio } from "../types";

/**
 * Vista "efectiva" del directorio: cuando hay credenciales de Microsoft
 * Graph configuradas (identidad "Phoenix Security Assessment – ReadOnly"),
 * la base son datos reales del tenant de Phoenix Service. Sin credenciales,
 * la base son los datos de DEMOSTRACIÓN de demoTenant.ts. En ambos casos se
 * fusionan encima los cambios simulados que se han ejecutado desde esta
 * plataforma (bloqueos, licencias, membresías, roles, usuarios nuevos) para
 * que la interfaz se sienta consistente entre pantallas.
 */

const TTL_CACHE_MS = 30_000;
let cache: { usuarios: UsuarioDirectorio[]; grupos: GrupoDirectorio[]; skus: SkuLicencia[]; fuente: "graph" | "demostracion"; en: number } | null = null;

async function obtenerBase(): Promise<{ usuarios: UsuarioDirectorio[]; grupos: GrupoDirectorio[]; skus: SkuLicencia[]; fuente: "graph" | "demostracion" }> {
  if (cache && Date.now() - cache.en < TTL_CACHE_MS) return cache;

  if (readOnlyGraphConfigured) {
    try {
      const [usuarios, grupos, skus] = await Promise.all([obtenerUsuariosReales(), obtenerGruposReales(), obtenerSkusReales()]);
      cache = { usuarios, grupos, skus, fuente: "graph", en: Date.now() };
      return cache;
    } catch (error) {
      console.error("[phoenix-security] Falla leyendo Microsoft Graph, se usa modo demostración como respaldo:", error);
    }
  }

  cache = { usuarios: usuariosDemo, grupos: gruposDemo, skus: skusDemo, fuente: "demostracion", en: Date.now() };
  return cache;
}

/** Invalida la caché de lectura (usar tras una escritura real contra el tenant). */
export function invalidarCacheDirectorio(): void {
  cache = null;
}

export async function fuenteDirectorio(): Promise<"graph" | "demostracion"> {
  return (await obtenerBase()).fuente;
}

export async function listarUsuariosEfectivos(): Promise<UsuarioDirectorio[]> {
  const overrides = almacen.overrides;
  const { usuarios } = await obtenerBase();
  const base = usuarios.map((u) => {
    const licenciasOverride = overrides.licenciasAsignadas[u.id];
    const gruposOverride = overrides.membresias[u.id];
    const rolesOverride = overrides.roles[u.id];
    return {
      ...u,
      accountEnabled: overrides.usuariosBloqueados.includes(u.id) ? false : u.accountEnabled,
      licencias: licenciasOverride ?? u.licencias,
      grupos: gruposOverride ?? u.grupos,
      roles: rolesOverride ?? u.roles,
      buzon: { ...u.buzon, ...(overrides.exchangeConfig[u.id] ?? {}) },
    } as UsuarioDirectorio;
  });
  const nuevos = overrides.usuariosCreados as unknown as UsuarioDirectorio[];
  return [...base, ...nuevos];
}

export async function obtenerUsuarioEfectivo(id: string): Promise<UsuarioDirectorio | undefined> {
  return (await listarUsuariosEfectivos()).find((u) => u.id === id);
}

export async function listarGruposEfectivos(): Promise<GrupoDirectorio[]> {
  const overrides = almacen.overrides;
  const [{ grupos }, usuarios] = await Promise.all([obtenerBase(), listarUsuariosEfectivos()]);
  const base = grupos.map((g) => ({
    ...g,
    miembros: usuarios.filter((u) => u.grupos.includes(g.nombre) || u.grupos.includes(g.id)).map((u) => u.id),
  }));
  const nuevos = overrides.gruposCreados as unknown as GrupoDirectorio[];
  return [...base, ...nuevos];
}

export async function listarSkusEfectivos(): Promise<SkuLicencia[]> {
  const [{ skus }, usuarios] = await Promise.all([obtenerBase(), listarUsuariosEfectivos()]);
  return skus.map((sku) => {
    const asignadas = usuarios.filter((u) => u.licencias.includes(sku.skuPartNumber)).length;
    return { ...sku, asignadas, disponibles: Math.max(0, sku.total - asignadas) };
  });
}

export function bloquearUsuario(id: string, bloquear: boolean): void {
  const overrides = almacen.overrides;
  const yaBloqueado = overrides.usuariosBloqueados.includes(id);
  if (bloquear && !yaBloqueado) overrides.usuariosBloqueados.push(id);
  if (!bloquear && yaBloqueado) {
    const idx = overrides.usuariosBloqueados.indexOf(id);
    overrides.usuariosBloqueados.splice(idx, 1);
  }
  almacen.guardarOverrides();
}

export async function asignarLicenciasUsuario(id: string, agregar: string[], quitar: string[]): Promise<UsuarioDirectorio> {
  const usuario = await obtenerUsuarioEfectivo(id);
  if (!usuario) throw new Error(`Usuario ${id} no encontrado.`);
  const licenciaSet = new Set(usuario.licencias);
  quitar.forEach((s) => licenciaSet.delete(s));
  agregar.forEach((s) => licenciaSet.add(s));
  almacen.overrides.licenciasAsignadas[id] = Array.from(licenciaSet);
  almacen.guardarOverrides();
  return (await obtenerUsuarioEfectivo(id))!;
}

export async function actualizarRoles(id: string, roles: string[]): Promise<UsuarioDirectorio> {
  const usuario = await obtenerUsuarioEfectivo(id);
  if (!usuario) throw new Error(`Usuario ${id} no encontrado.`);
  almacen.overrides.roles[id] = roles;
  almacen.guardarOverrides();
  return (await obtenerUsuarioEfectivo(id))!;
}

export async function actualizarMembresia(usuarioId: string, grupoNombre: string, agregar: boolean): Promise<void> {
  const usuario = await obtenerUsuarioEfectivo(usuarioId);
  if (!usuario) throw new Error(`Usuario ${usuarioId} no encontrado.`);
  const actuales = new Set(almacen.overrides.membresias[usuarioId] ?? usuario.grupos);
  if (agregar) actuales.add(grupoNombre);
  else actuales.delete(grupoNombre);
  almacen.overrides.membresias[usuarioId] = Array.from(actuales);
  almacen.guardarOverrides();
}

export function crearUsuario(datos: {
  displayName: string;
  area: string;
  cargo: string;
  userPrincipalName: string;
}): UsuarioDirectorio {
  const nuevo: UsuarioDirectorio = {
    id: `usr-new-${Date.now()}`,
    displayName: datos.displayName,
    userPrincipalName: datos.userPrincipalName,
    mail: datos.userPrincipalName,
    area: datos.area,
    cargo: datos.cargo,
    accountEnabled: true,
    roles: [],
    licencias: [],
    grupos: [],
    mfaRegistrado: false,
    esCuentaEmergencia: false,
    buzon: { alias: [datos.userPrincipalName], respuestaAutomatica: false, delegados: [], esCompartido: false },
  };
  almacen.overrides.usuariosCreados.push(nuevo as unknown as Record<string, unknown>);
  almacen.guardarOverrides();
  return nuevo;
}

export function crearGrupo(datos: {
  nombre: string;
  descripcion: string;
  clasificacion: GrupoDirectorio["clasificacion"];
  proposito: GrupoDirectorio["proposito"];
}): GrupoDirectorio {
  const nuevo: GrupoDirectorio = {
    id: `grp-new-${Date.now()}`,
    nombre: datos.nombre,
    descripcion: datos.descripcion,
    clasificacion: datos.clasificacion,
    tipo: "Seguridad",
    miembros: [],
    esGrupoEmergencia: false,
    proposito: datos.proposito,
  };
  almacen.overrides.gruposCreados.push(nuevo as unknown as Record<string, unknown>);
  almacen.guardarOverrides();
  return nuevo;
}

export async function actualizarExchange(id: string, cambios: Partial<UsuarioDirectorio["buzon"]>): Promise<UsuarioDirectorio> {
  const usuario = await obtenerUsuarioEfectivo(id);
  if (!usuario) throw new Error(`Usuario ${id} no encontrado.`);
  almacen.overrides.exchangeConfig[id] = { ...usuario.buzon, ...cambios };
  almacen.guardarOverrides();
  return (await obtenerUsuarioEfectivo(id))!;
}
