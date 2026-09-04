import { api } from "./api.js";
import { abrirModal, badgeModo, cerrarModal, toast } from "./ui.js";
import { renderResumen } from "./views/resumen.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderAssessment } from "./views/assessment.js";
import { renderUsuarios } from "./views/usuarios.js";
import { renderGobierno } from "./views/gobierno.js";
import { renderArtefactos } from "./views/artefactos.js";
import { renderPoliticas } from "./views/politicas.js";
import { renderDespliegue } from "./views/despliegue.js";
import { renderIntegraciones } from "./views/integraciones.js";

const TITULOS = {
  resumen: "Resumen ejecutivo",
  dashboard: "Dashboard de mejoras y KPI",
  assessment: "Assessment del tenant",
  usuarios: "Usuarios, roles, grupos, licencias y Exchange",
  gobierno: "Gobierno de configuraciones y cambios",
  artefactos: "Artefactos, informes y mejora continua",
  politicas: "Catálogo de políticas",
  despliegue: "Despliegue y control de impacto",
  integraciones: "Dominios, invitados e integraciones",
};

const VISTAS = {
  resumen: renderResumen,
  dashboard: renderDashboard,
  assessment: renderAssessment,
  usuarios: renderUsuarios,
  gobierno: renderGobierno,
  artefactos: renderArtefactos,
  politicas: renderPoliticas,
  despliegue: renderDespliegue,
  integraciones: renderIntegraciones,
};

const app = document.getElementById("app");
const topbarTitle = document.getElementById("topbar-title");

async function enrutar() {
  const hash = (window.location.hash || "#/resumen").replace(/^#\//, "");
  const [ruta, queryString] = hash.split("?");
  const params = new URLSearchParams(queryString || "");
  const vista = VISTAS[ruta] || renderResumen;
  const clave = VISTAS[ruta] ? ruta : "resumen";

  document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("activo", a.dataset.ruta === clave));
  topbarTitle.textContent = TITULOS[clave];
  document.getElementById("sidebar").classList.remove("abierto");

  app.innerHTML = `<div class="empty-state">Cargando…</div>`;
  try {
    await vista(app, params);
  } catch (error) {
    console.error(error);
    app.innerHTML = `<div class="alert alert-danger">No fue posible cargar esta sección: ${error.message}</div>`;
  }
}

async function cargarEncabezado() {
  try {
    const salud = await api.get("/health");
    document.getElementById("modo-indicador").outerHTML = badgeModo(salud.modoDemostracion).replace(
      "badge",
      'id="modo-indicador" badge',
    );
    document.getElementById("topbar-user").textContent = salud.usuario
      ? `${salud.usuario.nombre} (${salud.usuario.upn})`
      : "Sesión no identificada";
  } catch (error) {
    console.error("No fue posible cargar el estado del servidor", error);
  }
}

async function cargarEstadoEscrituras() {
  const indicador = document.getElementById("escrituras-indicador");
  const boton = document.getElementById("btn-conectar-escrituras");
  try {
    const estado = await api.get("/system/estado");

    if (!estado.produccionConfigurada) {
      indicador.hidden = false;
      indicador.className = "badge badge-demo escrituras-badge";
      indicador.textContent = "○ Sin identidad de producción configurada";
      indicador.title = "Configura PHX_PROD_CLIENT_ID/SECRET en el servidor para poder conectar escrituras reales.";
      boton.hidden = true;
      return estado;
    }

    indicador.hidden = false;
    indicador.title = "";
    indicador.className = `badge escrituras-badge ${estado.escriturasHabilitadas ? "badge-sync" : "badge-demo"}`;
    indicador.textContent = estado.escriturasHabilitadas
      ? "● Producción CONECTADA (escrituras activas)"
      : "○ Producción desconectada (solo lectura)";

    boton.hidden = false;
    boton.textContent = estado.escriturasHabilitadas ? "Desconectar producción" : "Conectar producción";
    boton.className = estado.escriturasHabilitadas ? "btn btn-sm btn-danger btn-conectar" : "btn btn-sm btn-accent btn-conectar";
    boton.onclick = () => confirmarCambioEscrituras(estado.escriturasHabilitadas);
    return estado;
  } catch (error) {
    console.error("No fue posible cargar el estado de escrituras", error);
    return null;
  }
}

function confirmarCambioEscrituras(actualmenteConectado) {
  const accion = actualmenteConectado ? "desconectar" : "conectar";
  const titulo = actualmenteConectado ? "Desconectar producción" : "Conectar producción";
  const cuerpo = actualmenteConectado
    ? "A partir de ahora ninguna acción de esta plataforma escribirá cambios reales en el tenant Phoenix Service, hasta que vuelvas a conectar."
    : "Mientras esté conectado, las acciones que ejecutes en esta plataforma (crear usuarios, crear grupos, membresías, licencias, etc.) escribirán cambios REALES en el tenant Phoenix Service. Desconecta cuando termines para evitar cambios accidentales.";

  abrirModal(
    `
    <h3>${titulo}</h3>
    <p>${cuerpo}</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="btn-cancelar-escrituras">Cancelar</button>
      <button class="btn ${actualmenteConectado ? "btn-danger" : "btn-accent"}" id="btn-confirmar-escrituras">
        ${actualmenteConectado ? "Sí, desconectar" : "Sí, conectar"}
      </button>
    </div>
    `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancelar-escrituras").addEventListener("click", cerrarModal);
        root.querySelector("#btn-confirmar-escrituras").addEventListener("click", async () => {
          try {
            const ruta = actualmenteConectado ? "/system/desconectar" : "/system/conectar";
            const resultado = await api.post(ruta);
            cerrarModal();
            toast(
              resultado.escriturasHabilitadas
                ? "Producción conectada: las escrituras reales están activas."
                : "Producción desconectada: solo lectura.",
              "success",
            );
            await cargarEstadoEscrituras();
          } catch (error) {
            toast(error.message, "error");
          }
        });
      },
    },
  );
}

document.getElementById("burger").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("abierto");
});

window.addEventListener("hashchange", enrutar);
cargarEncabezado();
cargarEstadoEscrituras();
enrutar();
