import { Document, Packer, Paragraph, Table, TextRun } from "docx";
import { almacen } from "../lib/store";
import {
  listarGruposEfectivos,
  listarSkusEfectivos,
  listarUsuariosEfectivos,
} from "./directoryService";
import { previsualizarCampaña } from "./licenseCampaignService";
import {
  COLOR_TEXTO_SUAVE,
  PAGINA_APAISADA,
  construirPortada,
  parrafo,
  subtitulo,
  tabla,
  tituloSeccion,
} from "./docxHelpers";

/**
 * Informes formales en Word para cada sección del módulo Usuarios
 * (Usuarios, Grupos, Licencias, Exchange, Campaña Business Premium),
 * descargables de forma independiente. Cada uno usa los mismos datos
 * "efectivos" que ya muestra la interfaz (reales del tenant vía Microsoft
 * Graph cuando hay conexión, o de demostración si no).
 */

function fechaEmision(): string {
  return new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
}

function documentoApaisado(portada: Paragraph[], cuerpo: (Paragraph | Table)[]): Document {
  return new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
    sections: [{ properties: { page: PAGINA_APAISADA }, children: [...portada, ...cuerpo] }],
  });
}

function introduccion(texto: string): Paragraph {
  return new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text: texto, size: 20, color: COLOR_TEXTO_SUAVE })],
  });
}

// ---------------- USUARIOS ----------------
export async function generarInformeUsuarios(): Promise<Buffer> {
  const fecha = fechaEmision();
  const usuarios = await listarUsuariosEfectivos();
  const activos = usuarios.filter((u) => u.accountEnabled).length;
  const conLicencia = usuarios.filter((u) => u.licencias.length > 0).length;
  const conRoles = usuarios.filter((u) => u.roles.length > 0).length;
  const conMfa = usuarios.filter((u) => u.mfaRegistrado).length;

  const portada = construirPortada("Informe de Usuarios", fecha);
  const cuerpo: (Paragraph | Table)[] = [
    tituloSeccion("Resumen"),
    tabla(
      ["Indicador", "Valor"],
      [
        ["Total de usuarios", `${usuarios.length}`],
        ["Activos", `${activos}`],
        ["Bloqueados", `${usuarios.length - activos}`],
        ["Con al menos una licencia", `${conLicencia}`],
        ["Sin licencia", `${usuarios.length - conLicencia}`],
        ["Con roles administrativos", `${conRoles}`],
        ["Con MFA registrado", `${conMfa}`],
      ],
      [4500, 4500],
    ),
    subtitulo("Detalle de usuarios"),
    tabla(
      ["Nombre", "Correo", "Área", "Roles", "Licencias", "MFA", "Estado"],
      usuarios.map((u) => [
        u.displayName,
        u.userPrincipalName,
        u.area || "—",
        u.roles.join(", ") || "—",
        u.licencias.join(", ") || "Sin licencia",
        u.mfaRegistrado ? "Sí" : "No",
        u.accountEnabled ? "Activo" : "Bloqueado",
      ]),
      [2200, 2600, 1800, 1800, 2200, 900, 1200],
    ),
  ];

  return Packer.toBuffer(documentoApaisado(portada, cuerpo));
}

// ---------------- GRUPOS ----------------
export async function generarInformeGrupos(): Promise<Buffer> {
  const fecha = fechaEmision();
  const grupos = await listarGruposEfectivos();
  const emergencia = grupos.filter((g) => g.esGrupoEmergencia).length;

  const portada = construirPortada("Informe de Grupos", fecha);
  const cuerpo: (Paragraph | Table)[] = [
    tituloSeccion("Resumen"),
    tabla(
      ["Indicador", "Valor"],
      [
        ["Total de grupos", `${grupos.length}`],
        ["Grupos de emergencia (break-glass)", `${emergencia}`],
        ["Grupos de seguridad", `${grupos.filter((g) => g.tipo === "Seguridad").length}`],
        ["Grupos Microsoft 365", `${grupos.filter((g) => g.tipo === "Microsoft365").length}`],
      ],
      [4500, 4500],
    ),
    subtitulo("Detalle de grupos"),
    tabla(
      ["Nombre", "Clasificación", "Tipo", "Propósito", "Miembros"],
      grupos.map((g) => [
        g.nombre + (g.esGrupoEmergencia ? " (emergencia)" : ""),
        (g.clasificacion as string[]).join(", "),
        g.tipo,
        g.proposito,
        `${g.miembros.length}`,
      ]),
      [3400, 2400, 2000, 2000, 1500],
    ),
  ];

  return Packer.toBuffer(documentoApaisado(portada, cuerpo));
}

// ---------------- LICENCIAS ----------------
export async function generarInformeLicencias(): Promise<Buffer> {
  const fecha = fechaEmision();
  const skus = await listarSkusEfectivos();
  const totalSeats = skus.reduce((acc, s) => acc + s.total, 0);
  const totalAsignadas = skus.reduce((acc, s) => acc + s.asignadas, 0);

  const portada = construirPortada("Informe de Licencias", fecha);
  const cuerpo: (Paragraph | Table)[] = [
    tituloSeccion("Resumen"),
    tabla(
      ["Indicador", "Valor"],
      [
        ["SKU distintos", `${skus.length}`],
        ["Asientos totales", `${totalSeats}`],
        ["Asientos asignados", `${totalAsignadas}`],
        ["Asientos disponibles", `${Math.max(0, totalSeats - totalAsignadas)}`],
      ],
      [4500, 4500],
    ),
    subtitulo("Detalle por SKU"),
    tabla(
      ["Producto", "SKU", "Total", "Asignadas", "Disponibles", "Utilización"],
      skus.map((s) => [
        s.nombreComercial,
        s.skuPartNumber,
        `${s.total}`,
        `${s.asignadas}`,
        `${s.disponibles}`,
        s.total > 0 ? `${Math.round((s.asignadas / s.total) * 100)}%` : "—",
      ]),
      [3200, 2600, 1600, 1800, 1800, 1600],
    ),
  ];

  return Packer.toBuffer(documentoApaisado(portada, cuerpo));
}

// ---------------- EXCHANGE ----------------
export async function generarInformeExchange(): Promise<Buffer> {
  const fecha = fechaEmision();
  const usuarios = await listarUsuariosEfectivos();
  const conReenvio = usuarios.filter((u) => u.buzon.reenvio).length;
  const conRespuestaAuto = usuarios.filter((u) => u.buzon.respuestaAutomatica).length;
  const conDelegados = usuarios.filter((u) => u.buzon.delegados.length > 0).length;
  const compartidos = usuarios.filter((u) => u.buzon.esCompartido).length;

  const portada = construirPortada("Informe de Exchange", fecha);
  const cuerpo: (Paragraph | Table)[] = [
    tituloSeccion("Resumen"),
    tabla(
      ["Indicador", "Valor"],
      [
        ["Buzones totales", `${usuarios.length}`],
        ["Con reenvío configurado", `${conReenvio}`],
        ["Con respuesta automática activa", `${conRespuestaAuto}`],
        ["Con delegados", `${conDelegados}`],
        ["Buzones compartidos", `${compartidos}`],
      ],
      [4500, 4500],
    ),
    subtitulo("Detalle de buzones"),
    tabla(
      ["Nombre", "Correo", "Alias", "Reenvío", "Respuesta automática", "Delegados", "Compartido"],
      usuarios.map((u) => [
        u.displayName,
        u.userPrincipalName,
        u.buzon.alias.join(", ") || "—",
        u.buzon.reenvio || "—",
        u.buzon.respuestaAutomatica ? "Activa" : "Inactiva",
        u.buzon.delegados.join(", ") || "—",
        u.buzon.esCompartido ? "Sí" : "No",
      ]),
      [2000, 2400, 1800, 1800, 1800, 1800, 1200],
    ),
  ];

  return Packer.toBuffer(documentoApaisado(portada, cuerpo));
}

// ---------------- CAMPAÑA BUSINESS PREMIUM ----------------
export async function generarInformeCampaniaBusinessPremium(): Promise<Buffer> {
  const fecha = fechaEmision();
  const vista = await previsualizarCampaña();
  const historial = almacen.listarCampañas() as unknown as {
    id: string;
    fecha: string;
    aprobador: string;
    fuente: string;
    totalElegibles: number;
    exitosos: number;
    fallidos: number;
  }[];

  const portada = construirPortada("Informe de Campaña Business Premium", fecha);
  const cuerpo: (Paragraph | Table)[] = [
    tituloSeccion("Resumen de la campaña"),
    introduccion(
      "Migración masiva de licencias Microsoft 365 Empresa Estándar → Microsoft 365 Empresa Premium. Este informe refleja la última revisión generada y el historial de ejecuciones registradas en Phoenix Security Control Center.",
    ),
    tabla(
      ["Indicador", "Valor"],
      [
        ["Fuente de datos", vista.fuente === "graph" ? "Microsoft Graph (tenant real)" : "Catálogo de demostración"],
        ["SKU origen", vista.skuOrigen?.nombreComercial ?? "No identificado"],
        ["SKU destino", vista.skuDestino?.nombreComercial ?? "No identificado"],
        ["Licencias Premium disponibles", `${vista.disponibles}`],
        ["Cuentas elegibles", `${vista.elegibles.length}`],
        ["Stock suficiente", vista.suficientes ? "Sí" : "No"],
        ["Revisión generada", new Date(vista.generadoEn).toLocaleString("es-CL")],
      ],
      [4500, 4500],
    ),
    subtitulo("Personas afectadas en la próxima ejecución"),
    tabla(
      ["Nombre", "Correo"],
      vista.elegibles.map((u) => [u.displayName, u.userPrincipalName]),
      [4500, 4500],
    ),
    subtitulo("Historial de ejecuciones"),
    historial.length
      ? tabla(
          ["Fecha", "Aprobador", "Fuente", "Elegibles", "Exitosos", "Fallidos"],
          historial.map((c) => [
            new Date(c.fecha).toLocaleString("es-CL"),
            c.aprobador,
            c.fuente,
            `${c.totalElegibles}`,
            `${c.exitosos}`,
            `${c.fallidos}`,
          ]),
          [2200, 2600, 1600, 1200, 1200, 1200],
        )
      : parrafo("Historial", "Sin ejecuciones registradas todavía."),
  ];

  return Packer.toBuffer(documentoApaisado(portada, cuerpo));
}
