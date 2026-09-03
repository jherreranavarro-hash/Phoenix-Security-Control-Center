export type Dominio = "EntraID" | "Intune" | "Defender" | "Purview" | "Exchange" | "Licencias";

export type EstadoHallazgo = "Implementado" | "Parcial" | "Brecha" | "NoAplica" | "RequiereLicencia";

export type Criticidad = "Critica" | "Alta" | "Media" | "Baja";

export interface Hallazgo {
  id: string;
  dominio: Dominio;
  nombre: string;
  estado: EstadoHallazgo;
  criticidad: Criticidad;
  queExiste: string;
  queFalta: string;
  porQueRelevante: string;
  cobertura: { cubiertos: number; total: number };
  pendientes: string[];
  licenciaRequerida: string;
  responsable: string;
  prerrequisitos: string[];
  validaciones: string[];
  proximaAccion: string;
  planReversion: string;
  politicaRelacionadaId?: string;
}

export interface Politica {
  id: string;
  nombre: string;
  producto: "Entra ID" | "Intune" | "Defender" | "Purview" | "Exchange";
  riesgo: Criticidad;
  coberturaActual: { cubiertos: number; total: number };
  requisitosPrevios: string[];
  licenciamiento: string;
  impactoOperacional: string;
  responsable: string;
  estado: EstadoHallazgo;
  descripcion: string;
}

export type EstadoCambio =
  | "Evaluacion"
  | "Diseno"
  | "Piloto"
  | "Aprobacion"
  | "Produccion"
  | "Revertido"
  | "Cerrado"
  | "Rechazado";

export interface AlcanceDespliegue {
  gruposIncluidos: string[];
  usuariosIndividuales: string[];
  gruposExcluidos: string[];
  incluyeCuentasEmergenciaExcluidas: boolean;
  ventanaPilotoInicio?: string;
  ventanaPilotoFin?: string;
  ventanaProduccionInicio?: string;
  ventanaProduccionFin?: string;
  totalUsuariosAfectados: number;
  totalEquiposAfectados: number;
  validacionesPrevias: string[];
  guardadoComoEvidencia: boolean;
}

export interface ConfirmacionDespliegue {
  personasAfectadasConfirmado: boolean;
  gruposAfectadosConfirmado: boolean;
  exclusionesConfirmado: boolean;
  ventanaCambioConfirmado: boolean;
  planReversionConfirmado: boolean;
  resultadoEsperadoConfirmado: boolean;
  confirmadoPor?: string;
  confirmadoEn?: string;
}

export interface CambioGobernado {
  id: string;
  configuracionONombrePolitica: string;
  politicaId?: string;
  hallazgoId?: string;
  solicitante: string;
  responsableTecnico: string;
  aprobador: string;
  riesgo: Criticidad;
  justificacion: string;
  requisitosPrevios: string[];
  impactoEsperado: string;
  exclusiones: string[];
  planPruebas: string;
  resultadoPiloto?: string;
  evidencias: { titulo: string; url: string; fecha: string }[];
  planReversion: string;
  riesgoResidual: string;
  estado: EstadoCambio;
  alcance: AlcanceDespliegue;
  confirmacion: ConfirmacionDespliegue;
  creadoEn: string;
  actualizadoEn: string;
  historial: { fecha: string; actor: string; accion: string; detalle?: string }[];
}

export interface RegistroAuditoria {
  id: string;
  fecha: string;
  actor: string;
  accion: string;
  entidad: string;
  entidadId?: string;
  resultado: "Exito" | "Fallo" | "Rechazado";
  detalle?: string;
}

export interface UsuarioDirectorio {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string;
  area: string;
  cargo: string;
  accountEnabled: boolean;
  roles: string[];
  licencias: string[];
  grupos: string[];
  mfaRegistrado: boolean;
  esCuentaEmergencia: boolean;
  ultimoInicioSesion?: string;
  buzon: {
    alias: string[];
    reenvio?: string;
    respuestaAutomatica: boolean;
    delegados: string[];
    esCompartido: boolean;
  };
}

export interface GrupoDirectorio {
  id: string;
  nombre: string;
  descripcion: string;
  clasificacion: Dominio[] | ["Todos"];
  tipo: "Seguridad" | "Microsoft365";
  miembros: string[];
  esGrupoEmergencia: boolean;
  proposito: "Piloto" | "Produccion" | "Exclusion" | "Operativo";
}

export interface SkuLicencia {
  skuId: string;
  skuPartNumber: string;
  nombreComercial: string;
  total: number;
  asignadas: number;
  disponibles: number;
}
