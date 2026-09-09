import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { almacen } from "../lib/store";
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

/**
 * Mapeo de cada hallazgo del Assessment a los controles del Anexo A de
 * ISO/IEC 27001:2022 (numeración de ISO/IEC 27002:2022) más directamente
 * relacionados, para que el informe formal indique qué control de la norma
 * queda afectado y sirva de base para el plan de remediación.
 */
const ISO_POR_HALLAZGO: Record<string, { codigo: string; nombre: string }[]> = {
  "hlz-mfa-admins": [
    { codigo: "A.8.5", nombre: "Autenticación segura" },
    { codigo: "A.8.2", nombre: "Derechos de acceso privilegiado" },
  ],
  "hlz-mfa-usuarios": [
    { codigo: "A.8.5", nombre: "Autenticación segura" },
    { codigo: "A.5.17", nombre: "Información de autenticación" },
  ],
  "hlz-auth-heredada": [
    { codigo: "A.8.5", nombre: "Autenticación segura" },
    { codigo: "A.5.15", nombre: "Control de acceso" },
  ],
  "hlz-auth-phishing-resistant": [{ codigo: "A.8.5", nombre: "Autenticación segura" }],
  "hlz-breakglass": [
    { codigo: "A.8.2", nombre: "Derechos de acceso privilegiado" },
    { codigo: "A.5.18", nombre: "Derechos de acceso" },
  ],
  "hlz-acceso-condicional": [
    { codigo: "A.5.15", nombre: "Control de acceso" },
    { codigo: "A.8.3", nombre: "Restricción de acceso a la información" },
  ],
  "hlz-intune-enrolamiento": [{ codigo: "A.8.1", nombre: "Dispositivos terminales de usuario" }],
  "hlz-intune-cumplimiento": [
    { codigo: "A.8.1", nombre: "Dispositivos terminales de usuario" },
    { codigo: "A.8.9", nombre: "Gestión de la configuración" },
  ],
  "hlz-bitlocker": [{ codigo: "A.8.24", nombre: "Uso de criptografía" }],
  "hlz-defender-edr": [{ codigo: "A.8.7", nombre: "Protección contra malware" }],
  "hlz-asr": [{ codigo: "A.8.7", nombre: "Protección contra malware" }],
  "hlz-proteccion-correo": [
    { codigo: "A.8.7", nombre: "Protección contra malware" },
    { codigo: "A.5.14", nombre: "Transferencia de información" },
  ],
  "hlz-dlp": [
    { codigo: "A.8.12", nombre: "Prevención de fuga de datos" },
    { codigo: "A.5.34", nombre: "Privacidad y protección de datos personales" },
  ],
  "hlz-etiquetas": [{ codigo: "A.5.12", nombre: "Clasificación de la información" }],
  "hlz-auditoria-retencion": [
    { codigo: "A.8.15", nombre: "Registro (logging)" },
    { codigo: "A.5.33", nombre: "Protección de los registros" },
  ],
  "hlz-identity-p2": [
    { codigo: "A.8.16", nombre: "Actividades de monitoreo" },
    { codigo: "A.5.15", nombre: "Control de acceso" },
  ],
  "hlz-defender-endpoint-p2": [{ codigo: "A.8.16", nombre: "Actividades de monitoreo" }],
  "hlz-defender-identity-cloudapps": [
    { codigo: "A.8.16", nombre: "Actividades de monitoreo" },
    { codigo: "A.5.23", nombre: "Seguridad de la información para el uso de servicios en la nube" },
  ],
  "hlz-purview-avanzado": [
    { codigo: "A.5.34", nombre: "Privacidad y protección de datos personales" },
    { codigo: "A.8.16", nombre: "Actividades de monitoreo" },
  ],
};

function controlesIso(hallazgoId: string): string {
  const controles = ISO_POR_HALLAZGO[hallazgoId];
  if (!controles || controles.length === 0) return "Sin control ISO/IEC 27001 asociado";
  return controles.map((c) => `${c.codigo} — ${c.nombre}`).join("; ");
}

/** Extrae solo el rol/cargo del campo "responsable" (ej. "Nombre — Cargo" → "Cargo"). */
function rolResponsable(responsable: string): string {
  const partes = responsable.split(" — ");
  return partes.length > 1 ? partes.slice(1).join(" — ") : responsable;
}

const ETIQUETA_ESTADO_HALLAZGO: Record<Hallazgo["estado"], string> = {
  Implementado: "Implementado",
  Parcial: "Parcial",
  Brecha: "Brecha",
  NoAplica: "No aplica",
  RequiereLicencia: "Requiere licencia adicional",
};

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

const COLOR_MARCA = "12224F"; // navy de la marca Phoenix
const COLOR_ACENTO = "FF6A3D"; // naranjo de la marca Phoenix
const COLOR_TABLA_HEADER = "EEF1F8";
const COLOR_TEXTO_SUAVE = "475066";

const COLOR_CRITICIDAD: Record<Hallazgo["criticidad"], string> = {
  Critica: "DC2626",
  Alta: "D97706",
  Media: "D97706",
  Baja: "2563EB",
};

function celda(texto: string, opciones: { negrita?: boolean; ancho: number; sombreado?: string; color?: string } ): TableCell {
  return new TableCell({
    width: { size: opciones.ancho, type: WidthType.DXA },
    shading: opciones.sombreado ? { type: ShadingType.CLEAR, fill: opciones.sombreado } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: texto, bold: opciones.negrita, color: opciones.color, size: 19 })],
      }),
    ],
  });
}

function filaTabla(valores: string[], anchos: number[], encabezado = false): TableRow {
  return new TableRow({
    children: valores.map((v, i) =>
      celda(v, { ancho: anchos[i], negrita: encabezado, sombreado: encabezado ? COLOR_TABLA_HEADER : undefined }),
    ),
    tableHeader: encabezado,
  });
}

function tabla(encabezados: string[], filas: string[][], anchos: number[]): Table {
  return new Table({
    width: { size: anchos.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: anchos,
    rows: [filaTabla(encabezados, anchos, true), ...filas.map((f) => filaTabla(f, anchos))],
  });
}

function tituloSeccion(texto: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_ACENTO, space: 4 } },
    children: [new TextRun({ text: texto, color: COLOR_MARCA, bold: true })],
  });
}

function subtitulo(texto: string, color = COLOR_MARCA): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 100 },
    children: [new TextRun({ text: texto, color, bold: true })],
  });
}

function parrafo(etiqueta: string, texto: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${etiqueta}: `, bold: true, size: 20 }),
      new TextRun({ text: texto, size: 20, color: COLOR_TEXTO_SUAVE }),
    ],
  });
}

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

  const portada: Paragraph[] = [
    new Paragraph({ spacing: { before: 1200 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "PHOENIX SECURITY CONTROL CENTER", bold: true, size: 24, color: COLOR_ACENTO })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 300 },
      children: [new TextRun({ text: "Informe de Assessment y Gobierno de Seguridad", bold: true, size: 44, color: COLOR_MARCA })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: "Microsoft 365 · Tenant Phoenix Service", size: 26, color: COLOR_TEXTO_SUAVE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 700 },
      children: [new TextRun({ text: `Fecha de emisión: ${fecha}`, size: 22, color: COLOR_TEXTO_SUAVE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "CONFIDENCIAL — USO INTERNO",
          bold: true,
          size: 20,
          color: "FFFFFF",
          shading: { type: ShadingType.CLEAR, fill: COLOR_MARCA },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1400 },
      children: [
        new TextRun({
          text: "Documento generado automáticamente por Phoenix Security Control Center. Distribución restringida a personal autorizado de gobierno de TI y seguridad de Phoenix Service.",
          italics: true,
          size: 18,
          color: COLOR_TEXTO_SUAVE,
        }),
      ],
    }),
    new Paragraph({ children: [new TextRun({ text: "", break: 1 })], pageBreakBefore: true }),
  ];

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
