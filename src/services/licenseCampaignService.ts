import { createHash, randomUUID } from "node:crypto";
import { productionGraphConfigured } from "../config";
import { graphProduccion } from "../graph/client";
import { SKU_ESTANDAR, SKU_PREMIUM } from "../data/demoTenant";
import {
  asignarLicenciasUsuario,
  fuenteDirectorio,
  invalidarCacheDirectorio,
  listarSkusEfectivos,
  listarUsuariosEfectivos,
} from "./directoryService";
import { almacen } from "../lib/store";
import { auditar } from "../lib/audit";
import type { SkuLicencia } from "../types";

export const FRASE_AUTORIZACION = "AUTORIZO CAMBIO MASIVO A BUSINESS PREMIUM";

interface UsuarioElegible {
  id: string;
  displayName: string;
  userPrincipalName: string;
}

export interface VistaPreviaCampaña {
  tokenRevision: string;
  generadoEn: string;
  fuente: "graph" | "demostracion";
  skuOrigen?: SkuLicencia;
  skuDestino?: SkuLicencia;
  disponibles: number;
  suficientes: boolean;
  elegibles: UsuarioElegible[];
}

/**
 * La vista previa se apoya en directoryService (lecturas reales de Graph
 * cuando hay credenciales, con fallback a demostración), la misma fuente que
 * usan los módulos de Usuarios/Grupos/Licencias, para que la campaña vea
 * exactamente el mismo estado que el resto de la plataforma.
 */
export async function previsualizarCampaña(): Promise<VistaPreviaCampaña> {
  const [usuarios, skus, fuente] = await Promise.all([listarUsuariosEfectivos(), listarSkusEfectivos(), fuenteDirectorio()]);
  const skuOrigen = skus.find((s) => s.skuPartNumber === SKU_ESTANDAR);
  const skuDestino = skus.find((s) => s.skuPartNumber === SKU_PREMIUM);
  const elegiblesCompletos = usuarios.filter(
    (u) => u.accountEnabled && !u.esCuentaEmergencia && u.licencias.includes(SKU_ESTANDAR) && !u.licencias.includes(SKU_PREMIUM),
  );
  const disponibles = skuDestino?.disponibles ?? 0;

  const idsOrdenados = elegiblesCompletos.map((u) => u.id).sort().join("|");
  const tokenRevision = createHash("sha256").update(`${idsOrdenados}::${disponibles}`).digest("hex").slice(0, 16);

  return {
    tokenRevision,
    generadoEn: new Date().toISOString(),
    fuente,
    skuOrigen,
    skuDestino,
    disponibles,
    suficientes: disponibles >= elegiblesCompletos.length,
    elegibles: elegiblesCompletos.map((u) => ({ id: u.id, displayName: u.displayName, userPrincipalName: u.userPrincipalName })),
  };
}

export interface ResultadoCampaña {
  id: string;
  fecha: string;
  aprobador: string;
  fuente: string;
  totalElegibles: number;
  exitosos: number;
  fallidos: number;
  detalle: { usuario: string; upn: string; resultado: "Exito" | "Fallo"; error?: string }[];
}

export async function ejecutarCampaña(params: {
  aprobadorUpn: string;
  frase: string;
  tokenRevision: string;
  confirmoRevisionImpacto: boolean;
}): Promise<ResultadoCampaña> {
  if (params.frase.trim() !== FRASE_AUTORIZACION) {
    throw new Error(`Debe escribir exactamente la frase de autorización: "${FRASE_AUTORIZACION}".`);
  }
  if (!params.confirmoRevisionImpacto) {
    throw new Error("Debe confirmar explícitamente la revisión de impacto antes de ejecutar la campaña.");
  }

  const vistaActual = await previsualizarCampaña();
  if (vistaActual.tokenRevision !== params.tokenRevision) {
    throw new Error(
      "La lista de personas afectadas cambió desde la última revisión. Genere una nueva revisión antes de ejecutar (no se realizó ningún cambio).",
    );
  }
  if (!vistaActual.suficientes) {
    throw new Error(
      `No hay licencias Premium suficientes (disponibles: ${vistaActual.disponibles}, requeridas: ${vistaActual.elegibles.length}). No se realizó ningún cambio.`,
    );
  }
  if (!vistaActual.skuOrigen || !vistaActual.skuDestino) {
    throw new Error("No fue posible identificar los SKU de origen y destino en el tenant.");
  }

  const usarGraphReal = vistaActual.fuente === "graph" && productionGraphConfigured;
  const detalle: ResultadoCampaña["detalle"] = [];

  for (const usuario of vistaActual.elegibles) {
    try {
      if (usarGraphReal) {
        await graphProduccion.post(`/users/${usuario.id}/assignLicense`, {
          addLicenses: [{ skuId: vistaActual.skuDestino.skuId, disabledPlans: [] }],
          removeLicenses: [vistaActual.skuOrigen.skuId],
        });
      } else {
        await asignarLicenciasUsuario(usuario.id, [SKU_PREMIUM], [SKU_ESTANDAR]);
      }
      detalle.push({ usuario: usuario.displayName, upn: usuario.userPrincipalName, resultado: "Exito" });
    } catch (error) {
      detalle.push({
        usuario: usuario.displayName,
        upn: usuario.userPrincipalName,
        resultado: "Fallo",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  if (usarGraphReal) invalidarCacheDirectorio();

  const resultado: ResultadoCampaña = {
    id: `CAMP-${randomUUID().slice(0, 8).toUpperCase()}`,
    fecha: new Date().toISOString(),
    aprobador: params.aprobadorUpn,
    fuente: vistaActual.fuente,
    totalElegibles: vistaActual.elegibles.length,
    exitosos: detalle.filter((d) => d.resultado === "Exito").length,
    fallidos: detalle.filter((d) => d.resultado === "Fallo").length,
    detalle,
  };

  almacen.registrarCampaña(resultado as unknown as Record<string, unknown>);
  auditar({
    actor: params.aprobadorUpn,
    accion: "Ejecutar campaña masiva: Business Standard → Business Premium",
    entidad: "CampañaLicencias",
    entidadId: resultado.id,
    resultado: resultado.fallidos > 0 ? "Fallo" : "Exito",
    detalle: `${resultado.exitosos}/${resultado.totalElegibles} cuentas migradas (${vistaActual.fuente}). Recuerde dejar PHX_ENABLE_WRITES=false al finalizar la ventana.`,
  });

  return resultado;
}
