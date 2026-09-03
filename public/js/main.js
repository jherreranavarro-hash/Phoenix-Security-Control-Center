import { api } from "./api.js";
import { badgeModo } from "./ui.js";
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

document.getElementById("burger").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("abierto");
});

window.addEventListener("hashchange", enrutar);
cargarEncabezado();
enrutar();
