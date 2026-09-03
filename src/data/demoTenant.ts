import type { GrupoDirectorio, SkuLicencia, UsuarioDirectorio } from "../types";

/**
 * Datos de DEMOSTRACIÓN del tenant de Phoenix Service.
 *
 * Se usan únicamente cuando no hay credenciales de Microsoft Graph
 * configuradas (modo demostración). Toda la interfaz debe marcar
 * explícitamente estos datos como "Demostración", nunca como reales.
 */

export const SKU_BASICO = "O365_BUSINESS_ESSENTIALS";
export const SKU_ESTANDAR = "O365_BUSINESS_PREMIUM"; // Nombre técnico histórico → "Microsoft 365 Empresa Estándar"
export const SKU_PREMIUM = "SPB"; // → "Microsoft 365 Empresa Premium"

export const skusDemo: SkuLicencia[] = [
  {
    skuId: "10000000-0000-0000-0000-000000000001",
    skuPartNumber: SKU_BASICO,
    nombreComercial: "Microsoft 365 Empresa Básico",
    total: 8,
    asignadas: 6,
    disponibles: 2,
  },
  {
    skuId: "10000000-0000-0000-0000-000000000002",
    skuPartNumber: SKU_ESTANDAR,
    nombreComercial: "Microsoft 365 Empresa Estándar",
    total: 22,
    asignadas: 14,
    disponibles: 8,
  },
  {
    skuId: "10000000-0000-0000-0000-000000000003",
    skuPartNumber: SKU_PREMIUM,
    nombreComercial: "Microsoft 365 Empresa Premium",
    total: 12,
    asignadas: 9,
    disponibles: 3,
  },
];

interface DefUsuario {
  nombre: string;
  area: string;
  cargo: string;
  roles?: string[];
  licencias?: string[];
  mfa?: boolean;
  activo?: boolean;
  emergencia?: boolean;
  grupos?: string[];
}

const definiciones: DefUsuario[] = [
  { nombre: "Juan Pablo Herrera", area: "Dirección General", cargo: "Director de Tecnología", roles: ["Administrador Global"], licencias: [SKU_PREMIUM], mfa: true, grupos: ["TI-Administradores", "Direccion-Ejecutivos"] },
  { nombre: "María Fernanda Rojas", area: "Dirección General", cargo: "Gerente General", roles: ["Administrador de Facturación"], licencias: [SKU_PREMIUM], mfa: true, grupos: ["Direccion-Ejecutivos"] },
  { nombre: "Carlos Andrés Muñoz", area: "Tecnología", cargo: "Administrador de Sistemas", roles: ["Administrador de Intune", "Administrador de Seguridad"], licencias: [SKU_PREMIUM], mfa: true, grupos: ["TI-Administradores", "SEC-Intune-Cumplimiento-Produccion"] },
  { nombre: "Emergencia Acceso 01", area: "Tecnología", cargo: "Cuenta de emergencia (break-glass)", roles: ["Administrador Global"], licencias: [SKU_ESTANDAR], mfa: false, emergencia: true, grupos: ["SEC-Emergencia-BreakGlass"] },
  { nombre: "Emergencia Acceso 02", area: "Tecnología", cargo: "Cuenta de emergencia (break-glass)", roles: ["Administrador Global"], licencias: [SKU_ESTANDAR], mfa: false, emergencia: true, grupos: ["SEC-Emergencia-BreakGlass"] },
  { nombre: "Valentina Soto", area: "Finanzas", cargo: "Gerente de Finanzas", licencias: [SKU_ESTANDAR], mfa: true, grupos: ["SEC-Purview-DLP-Produccion"] },
  { nombre: "Rodrigo Castillo", area: "Finanzas", cargo: "Analista Contable", licencias: [SKU_ESTANDAR], mfa: false },
  { nombre: "Camila Fuentes", area: "Finanzas", cargo: "Analista de Tesorería", licencias: [SKU_ESTANDAR], mfa: false },
  { nombre: "Diego Alejandro Vera", area: "Comercial", cargo: "Gerente Comercial", licencias: [SKU_ESTANDAR], mfa: true, grupos: ["SEC-EntraID-CA-Piloto"] },
  { nombre: "Francisca Araya", area: "Comercial", cargo: "Ejecutiva de Ventas", licencias: [SKU_ESTANDAR], mfa: false, grupos: ["SEC-EntraID-CA-Piloto"] },
  { nombre: "Sebastián Contreras", area: "Comercial", cargo: "Ejecutivo de Ventas", licencias: [SKU_ESTANDAR], mfa: false },
  { nombre: "Antonia Morales", area: "Comercial", cargo: "Ejecutiva de Cuentas", licencias: [SKU_ESTANDAR], mfa: true },
  { nombre: "Pedro Pablo Sáez", area: "Operaciones", cargo: "Jefe de Operaciones", licencias: [SKU_ESTANDAR], mfa: true, grupos: ["SEC-Defender-EDR-Piloto"] },
  { nombre: "Javiera Espinoza", area: "Operaciones", cargo: "Coordinadora de Logística", licencias: [SKU_ESTANDAR], mfa: false },
  { nombre: "Matías Reyes", area: "Operaciones", cargo: "Analista de Operaciones", licencias: [SKU_BASICO], mfa: false },
  { nombre: "Isidora Pizarro", area: "Operaciones", cargo: "Analista de Operaciones", licencias: [SKU_BASICO], mfa: false },
  { nombre: "Tomás Guzmán", area: "Recursos Humanos", cargo: "Jefe de Personas", licencias: [SKU_ESTANDAR], mfa: true },
  { nombre: "Constanza Bravo", area: "Recursos Humanos", cargo: "Analista de RRHH", licencias: [SKU_BASICO], mfa: false },
  { nombre: "Ignacio Torres", area: "Atención al Cliente", cargo: "Supervisor de Soporte", licencias: [SKU_ESTANDAR], mfa: true },
  { nombre: "Paula Andrea Núñez", area: "Atención al Cliente", cargo: "Agente de Soporte", licencias: [SKU_BASICO], mfa: false },
  { nombre: "Felipe Ignacio Silva", area: "Atención al Cliente", cargo: "Agente de Soporte", licencias: [SKU_BASICO], mfa: false },
  { nombre: "Daniela Paz Cortés", area: "Atención al Cliente", cargo: "Agente de Soporte", licencias: [], mfa: false, activo: false },
  { nombre: "Cristóbal Herrera", area: "Tecnología", cargo: "Soporte TI", licencias: [SKU_ESTANDAR], mfa: false, grupos: ["TI-Administradores"] },
  { nombre: "Amanda Elizabeth Lagos", area: "Comercial", cargo: "Practicante Marketing", licencias: [], mfa: false },
];

function slug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "");
}

export const usuariosDemo: UsuarioDirectorio[] = definiciones.map((d, i) => {
  const upn = `${slug(d.nombre)}@phoenixservice.com`;
  return {
    id: `usr-${String(i + 1).padStart(3, "0")}`,
    displayName: d.nombre,
    userPrincipalName: upn,
    mail: upn,
    area: d.area,
    cargo: d.cargo,
    accountEnabled: d.activo ?? true,
    roles: d.roles ?? [],
    licencias: d.licencias ?? [],
    grupos: d.grupos ?? [],
    mfaRegistrado: d.mfa ?? false,
    esCuentaEmergencia: d.emergencia ?? false,
    ultimoInicioSesion: d.activo === false ? undefined : new Date(Date.now() - Math.floor(Math.random() * 6) * 86400000).toISOString(),
    buzon: {
      alias: [upn],
      respuestaAutomatica: false,
      delegados: [],
      esCompartido: false,
    },
  };
});

export const gruposDemo: GrupoDirectorio[] = [
  {
    id: "grp-001",
    nombre: "SEC-Emergencia-BreakGlass",
    descripcion: "Cuentas de emergencia excluidas de todas las políticas de acceso condicional y cumplimiento.",
    clasificacion: ["Todos"],
    tipo: "Seguridad",
    miembros: usuariosDemo.filter((u) => u.esCuentaEmergencia).map((u) => u.id),
    esGrupoEmergencia: true,
    proposito: "Exclusion",
  },
  {
    id: "grp-002",
    nombre: "TI-Administradores",
    descripcion: "Personal de Tecnología con roles administrativos en Microsoft 365.",
    clasificacion: ["Todos"],
    tipo: "Seguridad",
    miembros: usuariosDemo.filter((u) => u.grupos?.includes("TI-Administradores")).map((u) => u.id),
    esGrupoEmergencia: false,
    proposito: "Operativo",
  },
  {
    id: "grp-003",
    nombre: "Direccion-Ejecutivos",
    descripcion: "Equipo directivo de Phoenix Service.",
    clasificacion: ["Todos"],
    tipo: "Seguridad",
    miembros: usuariosDemo.filter((u) => u.grupos?.includes("Direccion-Ejecutivos")).map((u) => u.id),
    esGrupoEmergencia: false,
    proposito: "Operativo",
  },
  {
    id: "grp-004",
    nombre: "SEC-EntraID-CA-Piloto",
    descripcion: "Grupo piloto para políticas de acceso condicional de Entra ID.",
    clasificacion: ["EntraID"],
    tipo: "Seguridad",
    miembros: usuariosDemo.filter((u) => u.grupos?.includes("SEC-EntraID-CA-Piloto")).map((u) => u.id),
    esGrupoEmergencia: false,
    proposito: "Piloto",
  },
  {
    id: "grp-005",
    nombre: "SEC-Intune-Cumplimiento-Produccion",
    descripcion: "Equipos en producción bajo políticas de cumplimiento de Intune.",
    clasificacion: ["Intune"],
    tipo: "Seguridad",
    miembros: usuariosDemo.filter((u) => u.grupos?.includes("SEC-Intune-Cumplimiento-Produccion")).map((u) => u.id),
    esGrupoEmergencia: false,
    proposito: "Produccion",
  },
  {
    id: "grp-006",
    nombre: "SEC-Defender-EDR-Piloto",
    descripcion: "Piloto de Microsoft Defender for Business / EDR.",
    clasificacion: ["Defender"],
    tipo: "Seguridad",
    miembros: usuariosDemo.filter((u) => u.grupos?.includes("SEC-Defender-EDR-Piloto")).map((u) => u.id),
    esGrupoEmergencia: false,
    proposito: "Piloto",
  },
  {
    id: "grp-007",
    nombre: "SEC-Purview-DLP-Produccion",
    descripcion: "Alcance de producción para políticas DLP de datos personales (Purview).",
    clasificacion: ["Purview"],
    tipo: "Seguridad",
    miembros: usuariosDemo.filter((u) => u.grupos?.includes("SEC-Purview-DLP-Produccion")).map((u) => u.id),
    esGrupoEmergencia: false,
    proposito: "Produccion",
  },
];

export const dominiosVerificadosDemo = [
  { dominio: "phoenixservice.com", predeterminado: true, verificado: true },
  { dominio: "phoenixservice.cl", predeterminado: false, verificado: true },
  { dominio: "phoenixservice.onmicrosoft.com", predeterminado: false, verificado: true },
  { dominio: "nuevaunidadphoenix.com", predeterminado: false, verificado: false },
];

export const invitadosDemo = [
  { id: "guest-001", displayName: "Ana López (Proveedor Externo)", mail: "ana.lopez@proveedor-externo.com", accountEnabled: true, invitacionAceptada: true },
  { id: "guest-002", displayName: "Roberto Díaz (Consultor)", mail: "roberto.diaz@consultoria-abc.com", accountEnabled: true, invitacionAceptada: false },
];

export const teamsInvitadosConfigDemo = {
  permiteAccesoInvitados: true,
  permiteLlamadasInvitados: true,
  permiteReunionesInvitados: true,
  ultimaRevision: "2026-08-01T00:00:00.000Z",
};
