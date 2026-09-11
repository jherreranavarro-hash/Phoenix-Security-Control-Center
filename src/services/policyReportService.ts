import { Document, HeadingLevel, Packer, Paragraph, Table, TextRun } from "docx";
import { catalogoPoliticas } from "../data/policyCatalog";
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
  rolPorProducto,
  tabla,
  tituloSeccion,
} from "./docxHelpers";
import type { Politica } from "../types";

const PRODUCTOS: Politica["producto"][] = ["Entra ID", "Intune", "Defender", "Purview", "Exchange"];

/**
 * Informe de políticas de Microsoft 365 recomendadas: cruza cada issue
 * abierto del Assessment con la política del catálogo que lo remedia
 * (Hallazgo.politicaRelacionadaId → Politica), organizado por producto,
 * como un plan de implementación listo para llevar a Gobierno. Incluye
 * como apéndice las políticas del catálogo que hoy no están ligadas a
 * ningún issue abierto, a modo de buenas prácticas adicionales.
 */
export async function generarInformePoliticasRecomendadas(): Promise<Buffer> {
  const fecha = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  const { hallazgos, fuente } = await obtenerHallazgosEfectivos();
  const politicasPorId = new Map(catalogoPoliticas.map((p) => [p.id, p]));

  const issuesConPolitica = hallazgos
    .filter((h) => h.estado !== "Implementado" && h.estado !== "NoAplica" && h.politicaRelacionadaId && politicasPorId.has(h.politicaRelacionadaId))
    .sort((a, b) => ORDEN_CRITICIDAD[a.criticidad] - ORDEN_CRITICIDAD[b.criticidad]);

  const idsRecomendadas = new Set(issuesConPolitica.map((h) => h.politicaRelacionadaId));
  const politicasAdicionales = catalogoPoliticas.filter((p) => !idsRecomendadas.has(p.id));

  const portada = construirPortada("Informe de Políticas de Microsoft 365 Recomendadas", fecha);

  const resumen: (Paragraph | Table)[] = [
    tituloSeccion("1. Resumen"),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: "Este informe traduce cada issue abierto del Assessment de seguridad en la política de Microsoft 365 concreta que lo remedia — lista de despliegue del Catálogo de Políticas de Phoenix Security Control Center — organizada por producto y priorizada por la criticidad del hallazgo que la origina.",
          size: 20,
          color: COLOR_TEXTO_SUAVE,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Fuente del Assessment: ${fuente === "graph" ? "hallazgos de Entra ID detectados en tiempo real vía Microsoft Graph; resto del catálogo curado por el equipo de seguridad." : "catálogo de demostración."}`,
          size: 20,
          color: COLOR_TEXTO_SUAVE,
          italics: true,
        }),
      ],
    }),
    tabla(
      ["Producto", "Políticas recomendadas (issue abierto)", "Políticas adicionales del catálogo"],
      PRODUCTOS.map((prod) => [
        prod,
        `${issuesConPolitica.filter((h) => politicasPorId.get(h.politicaRelacionadaId!)?.producto === prod).length}`,
        `${politicasAdicionales.filter((p) => p.producto === prod).length}`,
      ]),
      [3200, 3200, 2800],
    ),
  ];

  const bloquesPoliticas: (Paragraph | Table)[] = [tituloSeccion("2. Políticas recomendadas por el Assessment")];
  bloquesPoliticas.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `${issuesConPolitica.length} política(s) recomendada(s) para cerrar los issues abiertos, organizadas por producto de Microsoft 365 y ordenadas de mayor a menor criticidad dentro de cada uno.`,
          size: 20,
          color: COLOR_TEXTO_SUAVE,
        }),
      ],
    }),
  );

  let contador = 0;
  for (const producto of PRODUCTOS) {
    const issuesDelProducto = issuesConPolitica.filter((h) => politicasPorId.get(h.politicaRelacionadaId!)?.producto === producto);
    if (issuesDelProducto.length === 0) continue;

    bloquesPoliticas.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 320, after: 120 },
        children: [new TextRun({ text: `2.${PRODUCTOS.indexOf(producto) + 1}  ${producto}`, bold: true, color: COLOR_MARCA, size: 24 })],
      }),
    );

    for (const h of issuesDelProducto) {
      contador++;
      const politica = politicasPorId.get(h.politicaRelacionadaId!) as Politica;
      bloquesPoliticas.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 80 },
          children: [
            new TextRun({ text: `${contador}. `, bold: true, color: COLOR_MARCA }),
            new TextRun({ text: `[${h.criticidad}] `, bold: true, color: COLOR_CRITICIDAD[h.criticidad] }),
            new TextRun({ text: politica.nombre, bold: true, color: COLOR_MARCA }),
          ],
        }),
      );
      bloquesPoliticas.push(
        tabla(
          ["Estado actual", "Cobertura", "Control ISO/IEC 27001", "Responsable"],
          [[ETIQUETA_ESTADO_HALLAZGO[h.estado], `${politica.coberturaActual.cubiertos}/${politica.coberturaActual.total}`, controlesIso(h.id), rolPorProducto(politica.producto)]],
          [2100, 1900, 3300, 1900],
        ),
      );
      bloquesPoliticas.push(new Paragraph({ spacing: { before: 120 } }));
      bloquesPoliticas.push(parrafo("Descripción de la política", politica.descripcion));
      bloquesPoliticas.push(parrafo("Issue que remedia", `${h.nombre} — ${h.queFalta}`));
      bloquesPoliticas.push(parrafo("Requisitos previos", politica.requisitosPrevios.join("; ") || "Ninguno registrado"));
      bloquesPoliticas.push(parrafo("Impacto operacional", politica.impactoOperacional));
      bloquesPoliticas.push(parrafo("Licenciamiento", politica.licenciamiento));
    }
  }

  const apendice: (Paragraph | Table)[] = [
    tituloSeccion("3. Políticas adicionales del catálogo"),
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: `${politicasAdicionales.length} política(s) del catálogo no están ligadas a un issue abierto actualmente. Se listan como buenas prácticas de defensa en profundidad adicionales a evaluar.`,
          size: 20,
          color: COLOR_TEXTO_SUAVE,
        }),
      ],
    }),
    tabla(
      ["Política", "Producto", "Riesgo", "Estado", "Cobertura"],
      politicasAdicionales.map((p) => [p.nombre, p.producto, p.riesgo, p.estado, `${p.coberturaActual.cubiertos}/${p.coberturaActual.total}`]),
      [3600, 1800, 1400, 1600, 1800],
    ),
  ];

  const proximosPasos: Paragraph[] = [
    tituloSeccion("4. Próximos pasos"),
    ...[
      "Priorizar la implementación siguiendo el orden de criticidad de cada política dentro de su producto (sección 2).",
      "Crear un cambio gobernado en Phoenix Security Control Center por cada política pendiente, referenciando el issue del Assessment que la origina.",
      "Configurar cada política primero en modo piloto (o \"solo informe\" cuando el producto lo permita) antes de aplicarla en producción.",
      "Excluir siempre las cuentas de emergencia (break-glass) del alcance de cualquier política de acceso.",
      "Registrar el resultado del piloto y adjuntar evidencia antes de avanzar a Aprobación y Producción.",
      "Una vez implementada, la política debe reflejarse como \"Implementado\" en el próximo Assessment — automáticamente si es de Entra ID y hay conexión a Microsoft Graph, o actualizando el relevamiento manual para el resto de los productos.",
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
    new Paragraph({
      spacing: { before: 400 },
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
          ...resumen,
          new Paragraph({ pageBreakBefore: true }),
          ...bloquesPoliticas,
          new Paragraph({ pageBreakBefore: true }),
          ...apendice,
          new Paragraph({ pageBreakBefore: true }),
          ...proximosPasos,
        ],
      },
    ],
  });

  return Packer.toBuffer(documento);
}
