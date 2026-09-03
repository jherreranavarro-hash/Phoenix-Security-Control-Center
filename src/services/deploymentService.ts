import { listarGruposEfectivos, listarUsuariosEfectivos } from "./directoryService";
import type { AlcanceDespliegue } from "../types";

/**
 * Módulo 6 — Despliegue y control de impacto.
 * Calcula, a partir de un alcance (grupos incluidos/excluidos + usuarios
 * individuales), cuántas personas y equipos quedan realmente afectados,
 * garantizando que las cuentas de emergencia queden siempre excluidas.
 */
export async function calcularAfectadosPorAlcance(
  alcance: Pick<AlcanceDespliegue, "gruposIncluidos" | "usuariosIndividuales" | "gruposExcluidos">,
): Promise<{
  totalUsuarios: number;
  totalEquipos: number;
  usuariosAfectados: { id: string; displayName: string; area: string }[];
}> {
  const [usuarios, grupos] = await Promise.all([listarUsuariosEfectivos(), listarGruposEfectivos()]);

  const idsExcluidos = new Set<string>();
  alcance.gruposExcluidos.forEach((grupoId) => {
    const grupo = grupos.find((g) => g.id === grupoId || g.nombre === grupoId);
    grupo?.miembros.forEach((m) => idsExcluidos.add(m));
  });
  // Las cuentas marcadas como emergencia siempre quedan excluidas, sin importar el alcance configurado.
  usuarios.filter((u) => u.esCuentaEmergencia).forEach((u) => idsExcluidos.add(u.id));

  const idsIncluidos = new Set<string>();
  alcance.gruposIncluidos.forEach((grupoId) => {
    const grupo = grupos.find((g) => g.id === grupoId || g.nombre === grupoId);
    grupo?.miembros.forEach((m) => idsIncluidos.add(m));
  });
  alcance.usuariosIndividuales.forEach((id) => idsIncluidos.add(id));

  const afectados = usuarios.filter((u) => idsIncluidos.has(u.id) && !idsExcluidos.has(u.id));

  return {
    totalUsuarios: afectados.length,
    totalEquipos: afectados.length, // Aproximación 1:1 usuario-equipo en el entorno de demostración.
    usuariosAfectados: afectados.map((u) => ({ id: u.id, displayName: u.displayName, area: u.area })),
  };
}
