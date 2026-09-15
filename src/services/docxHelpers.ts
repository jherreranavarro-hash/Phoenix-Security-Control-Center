import {
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { Hallazgo } from "../types";

/**
 * Propiedades de página en horizontal (apaisada), para informes centrados en
 * tablas anchas (usuarios, grupos, licencias, buzones). Se pasan las
 * dimensiones de A4 en vertical con orientación LANDSCAPE: docx-js
 * intercambia ancho y alto internamente.
 */
export const PAGINA_APAISADA = {
  size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
  margin: { top: 900, bottom: 900, left: 900, right: 900 },
};

/**
 * Piezas de estilo compartidas entre los informes formales en Word
 * (formalReportService.ts, policyReportService.ts): identidad visual de
 * Phoenix Security Control Center, tablas, títulos, y el mapeo de cada
 * hallazgo del Assessment a su control ISO/IEC 27001:2022 más relacionado.
 */

export const COLOR_MARCA = "12224F"; // navy de la marca Phoenix
export const COLOR_ACENTO = "FF6A3D"; // naranjo de la marca Phoenix
export const COLOR_TABLA_HEADER = "EEF1F8";
export const COLOR_TEXTO_SUAVE = "475066";

export const COLOR_CRITICIDAD: Record<Hallazgo["criticidad"], string> = {
  Critica: "DC2626",
  Alta: "D97706",
  Media: "D97706",
  Baja: "2563EB",
};

export const ETIQUETA_ESTADO_HALLAZGO: Record<Hallazgo["estado"], string> = {
  Implementado: "Implementado",
  Parcial: "Parcial",
  Brecha: "Brecha",
  NoAplica: "No aplica",
  RequiereLicencia: "Requiere licencia adicional",
};

export const ORDEN_CRITICIDAD: Record<Hallazgo["criticidad"], number> = { Critica: 0, Alta: 1, Media: 2, Baja: 3 };

/**
 * Mapeo de cada hallazgo del Assessment a los controles del Anexo A de
 * ISO/IEC 27001:2022 (numeración de ISO/IEC 27002:2022) más directamente
 * relacionados, para que los informes formales indiquen qué control de la
 * norma queda afectado y sirva de base para el plan de remediación.
 */
export const ISO_POR_HALLAZGO: Record<string, { codigo: string; nombre: string }[]> = {
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

export function controlesIso(hallazgoId: string): string {
  const controles = ISO_POR_HALLAZGO[hallazgoId];
  if (!controles || controles.length === 0) return "Sin control ISO/IEC 27001 asociado";
  return controles.map((c) => `${c.codigo} — ${c.nombre}`).join("; ");
}

const ROL_POR_PRODUCTO: Record<string, string> = {
  "Entra ID": "Equipo de Identidad y Accesos (Entra ID)",
  Intune: "Equipo de Gestión de Endpoints (Intune)",
  Defender: "Equipo de Seguridad — Defender",
  Purview: "Equipo de Cumplimiento y Datos (Purview)",
  Exchange: "Equipo de Mensajería (Exchange)",
};

/**
 * Rol/equipo dueño genérico según el producto de Microsoft 365, para usar en
 * documentos formales cuando la única fuente disponible (como el catálogo de
 * políticas) guarda un nombre de persona ficticio sin cargo — evita filtrar
 * esa identidad inventada a un documento de gobierno real.
 */
export function rolPorProducto(producto: string): string {
  return ROL_POR_PRODUCTO[producto] ?? "Equipo de Seguridad de TI";
}

/** Extrae solo el rol/cargo del campo "responsable" (ej. "Nombre — Cargo" → "Cargo"). */
export function rolResponsable(responsable: string): string {
  const partes = responsable.split(" — ");
  return partes.length > 1 ? partes.slice(1).join(" — ") : responsable;
}

export function celda(texto: string, opciones: { negrita?: boolean; ancho: number; sombreado?: string; color?: string }): TableCell {
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

export function tabla(encabezados: string[], filas: string[][], anchos: number[]): Table {
  return new Table({
    width: { size: anchos.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: anchos,
    rows: [filaTabla(encabezados, anchos, true), ...filas.map((f) => filaTabla(f, anchos))],
  });
}

export function tituloSeccion(texto: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_ACENTO, space: 4 } },
    children: [new TextRun({ text: texto, color: COLOR_MARCA, bold: true })],
  });
}

export function subtitulo(texto: string, color = COLOR_MARCA): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 100 },
    children: [new TextRun({ text: texto, color, bold: true })],
  });
}

export function parrafo(etiqueta: string, texto: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${etiqueta}: `, bold: true, size: 20 }),
      new TextRun({ text: texto, size: 20, color: COLOR_TEXTO_SUAVE }),
    ],
  });
}

/** Portada de marca reutilizable para los informes formales en Word. */
export function construirPortada(titulo: string, fecha: string): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 1200 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "PHOENIX SECURITY CONTROL CENTER", bold: true, size: 24, color: COLOR_ACENTO })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 300 },
      children: [new TextRun({ text: titulo, bold: true, size: 44, color: COLOR_MARCA })],
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
}
