import { ConfidentialClientApplication } from "@azure/msal-node";
import { config, productionGraphConfigured, readOnlyGraphConfigured } from "../config";

/**
 * Adquisición de tokens con MSAL (flujo de credenciales de cliente / app-only).
 *
 * Las dos identidades quedan estrictamente separadas:
 *  - "Phoenix Security Assessment – ReadOnly": para todas las lecturas.
 *  - "Phoenix Security Deployment – Production": únicamente para operaciones
 *    de escritura, y solo cuando PHX_ENABLE_WRITES=true.
 *
 * Los secretos se leen exclusivamente de variables de entorno (o, en Azure,
 * de Key Vault referenciado desde App Service Configuration). Nunca se
 * exponen al navegador ni se registran en logs.
 */

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

let readOnlyApp: ConfidentialClientApplication | null = null;
let productionApp: ConfidentialClientApplication | null = null;

function construirCliente(clientId: string, clientSecret: string): ConfidentialClientApplication {
  return new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
  });
}

export async function obtenerTokenSoloLectura(): Promise<string> {
  if (!readOnlyGraphConfigured) {
    throw new Error("La identidad de solo lectura no está configurada (modo demostración activo).");
  }
  if (!readOnlyApp) {
    readOnlyApp = construirCliente(config.readOnly.clientId, config.readOnly.clientSecret);
  }
  const resultado = await readOnlyApp.acquireTokenByClientCredential({ scopes: [GRAPH_SCOPE] });
  if (!resultado?.accessToken) throw new Error("No se pudo obtener un token de solo lectura de Microsoft Graph.");
  return resultado.accessToken;
}

export async function obtenerTokenProduccion(): Promise<string> {
  if (!productionGraphConfigured) {
    throw new Error("La identidad de producción no está configurada.");
  }
  if (!config.enableWrites) {
    throw new Error("Las escrituras contra el tenant están deshabilitadas (PHX_ENABLE_WRITES=false).");
  }
  if (!productionApp) {
    productionApp = construirCliente(config.production.clientId, config.production.clientSecret);
  }
  const resultado = await productionApp.acquireTokenByClientCredential({ scopes: [GRAPH_SCOPE] });
  if (!resultado?.accessToken) throw new Error("No se pudo obtener un token de producción de Microsoft Graph.");
  return resultado.accessToken;
}
