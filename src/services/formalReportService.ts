import { BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TextRun } from "docx";
import { almacen } from "../lib/store";
import { obtenerHallazgosEfectivos } from "./assessmentService";
import {
  COLOR_ACENTO,
  COLOR_CRITICIDAD,
  COLOR_MARCA,
  COLOR_TEXTO_SUAVE,
  ETIQUETA_ESTADO_HALLAZGO,
  ORDEN_CRITICIDAD,
  construirPortada,
  controlesIso,
  parrafo,
  rolResponsable,
  subtitulo,
  tabla,
  tituloSeccion,
} from "./docxHelpers";
import {
  META_ANUAL,
  PUNTO_INFLEXION,
  calcularPuntajeGlobal,
  coberturaPorDominio,
  contarBrechasPorCriticidad,
  rankingAccionesPrioritarias,
} from "./scoringService";
import type { CambioGobernado, EstadoCambio } from "../types";

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

export async function generarInformeFormalAssessment(): Promise<Buffer> {
  const fecha = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  const { hallazgos, fuente } = await obtenerHallazgosEfectivos();
  const puntaje = calcularPuntajeGlobal(hallazgos);
  const brechas = contarBrechasPorCriticidad(hallazgos);
  const cobertura = coberturaPorDominio(hallazgos);
  const cambios = almacen.listarCambios();
  const cambiosActivos = cambios.filter((c) => c.estado !== "Cerrado" && c.estado !== "Rechazado");

  const issues = hallazgos
    .filter((h) => h.estado === "Brecha" || h.estado === "Parcial" || h.estado === "RequiereLicencia")
    .sort((a, b) => ORDEN_CRITICIDAD[a.criticidad] - ORDEN_CRITICIDAD[b.criticidad]);

  const prioritarias = rankingAccionesPrioritarias(hallazgos, 8);

  const portada = construirPortada("Informe de Assessment y Gobierno de Seguridad", fecha);

  const resumenEjecutivo: (Paragraph | Table)[] = [
    tituloSeccion("1. Resumen ejecutivo"),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text:
            "Este informe resume el estado de la postura de seguridad de Microsoft 365 del tenant Phoenix Service, los issues (hallazgos abiertos) identificados, las mejoras en curso bajo el proceso de gobierno de cambios de la plataforma, y las acciones prioritarias recomendadas para remediarlos. Cada hallazgo se referencia contra el control del Anexo A de ISO/IEC 27001:2022 que le corresponde, como base para la evaluación de riesgo y el plan de remediación.",
          size: 20,
          color: COLOR_TEXTO_SUAVE,
        }),
      ],
    }),
    tabla(
      ["Indicador", "Valor"],
      [
        ["Puntaje global de postura", `${puntaje} / 100`],
        ["Punto de inflexión objetivo", `${PUNTO_INFLEXION} / 100`],
        ["Meta anual", `${META_ANUAL} / 100`],
        ["Brechas críticas", `${brechas.criticas}`],
        ["Brechas altas", `${brechas.altas}`],
        ["Brechas medias", `${brechas.medias}`],
        ["Brechas bajas", `${brechas.bajas}`],
        ["Controles implementados", `${brechas.implementados}`],
        ["Issues abiertos (brecha, parcial o requiere licencia)", `${issues.length}`],
        ["Mejoras (cambios gobernados) activas", `${cambiosActivos.length}`],
        ["Mejoras (cambios gobernados) totales", `${cambios.length}`],
      ],
      [6300, 2900],
    ),
    new Paragraph({ spacing: { before: 300 } }),
    subtitulo("Cobertura por dominio"),
    tabla(
      ["Dominio", "Actual", "Meta", "Brecha"],
      cobertura.map((c) => [c.dominio, `${c.actual}/100`, `${c.meta}/100`, c.brecha > 0 ? `${c.brecha} pts` : "Cumplida"]),
      [3200, 2000, 2000, 2000],
    ),
  ];

  const alcance: Paragraph[] = [
    tituloSeccion("2. Alcance y metodología"),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `Fuente de datos: ${fuente === "graph" ? "los hallazgos de Entra ID se calculan en tiempo real a partir de las políticas de acceso condicional y de autenticación del tenant Phoenix Service vía Microsoft Graph; el resto del catálogo (Intune, Defender, Purview, Exchange) proviene del relevamiento curado por el equipo de seguridad." : "modo de demostración (sin credenciales de Microsoft Graph configuradas)."}`,
          size: 20,
          color: COLOR_TEXTO_SUAVE,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "Dominios evaluados: Microsoft Entra ID, Microsoft Intune, Microsoft Defender, Microsoft Purview y Exchange Online, contra la línea base de licenciamiento Microsoft 365 Business Premium.",
          size: 20,
          color: COLOR_TEXTO_SUAVE,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "Nota metodológica: los hallazgos de Entra ID relacionados con acceso condicional, MFA, autenticación heredada, métodos resistentes a phishing y licenciamiento P2 se determinan automáticamente contra la configuración en vivo del tenant. El resto del catálogo (Intune, Defender, Purview, Exchange, y la gobernanza de cuentas de emergencia dentro de Entra ID) es mantenido y revisado manualmente por el equipo de seguridad de Phoenix Service; su verificación automática contra Microsoft Graph es la siguiente etapa de esta plataforma.",
          size: 20,
          color: COLOR_TEXTO_SUAVE,
          italics: true,
        }),
      ],
    }),
  ];

  const bloquesIssues: (Paragraph | Table)[] = [tituloSeccion("3. Issues detectados")];
  bloquesIssues.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `${issues.length} hallazgo(s) sin implementar por completo, ordenados de mayor a menor criticidad. Cada uno indica el control ISO/IEC 27001 afectado como referencia para la remediación.`,
          size: 20,
          color: COLOR_TEXTO_SUAVE,
        }),
      ],
    }),
  );

  issues.forEach((h, idx) => {
    bloquesIssues.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 80 },
        children: [
          new TextRun({ text: `3.${idx + 1}  `, bold: true, color: COLOR_MARCA }),
          new TextRun({ text: `[${h.criticidad}] `, bold: true, color: COLOR_CRITICIDAD[h.criticidad] }),
          new TextRun({ text: `${h.nombre} (${h.dominio})`, bold: true, color: COLOR_MARCA }),
        ],
      }),
    );
    bloquesIssues.push(
      tabla(
        ["Estado", "Control ISO/IEC 27001", "Cobertura actual", "Responsable"],
        [[ETIQUETA_ESTADO_HALLAZGO[h.estado], controlesIso(h.id), `${h.cobertura.cubiertos}/${h.cobertura.total}`, rolResponsable(h.responsable)]],
        [1900, 3300, 1900, 2100],
      ),
    );
    bloquesIssues.push(new Paragraph({ spacing: { before: 120 } }));
    bloquesIssues.push(parrafo("Qué existe hoy", h.queExiste));
    bloquesIssues.push(parrafo("Qué falta", h.queFalta));
    bloquesIssues.push(parrafo("Por qué es relevante", h.porQueRelevante));
    bloquesIssues.push(parrafo("Próxima acción recomendada", h.proximaAccion));
    bloquesIssues.push(parrafo("Licencia requerida", h.licenciaRequerida));
  });

  const mejoras: (Paragraph | Table)[] = [
    tituloSeccion("4. Mejoras en curso (cambios gobernados)"),
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: cambios.length
            ? `${cambios.length} cambio(s) gobernado(s) registrado(s) en la plataforma, cada uno con su propio flujo de evaluación, piloto y aprobación antes de llegar a producción.`
            : "Todavía no hay cambios gobernados registrados en la plataforma. Se recomienda crear un cambio gobernado por cada issue crítico o alto de la sección anterior.",
          size: 20,
          color: COLOR_TEXTO_SUAVE,
        }),
      ],
    }),
  ];
  if (cambios.length) {
    mejoras.push(
      tabla(
        ["ID", "Configuración / Política", "Estado", "Riesgo", "Solicitante", "Aprobador"],
        cambios.map((c: CambioGobernado) => [
          c.id,
          c.configuracionONombrePolitica,
          ETIQUETA_ESTADO_CAMBIO[c.estado],
          c.riesgo,
          c.solicitante,
          c.aprobador,
        ]),
        [1400, 3200, 1500, 1200, 1450, 1450],
      ),
    );
  }

  const gobierno: Paragraph[] = [
    tituloSeccion("5. Cómo gobernar correctamente estos hallazgos"),
    new Paragraph({
      spacing: { after: 140 },
      children: [
        new TextRun({
          text: "Recomendación de gobierno para remediar los issues de este informe, aplicando el modelo de gobierno ya disponible en Phoenix Security Control Center:",
          size: 20,
          color: COLOR_TEXTO_SUAVE,
        }),
      ],
    }),
    ...[
      "Crear un cambio gobernado por cada issue crítico o alto, con solicitante, aprobador y responsable técnico distintos (segregación de funciones).",
      "Documentar justificación, impacto esperado, plan de pruebas y plan de reversión antes de pasar de Evaluación a Diseño.",
      "Ejecutar cada cambio primero en un grupo piloto reducido, registrar el resultado del piloto y solo entonces avanzar a Aprobación.",
      "Excluir siempre las cuentas de emergencia (break-glass) del alcance de cualquier cambio de acceso condicional.",
      "Confirmar explícitamente personas afectadas, grupos, exclusiones, ventana de cambio y plan de reversión antes de desplegar a Producción.",
      "Adjuntar evidencia (capturas, resultados de piloto, aprobaciones) a cada cambio para sustentar auditorías futuras.",
      "Revisar la bitácora de auditoría y este mismo informe con cadencia mensual (alertas y controles fallidos), trimestral (riesgos, permisos y licencias) y anual (políticas y plan de mejora continua).",
    ].map(
      (texto, i) =>
        new Paragraph({
          spacing: { after: 90 },
          indent: { left: 300 },
          children: [
            new TextRun({ text: `${i + 1}. `, bold: true, color: COLOR_ACENTO }),
            new TextRun({ text: texto, size: 20, color: COLOR_TEXTO_SUAVE }),
          ],
        }),
    ),
  ];

  const prioridades: Paragraph[] = [
    tituloSeccion("6. Próximas acciones prioritarias recomendadas"),
    ...(prioritarias.length
      ? prioritarias.map(
          (h, i) =>
            new Paragraph({
              spacing: { after: 90 },
              children: [
                new TextRun({ text: `${i + 1}. `, bold: true, color: COLOR_ACENTO }),
                new TextRun({ text: `[${h.criticidad}] `, bold: true, color: COLOR_CRITICIDAD[h.criticidad] }),
                new TextRun({ text: `${h.nombre} (${h.dominio}) — `, bold: true, size: 20 }),
                new TextRun({ text: h.proximaAccion, size: 20, color: COLOR_TEXTO_SUAVE }),
              ],
            }),
        )
      : [new Paragraph({ children: [new TextRun({ text: "Sin acciones pendientes de priorizar." })] })]),
    new Paragraph({
      spacing: { before: 500 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E2E6EF", space: 8 } },
      children: [
        new TextRun({
          text: `Informe generado automáticamente por Phoenix Security Control Center — ${fecha}.`,
          italics: true,
          size: 16,
          color: COLOR_TEXTO_SUAVE,
        }),
      ],
    }),
  ];

  const documento = new Document({
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 20 } },
      },
    },
    sections: [
      {
        properties: {},
        children: [
          ...portada,
          ...resumenEjecutivo,
          new Paragraph({ pageBreakBefore: true }),
          ...alcance,
          new Paragraph({ pageBreakBefore: true }),
          ...bloquesIssues,
          new Paragraph({ pageBreakBefore: true }),
          ...mejoras,
          new Paragraph({ pageBreakBefore: true }),
          ...gobierno,
          new Paragraph({ pageBreakBefore: true }),
          ...prioridades,
        ],
      },
    ],
  });

  return Packer.toBuffer(documento);
}
