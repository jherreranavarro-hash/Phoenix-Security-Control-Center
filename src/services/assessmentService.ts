import { hallazgosDemo } from "../data/demoAssessment";
import { readOnlyGraphConfigured } from "../config";
import { obtenerSkusReales } from "../graph/realDirectory";
import {
  obtenerMetodosAutenticacionResistentesPhishing,
  obtenerPoliticasAccesoCondicionalReales,
  type PoliticaAccesoCondicionalReal,
} from "../graph/realAssessment";
import type { Hallazgo } from "../types";

/**
 * Motor de Assessment real de Entra ID: convierte las políticas de acceso
 * condicional y de métodos de autenticación leídas de Microsoft Graph en el
 * estado de los hallazgos correspondientes del catálogo, en vez de usar el
 * valor fijo del catálogo de demostración.
 *
 * Alcance actual: solo los hallazgos de Entra ID que se pueden determinar de
 * forma razonable a partir de una única lectura de Graph (existencia y
 * estado de políticas). El resto del catálogo (Intune, Defender, Purview,
 * Exchange, y "Cuentas de emergencia" dentro de Entra ID) sigue viniendo del
 * catálogo curado por el equipo de seguridad — verificarlos de forma
 * automática y continua es la siguiente etapa de este motor.
 */

const TTL_CACHE_MS = 30_000;
let cache: { hallazgos: Hallazgo[]; fuente: "graph" | "demostracion"; en: number } | null = null;

function politicaAplicable(politicas: PoliticaAccesoCondicionalReal[], filtro: (p: PoliticaAccesoCondicionalReal) => boolean) {
  const candidatas = politicas.filter(filtro).filter((p) => p.estado !== "disabled");
  const habilitada = candidatas.find((p) => p.estado === "enabled");
  const enReporte = candidatas.find((p) => p.estado === "enabledForReportingButNotEnforced");
  return { existe: candidatas.length > 0, habilitada: Boolean(habilitada), enReporte: Boolean(enReporte) };
}

function estadoPorCriterios(cubiertos: number, total: number, licenciaFaltante = false): Hallazgo["estado"] {
  if (licenciaFaltante) return "RequiereLicencia";
  if (cubiertos >= total) return "Implementado";
  if (cubiertos > 0) return "Parcial";
  return "Brecha";
}

function aplicarOverridesEntraId(base: Hallazgo[], politicas: PoliticaAccesoCondicionalReal[], phishingResistente: { fido2Habilitado: boolean; windowsHelloHabilitado: boolean }, entraIdP2Licenciado: boolean): Hallazgo[] {
  return base.map((h): Hallazgo => {
    switch (h.id) {
      case "hlz-mfa-admins": {
        const r = politicaAplicable(politicas, (p) => p.incluyeRolesPrivilegiados && p.exigeMfa);
        const cubiertos = (r.existe ? 1 : 0) + (r.habilitada ? 1 : 0);
        return {
          ...h,
          estado: estadoPorCriterios(cubiertos, 2),
          cobertura: { cubiertos, total: 2 },
          queExiste: r.existe
            ? `Existe una política de acceso condicional dirigida a roles con privilegios que exige MFA, en estado "${r.habilitada ? "activada" : "solo informe"}".`
            : "No se encontró ninguna política de acceso condicional que exija MFA a roles con privilegios.",
          queFalta: r.habilitada
            ? "Ninguna — el control está activo. Verificar periódicamente que la política siga cubriendo todos los roles con privilegios."
            : r.existe
              ? "Cambiar la política de modo informe a modo aplicado (enforced)."
              : "Crear una política de acceso condicional dirigida a roles con privilegios que exija MFA.",
        };
      }
      case "hlz-mfa-usuarios": {
        const r = politicaAplicable(politicas, (p) => p.incluyeTodosLosUsuarios && p.exigeMfa);
        const cubiertos = (r.existe ? 1 : 0) + (r.habilitada ? 1 : 0);
        return {
          ...h,
          estado: estadoPorCriterios(cubiertos, 2),
          cobertura: { cubiertos, total: 2 },
          queExiste: r.existe
            ? `Existe una política de acceso condicional dirigida a todos los usuarios que exige MFA, en estado "${r.habilitada ? "activada" : "solo informe"}".`
            : "No se encontró ninguna política de acceso condicional que exija MFA a todos los usuarios.",
          queFalta: r.habilitada
            ? "Ninguna — el control está activo."
            : r.existe
              ? "Cambiar la política de modo informe a modo aplicado (enforced)."
              : "Crear una política de acceso condicional dirigida a todos los usuarios que exija MFA.",
        };
      }
      case "hlz-auth-heredada": {
        const r = politicaAplicable(politicas, (p) => p.incluyeClientesHeredados && p.bloquea);
        const cubiertos = (r.existe ? 1 : 0) + (r.habilitada ? 1 : 0);
        return {
          ...h,
          estado: estadoPorCriterios(cubiertos, 2),
          cobertura: { cubiertos, total: 2 },
          queExiste: r.existe
            ? `Existe una política de acceso condicional que bloquea clientes de autenticación heredada, en estado "${r.habilitada ? "activada" : "solo informe"}".`
            : "No se encontró ninguna política de acceso condicional que bloquee autenticación heredada.",
          queFalta: r.habilitada
            ? "Ninguna — el control está activo."
            : r.existe
              ? "Cambiar la política de modo informe a modo aplicado (enforced)."
              : "Crear una política de acceso condicional que bloquee clientes de autenticación heredada (exchangeActiveSync, other).",
        };
      }
      case "hlz-auth-phishing-resistant": {
        const cubiertos = (phishingResistente.fido2Habilitado ? 1 : 0) + (phishingResistente.windowsHelloHabilitado ? 1 : 0);
        return {
          ...h,
          estado: estadoPorCriterios(cubiertos, 2),
          cobertura: { cubiertos, total: 2 },
          queExiste: `FIDO2 ${phishingResistente.fido2Habilitado ? "habilitado" : "deshabilitado"}; Windows Hello for Business ${phishingResistente.windowsHelloHabilitado ? "habilitado" : "deshabilitado"} en la política de métodos de autenticación del tenant.`,
          queFalta: cubiertos === 2 ? "Ninguna — ambos métodos están habilitados a nivel de tenant." : "Habilitar los métodos de autenticación resistentes a phishing que falten (FIDO2 y/o Windows Hello for Business).",
        };
      }
      case "hlz-acceso-condicional": {
        const habilitadas = politicas.filter((p) => p.estado === "enabled").length;
        const totalBase = 4; // línea base: MFA admins, MFA usuarios, bloqueo heredado, riesgo
        const cubiertos = Math.min(habilitadas, totalBase);
        return {
          ...h,
          estado: estadoPorCriterios(cubiertos, totalBase),
          cobertura: { cubiertos, total: totalBase },
          queExiste: `${politicas.length} política(s) de acceso condicional existen en el tenant, ${habilitadas} en estado activado.`,
          queFalta: cubiertos >= totalBase ? "Ninguna — hay una línea base razonable de políticas activas." : "Completar el set base de políticas (MFA, bloqueo de auth heredada, dispositivos compatibles, riesgo) en estado activado.",
        };
      }
      case "hlz-identity-p2": {
        if (!entraIdP2Licenciado) {
          return { ...h, estado: "RequiereLicencia" };
        }
        const r = politicaAplicable(politicas, (p) => p.exigeRiesgoUsuarioOInicioSesion);
        const cubiertos = (r.existe ? 1 : 0) + (r.habilitada ? 1 : 0);
        return {
          ...h,
          estado: estadoPorCriterios(cubiertos, 2),
          cobertura: { cubiertos, total: 2 },
          queExiste: `Entra ID P2 está licenciado. ${r.existe ? `Existe una política de acceso condicional basada en riesgo, en estado "${r.habilitada ? "activada" : "solo informe"}".` : "No se encontró ninguna política de acceso condicional basada en riesgo."}`,
          queFalta: r.habilitada ? "Ninguna — el control está activo." : "Crear o activar una política de acceso condicional basada en riesgo de usuario/inicio de sesión.",
        };
      }
      default:
        return h;
    }
  });
}

/**
 * Devuelve el catálogo de hallazgos "efectivo": si hay conexión de solo
 * lectura a Microsoft Graph, los hallazgos de Entra ID listados arriba se
 * calculan a partir de las políticas reales del tenant; el resto del
 * catálogo (y todo el catálogo completo si no hay conexión, o si la lectura
 * a Graph falla) es el catálogo de demostración curado.
 */
export async function obtenerHallazgosEfectivos(): Promise<{ hallazgos: Hallazgo[]; fuente: "graph" | "demostracion" }> {
  if (cache && Date.now() - cache.en < TTL_CACHE_MS) return cache;

  if (readOnlyGraphConfigured) {
    try {
      const [politicas, phishingResistente, skus] = await Promise.all([
        obtenerPoliticasAccesoCondicionalReales(),
        obtenerMetodosAutenticacionResistentesPhishing(),
        obtenerSkusReales(),
      ]);
      const entraIdP2Licenciado = skus.some((s) => s.skuPartNumber.includes("AAD_PREMIUM_P2") && s.total > 0);
      const hallazgos = aplicarOverridesEntraId(hallazgosDemo, politicas, phishingResistente, entraIdP2Licenciado);
      cache = { hallazgos, fuente: "graph", en: Date.now() };
      return cache;
    } catch (error) {
      console.error(
        "[phoenix-security] No fue posible leer el Assessment real de Entra ID (requiere Policy.Read.All). Se usa el catálogo de demostración como respaldo:",
        error,
      );
    }
  }

  cache = { hallazgos: hallazgosDemo, fuente: "demostracion", en: Date.now() };
  return cache;
}

/** Invalida la caché del Assessment real (uso interno / pruebas). */
export function invalidarCacheAssessment(): void {
  cache = null;
}
