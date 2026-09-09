import { obtenerCambio } from "./changeService";
import { almacen } from "../lib/store";
import { hallazgosDemo } from "../data/demoAssessment";
import { catalogoPoliticas } from "../data/policyCatalog";
import { obtenerHallazgosEfectivos } from "./assessmentService";
import {
  META_ANUAL,
  PUNTO_INFLEXION,
  calcularPuntajeGlobal,
  coberturaPorDominio,
  contarBrechasPorCriticidad,
  rankingAccionesPrioritarias,
} from "./scoringService";
import type { CambioGobernado, EstadoCambio, Hallazgo } from "../types";

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

const ETIQUETA_ESTADO_CAMBIO: Record<EstadoCambio, string> = {
  Evaluacion: "Evaluación",
  Diseno: "Diseño",
  Piloto: "Piloto",
  Aprobacion: "Aprobación",
  Produccion: "Producción",
  Revertido: "Revertido",
  Cerrado: "Cerrado",
  Rechazado: "Rechazado",
};

const ORDEN_CRITICIDAD: Record<Hallazgo["criticidad"], number> = { Critica: 0, Alta: 1, Media: 2, Baja: 3 };

/**
 * Informe de gobierno con el mismo espíritu que los reportes de "Assessment /
 * puntos de mejora" de las consolas de Microsoft (ej. Puntuación de seguridad):
 * un resumen ejecutivo, la lista de issues abiertos (hallazgos sin cerrar) y
 * el estado de las mejoras en curso (cambios gobernados), todo en un único
 * documento descargable.
 */
export async function generarInformeGobierno(): Promise<{ nombreArchivo: string; contenido: string }> {
  const fecha = new Date().toLocaleDateString("es-CL");
  const { hallazgos, fuente } = await obtenerHallazgosEfectivos();
  const puntaje = calcularPuntajeGlobal(hallazgos);
  const brechas = contarBrechasPorCriticidad(hallazgos);
  const cobertura = coberturaPorDominio(hallazgos);
  const cambios = almacen.listarCambios();
  const cambiosActivos = cambios.filter((c) => c.estado !== "Cerrado" && c.estado !== "Rechazado");

  const issues = hallazgos
    .filter((h) => h.estado === "Brecha" || h.estado === "Parcial" || h.estado === "RequiereLicencia")
    .sort((a, b) => ORDEN_CRITICIDAD[a.criticidad] - ORDEN_CRITICIDAD[b.criticidad]);

  const filasCobertura = cobertura
    .map((c) => `| ${c.dominio} | ${c.actual}/100 | ${c.meta}/100 | ${c.brecha > 0 ? `${c.brecha} pts` : "Cumplida"} |`)
    .join("\n");

  const bloquesIssues = issues
    .map(
      (h) => `### [${h.criticidad}] ${h.nombre} — ${h.estado === "RequiereLicencia" ? "Requiere licencia" : h.estado} (${h.dominio})
- **Qué existe hoy:** ${h.queExiste}
- **Qué falta:** ${h.queFalta}
- **Por qué es relevante:** ${h.porQueRelevante}
- **Cobertura actual:** ${h.cobertura.cubiertos}/${h.cobertura.total}
- **Próxima acción:** ${h.proximaAccion}
- **Responsable:** ${h.responsable}
- **Licencia requerida:** ${h.licenciaRequerida}
`,
    )
    .join("\n");

  const filasCambios = cambios.length
    ? cambios
        .map(
          (c: CambioGobernado) =>
            `| ${c.id} | ${c.configuracionONombrePolitica} | ${ETIQUETA_ESTADO_CAMBIO[c.estado]} | ${c.riesgo} | ${c.solicitante} | ${c.aprobador} | ${new Date(c.actualizadoEn).toLocaleDateString("es-CL")} |`,
        )
        .join("\n")
    : "| — | Sin cambios gobernados registrados todavía | — | — | — | — | — |";

  const prioritarias = rankingAccionesPrioritarias(hallazgos, 8)
    .map((h, i) => `${i + 1}. [${h.criticidad}] ${h.nombre} (${h.dominio}) — ${h.proximaAccion}`)
    .join("\n");

  const contenido = `# Informe de gobierno — Issues y mejoras
## Phoenix Security Control Center · Tenant Phoenix Service
Fecha de emisión: ${fecha}
Fuente del Assessment: ${fuente === "graph" ? "detección en tiempo real contra Microsoft Graph (Entra ID) + catálogo curado (resto de dominios)" : "catálogo de demostración"}

## Resumen ejecutivo

| Indicador | Valor |
|---|---|
| Puntaje global de postura | ${puntaje}/100 |
| Punto de inflexión | ${PUNTO_INFLEXION}/100 |
| Meta anual | ${META_ANUAL}/100 |
| Brechas críticas | ${brechas.criticas} |
| Brechas altas | ${brechas.altas} |
| Brechas medias | ${brechas.medias} |
| Brechas bajas | ${brechas.bajas} |
| Controles implementados | ${brechas.implementados} |
| Issues abiertos (brecha, parcial o requiere licencia) | ${issues.length} |
| Mejoras (cambios gobernados) activas | ${cambiosActivos.length} |
| Mejoras (cambios gobernados) totales | ${cambios.length} |

## Cobertura por dominio

| Dominio | Actual | Meta | Brecha |
|---|---|---|---|
${filasCobertura}

## Issues detectados (${issues.length})
Hallazgos del Assessment que aún no están completamente implementados, ordenados de mayor a menor criticidad.

${bloquesIssues || "Sin issues abiertos — todos los hallazgos evaluados están implementados."}

## Mejoras en curso (cambios gobernados)

| ID | Configuración / Política | Estado | Riesgo | Solicitante | Aprobador | Actualizado |
|---|---|---|---|---|---|---|
${filasCambios}

## Próximas acciones prioritarias recomendadas
${prioritarias || "Sin acciones pendientes de priorizar."}

## Cadencia de revisión de este informe
- Mensual: alertas, excepciones, controles fallidos y cambios pendientes.
- Trimestral: riesgos, permisos, licencias, responsables y pruebas de reversión.
- Anual: actualización de políticas, procedimientos, inventario y plan de mejora continua.
`;

  return { nombreArchivo: `informe-gobierno-issues-mejoras-${Date.now()}.md`, contenido };
}
