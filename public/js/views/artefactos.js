import { api, descargar } from "../api.js";
import { esc } from "../ui.js";

const TIPOS = [
  ["politica-gobierno", "Política de gobierno de configuración"],
  ["procedimiento-operativo", "Procedimiento operativo"],
  ["evaluacion-riesgo", "Evaluación de riesgo e impacto"],
  ["plan-pruebas-piloto", "Plan de pruebas piloto"],
  ["registro-cambio-reversion", "Registro de cambio y reversión"],
  ["informe-implementacion", "Informe de implementación"],
  ["plan-mejora-continua", "Plan de mejora continua"],
  ["inventario-configuraciones", "Inventario de configuraciones (del cambio)"],
];

export async function renderArtefactos(app) {
  const { cambios } = await api.get("/changes");
  app.innerHTML = `
    <div class="card">
      <h3>Inventario general de configuraciones</h3>
      <p class="section-sub">Exporta el estado completo del catálogo de políticas de Phoenix Service.</p>
      <button class="btn-accent" id="btn-inventario">Descargar inventario general</button>
    </div>

    <div class="section-title">Artefactos por cambio gobernado</div>
    <div class="toolbar">
      <select id="sel-cambio">
        <option value="">Seleccione un cambio…</option>
        ${cambios.map((c) => `<option value="${c.id}">${esc(c.id)} — ${esc(c.configuracionONombrePolitica)}</option>`).join("")}
      </select>
    </div>
    <div class="grid grid-4" id="grid-artefactos"></div>

    <div class="section-title">Cadencias de revisión obligatorias</div>
    <div class="grid grid-3">
      <div class="card"><h3>Mensual</h3><p class="section-sub" style="margin:0">Revisión de alertas, excepciones, controles fallidos y cambios pendientes.</p></div>
      <div class="card"><h3>Trimestral</h3><p class="section-sub" style="margin:0">Revisión de riesgos, permisos, licencias, responsables y pruebas de reversión.</p></div>
      <div class="card"><h3>Anual</h3><p class="section-sub" style="margin:0">Actualización de políticas, procedimientos, inventario y plan de mejora continua.</p></div>
    </div>
  `;

  app.querySelector("#btn-inventario").addEventListener("click", () => descargar("/artifacts/inventario"));

  const pintarGrid = (cambioId) => {
    const grid = app.querySelector("#grid-artefactos");
    if (!cambioId) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Seleccione un cambio para generar sus artefactos.</div>`;
      return;
    }
    grid.innerHTML = TIPOS.map(
      ([tipo, nombre]) => `<div class="card">
        <h3 style="font-size:14px">${nombre}</h3>
        <button class="btn-ghost btn-sm" data-tipo="${tipo}">Descargar</button>
      </div>`,
    ).join("");
    grid.querySelectorAll("[data-tipo]").forEach((btn) => btn.addEventListener("click", () => descargar(`/artifacts/${btn.dataset.tipo}/${cambioId}`)));
  };

  app.querySelector("#sel-cambio").addEventListener("change", (ev) => pintarGrid(ev.target.value));
  pintarGrid("");
}
