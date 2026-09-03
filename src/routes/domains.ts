import { Router } from "express";
import { readOnlyGraphConfigured } from "../config";
import { dominiosVerificadosDemo, invitadosDemo, teamsInvitadosConfigDemo } from "../data/demoTenant";
import { listarUsuariosEfectivos } from "../services/directoryService";
import { obtenerDominiosReales, obtenerInvitadosReales } from "../graph/realDirectory";

export const domainsRouter = Router();

function manejarError(res: import("express").Response, error: unknown, codigo = 400): void {
  res.status(codigo).json({ error: error instanceof Error ? error.message : "Error desconocido." });
}

async function obtenerDominiosEInvitados(): Promise<{
  dominios: typeof dominiosVerificadosDemo;
  invitados: typeof invitadosDemo;
  fuente: "graph" | "demostracion";
}> {
  if (readOnlyGraphConfigured) {
    try {
      const [dominios, invitados] = await Promise.all([obtenerDominiosReales(), obtenerInvitadosReales()]);
      return { dominios, invitados, fuente: "graph" };
    } catch (error) {
      console.error("[phoenix-security] No se pudo leer dominios/invitados reales, se usa demostración:", error);
    }
  }
  return { dominios: dominiosVerificadosDemo, invitados: invitadosDemo, fuente: "demostracion" };
}

domainsRouter.get("/", async (_req, res) => {
  try {
    const [usuarios, { dominios, invitados, fuente }] = await Promise.all([listarUsuariosEfectivos(), obtenerDominiosEInvitados()]);
    res.json({
      fuente,
      dominios,
      dominioPredeterminado: dominios.find((d) => d.predeterminado)?.dominio,
      usuariosInternos: usuarios.length,
      usuariosInvitados: invitados.length,
      invitados,
      // La configuración de acceso de invitados en Teams requiere permisos de
      // administración de Teams no concedidos actualmente a la identidad de
      // solo lectura, por lo que esta sección siempre se muestra como demostración.
      accesoInvitadosTeams: teamsInvitadosConfigDemo,
      accesoInvitadosTeamsEsDemostracion: true,
    });
  } catch (error) {
    manejarError(res, error, 502);
  }
});

domainsRouter.post("/diagnostico", async (req, res) => {
  try {
    const { correo } = req.body as { correo: string };
    if (!correo) {
      res.status(400).json({ error: "Debe indicar un correo a diagnosticar." });
      return;
    }
    const q = correo.trim().toLowerCase();
    const [usuarios, { invitados }] = await Promise.all([listarUsuariosEfectivos(), obtenerDominiosEInvitados()]);
    const usuarioInterno = usuarios.find((u) => u.mail.toLowerCase() === q || u.userPrincipalName.toLowerCase() === q);
    const invitado = invitados.find((g) => g.mail.toLowerCase() === q);

    const pasos: { paso: string; resultado: string; ok: boolean }[] = [];

    pasos.push({
      paso: "1. Validar si el correo existe como usuario interno o invitado",
      resultado: usuarioInterno
        ? `Existe como usuario interno: ${usuarioInterno.displayName}.`
        : invitado
          ? `Existe como usuario invitado: ${invitado.displayName}.`
          : "No se encontró el correo como usuario interno ni invitado en el directorio.",
      ok: Boolean(usuarioInterno || invitado),
    });

    pasos.push({
      paso: "2. Revisar si la cuenta está habilitada",
      resultado: usuarioInterno
        ? usuarioInterno.accountEnabled
          ? "La cuenta está habilitada."
          : "La cuenta está deshabilitada: debe reactivarse mediante un cambio gobernado."
        : invitado
          ? invitado.accountEnabled
            ? "La cuenta de invitado está habilitada."
            : "La cuenta de invitado está deshabilitada."
          : "No aplica: la cuenta no existe.",
      ok: usuarioInterno?.accountEnabled ?? invitado?.accountEnabled ?? false,
    });

    pasos.push({
      paso: "3. Revisar licencia y Teams habilitado (usuarios internos)",
      resultado: usuarioInterno
        ? usuarioInterno.licencias.length > 0
          ? `Tiene licencia asignada (${usuarioInterno.licencias.join(", ")}), Teams incluido en Business Premium.`
          : "No tiene licencia asignada: sin licencia, Teams no estará disponible."
        : "No aplica para usuarios invitados (dependen del tenant de origen).",
      ok: usuarioInterno ? usuarioInterno.licencias.length > 0 : true,
    });

    pasos.push({
      paso: "4. Reenviar invitación si es usuario externo",
      resultado: invitado
        ? invitado.invitacionAceptada
          ? "La invitación ya fue aceptada."
          : "La invitación está pendiente: reenviar la invitación desde el Centro de administración de Microsoft 365."
        : "No aplica: no es un usuario invitado.",
      ok: invitado ? invitado.invitacionAceptada : true,
    });

    pasos.push({
      paso: "5. Revisar acceso de invitados de Teams",
      resultado: teamsInvitadosConfigDemo.permiteAccesoInvitados
        ? "El acceso de invitados a Teams está habilitado a nivel de tenant (dato de demostración: requiere permisos adicionales de Teams para leerlo en vivo)."
        : "El acceso de invitados a Teams está deshabilitado a nivel de tenant: debe habilitarse para que usuarios externos ingresen.",
      ok: teamsInvitadosConfigDemo.permiteAccesoInvitados,
    });

    pasos.push({
      paso: "6. Revisar registros de inicio de sesión y políticas de acceso condicional",
      resultado: "Revisar en Microsoft Entra ID > Registros de inicio de sesión si existen bloqueos por acceso condicional para este correo.",
      ok: true,
    });

    pasos.push({
      paso: "7. Verificar organización correcta en Teams",
      resultado: "Solicitar al usuario ingresar desde Teams Web en modo incógnito y seleccionar explícitamente la organización 'Phoenix Service'.",
      ok: true,
    });

    res.json({
      correo,
      encontrado: Boolean(usuarioInterno || invitado),
      tipo: usuarioInterno ? "interno" : invitado ? "invitado" : "no-encontrado",
      pasos,
    });
  } catch (error) {
    manejarError(res, error, 502);
  }
});
