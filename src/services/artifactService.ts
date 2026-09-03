import { obtenerCambio } from "./changeService";
import { hallazgosDemo } from "../data/demoAssessment";
import { catalogoPoliticas } from "../data/policyCatalog";
import { rankingAccionesPrioritarias } from "./scoringService";
import type { CambioGobernado } from "../types";

export type TipoArtefacto =
  | "politica-gobierno"
  | "procedimiento-operativo"
  | "evaluacion-riesgo"
  | "plan-pruebas-piloto"
  | "registro-cambio-reversion"
  | "informe-implementacion"
  | "plan-mejora-continua"
  | "inventario-configuraciones";

const NOMBRES_ARTEFACTO: Record<TipoArtefacto, string> = {
  "politica-gobierno": "Política de gobierno de configuración",
  "procedimiento-operativo": "Procedimiento operativo",
  "evaluacion-riesgo": "Evaluación de riesgo e impacto",
  "plan-pruebas-piloto": "Plan de pruebas piloto",
  "registro-cambio-reversion": "Registro de cambio y reversión",
  "informe-implementacion": "Informe de implementación",
  "plan-mejora-continua": "Plan de mejora continua",
  "inventario-configuraciones": "Inventario de configuraciones",
};

function encabezado(titulo: string, cambio: CambioGobernado): string {
  return `# ${titulo}
## ${cambio.configuracionONombrePolitica}

| Campo | Valor |
|---|---|
| Objetivo | Formalizar y dejar trazabilidad de "${cambio.configuracionONombrePolitica}" dentro del Phoenix Security Control Center. |
| Alcance | ${cambio.alcance.gruposIncluidos.length} grupo(s) incluido(s), ${cambio.alcance.usuariosIndividuales.length} usuario(s) individual(es), ${cambio.alcance.totalUsuariosAfectados} persona(s) afectada(s) en total. |
| Responsable | ${cambio.responsableTecnico} |
| Aprobador | ${cambio.aprobador} |
| Riesgo | ${cambio.riesgo} |
| Requisitos previos | ${cambio.requisitosPrevios.join("; ") || "Ninguno registrado"} |
| Licenciamiento | Microsoft 365 Business Premium (Entra ID P1, Intune P1, Defender for Business, Defender for Office 365 P1, Purview base) |
| Validación | ${cambio.planPruebas || "Pendiente de definir"} |
| Evidencias | ${cambio.evidencias.length} adjunta(s) |
| Reversión | ${cambio.planReversion || "Pendiente de definir"} |
| Frecuencia de revisión | Mensual (alertas y excepciones), trimestral (riesgos y permisos), anual (política completa) |
| Fecha de emisión | ${new Date().toLocaleDateString("es-CL")} |
| Estado del cambio | ${cambio.estado} |
`;
}

function cuerpoPorTipo(tipo: TipoArtefacto, cambio: CambioGobernado): string {
  switch (tipo) {
    case "politica-gobierno":
      return `
## Justificación
${cambio.justificacion}

## Impacto esperado
${cambio.impactoEsperado}

## Exclusiones obligatorias
${cambio.exclusiones.length ? cambio.exclusiones.map((e) => `- ${e}`).join("\n") : "- Cuentas de emergencia (break-glass) excluidas por diseño."}

## Responsable dueño del control
${cambio.responsableTecnico}
`;
    case "procedimiento-operativo":
      return `
## Pasos operativos
1. Verificar prerrequisitos: ${cambio.requisitosPrevios.join(", ") || "N/A"}.
2. Confirmar alcance final (grupos, usuarios, exclusiones).
3. Ejecutar el cambio en la ventana aprobada.
4. Validar resultado según el plan de pruebas.
5. Registrar evidencia y cerrar el cambio.

## Plan de pruebas
${cambio.planPruebas || "Pendiente de definir"}

## Plan de reversión
${cambio.planReversion || "Pendiente de definir"}
`;
    case "evaluacion-riesgo":
      return `
## Riesgo del cambio
${cambio.riesgo}

## Riesgo residual
${cambio.riesgoResidual}

## Personas y equipos afectados
${cambio.alcance.totalUsuariosAfectados} usuario(s), ${cambio.alcance.totalEquiposAfectados} equipo(s).

## Exclusiones
${cambio.alcance.gruposExcluidos.join(", ") || "Ninguna adicional"}
`;
    case "plan-pruebas-piloto":
      return `
## Alcance del piloto
${cambio.alcance.gruposIncluidos.join(", ") || "Por definir"}

## Ventana del piloto
${cambio.alcance.ventanaPilotoInicio ?? "Por definir"} a ${cambio.alcance.ventanaPilotoFin ?? "Por definir"}

## Validaciones previas
${cambio.alcance.validacionesPrevias.map((v) => `- ${v}`).join("\n") || "- Sin validaciones registradas"}

## Resultado del piloto
${cambio.resultadoPiloto ?? "Pendiente"}
`;
    case "registro-cambio-reversion":
      return `
## Historial del cambio
${cambio.historial.map((h) => `- ${new Date(h.fecha).toLocaleString("es-CL")} — ${h.actor}: ${h.accion}${h.detalle ? ` (${h.detalle})` : ""}`).join("\n")}

## Plan de reversión
${cambio.planReversion || "Pendiente de definir"}
`;
    case "informe-implementacion":
      return `
## Resultado
Estado actual: ${cambio.estado}.
Resultado del piloto: ${cambio.resultadoPiloto ?? "N/A"}.

## Evidencias adjuntas
${cambio.evidencias.map((e) => `- ${e.titulo} (${e.url}) — ${new Date(e.fecha).toLocaleDateString("es-CL")}`).join("\n") || "Ninguna registrada"}
`;
    case "plan-mejora-continua":
      return `
## Próximos hallazgos prioritarios relacionados
${rankingAccionesPrioritarias(hallazgosDemo, 5).map((h) => `- [${h.criticidad}] ${h.nombre} (${h.dominio})`).join("\n")}

## Cadencia de revisión
- Mensual: alertas, excepciones, controles fallidos y cambios pendientes.
- Trimestral: riesgos, permisos, licencias, responsables y pruebas de reversión.
- Anual: actualización de políticas, procedimientos, inventario y plan de mejora continua.
`;
    case "inventario-configuraciones":
      return `
## Políticas relacionadas al catálogo
${catalogoPoliticas
  .filter((p) => p.id === cambio.politicaId)
  .map((p) => `- ${p.nombre} (${p.producto}) — estado: ${p.estado}`)
  .join("\n") || "Sin política de catálogo asociada directamente."}
`;
    default:
      return "";
  }
}

export function generarArtefacto(tipo: TipoArtefacto, cambioId: string): { nombreArchivo: string; contenido: string } {
  const cambio = obtenerCambio(cambioId);
  const titulo = NOMBRES_ARTEFACTO[tipo];
  const contenido = encabezado(titulo, cambio) + cuerpoPorTipo(tipo, cambio);
  const nombreArchivo = `${tipo}-${cambio.id}.md`;
  return { nombreArchivo, contenido };
}

export function generarInventarioGeneral(): { nombreArchivo: string; contenido: string } {
  const fecha = new Date().toLocaleDateString("es-CL");
  const filas = catalogoPoliticas
    .map(
      (p) =>
        `| ${p.nombre} | ${p.producto} | ${p.estado} | ${p.riesgo} | ${p.coberturaActual.cubiertos}/${p.coberturaActual.total} | ${p.responsable} |`,
    )
    .join("\n");
  const contenido = `# Inventario de configuraciones — Phoenix Security Control Center
Fecha de emisión: ${fecha}

| Política | Producto | Estado | Riesgo | Cobertura | Responsable |
|---|---|---|---|---|---|
${filas}

Frecuencia de revisión: anual (revisión completa), trimestral (spot-check de responsables y licencias).
`;
  return { nombreArchivo: `inventario-configuraciones-${Date.now()}.md`, contenido };
}
