import { api } from "../api.js";
import { badgeCriticidad, badgeModo, barra, esc } from "../ui.js";

export async function renderDashboard(app) {
  const [kpi, assessment, policies, changes] = await Promise.all([
    api.get("/dashboard/kpi"),
    api.get("/assessment"),
    api.get("/policies"),
    api.get("/changes"),
  ]);

  const hallazgosImplementados = assessment.hallazgos.filter((h) => h.estado === "Implementado").length;
  const politicasImplementadas = policies.politicas.filter((p) => p.estado === "Implementado").length;
  const cambiosConEvidencia = changes.cambios.filter((c) => c.evidencias.length > 0).length;

  app.innerHTML = `
    ${kpi.modoDemostracion ? `<div class="alert alert-warn">${badgeModo(true)} Indicadores calculados sobre datos de demostración.</div>` : ""}

    <div class="grid grid-4">
      <div class="card kpi-tile">
        <span class="kpi-label">Puntaje global</span>
        <span class="kpi-value">${kpi.puntajeGlobal}/100</span>
        <span class="kpi-delta">Punto de inflexión ${kpi.puntoInflexion} · Meta ${kpi.metaAnual}</span>
      </div>
      <div class="card kpi-tile">
        <span class="kpi-label">Cobertura de hallazgos</span>
        <span class="kpi-value">${hallazgosImplementados}/${assessment.total}</span>
        <span class="kpi-delta">Hallazgos totalmente implementados</span>
      </div>
      <div class="card kpi-tile">
        <span class="kpi-label">Cobertura de políticas</span>
        <span class="kpi-value">${politicasImplementadas}/${policies.total}</span>
        <span class="kpi-delta">Políticas del catálogo implementadas</span>
      </div>
      <div class="card kpi-tile">
        <span class="kpi-label">Cambios con evidencia</span>
        <span class="kpi-value">${cambiosConEvidencia}/${changes.total}</span>
        <span class="kpi-delta">Cambios gobernados con evidencia adjunta</span>
      </div>
    </div>

    <div class="section-title">Cobertura actual vs. meta por dominio</div>
    <div class="card">
      ${kpi.coberturaPorDominio
        .map(
          (c) => `<div class="progress-row">
            <span class="label">${esc(c.dominio)}</span>
            <div style="flex:1">${barra(c.actual, c.meta)}</div>
            <span class="value">${c.actual} / ${c.meta}</span>
          </div>`,
        )
        .join("")}
      <p class="section-sub" style="margin-top:12px">Brecha pendiente por dominio: ${kpi.coberturaPorDominio.map((c) => `${esc(c.dominio)} (${c.brecha} pts)`).join(" · ")}</p>
    </div>

    <div class="section-title">Proyección de mejora</div>
    <div class="grid grid-3">
      <div class="card kpi-tile"><span class="kpi-label">30 días</span><span class="kpi-value">${kpi.proyeccion.dia30}</span></div>
      <div class="card kpi-tile"><span class="kpi-label">60 días</span><span class="kpi-value">${kpi.proyeccion.dia60}</span></div>
      <div class="card kpi-tile"><span class="kpi-label">90 días</span><span class="kpi-value">${kpi.proyeccion.dia90}</span></div>
    </div>
    <p class="section-sub">Proyección demostrativa basada en el ritmo estimado de cierre de brechas; se recalculará con datos reales cuando exista conexión al tenant.</p>

    <div class="section-title">Ranking de acciones prioritarias</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Hallazgo</th><th>Dominio</th><th>Estado</th><th>Riesgo</th></tr></thead>
        <tbody>
          ${kpi.rankingAcciones
            .map(
              (h, i) => `<tr><td>${i + 1}</td><td><strong>${esc(h.nombre)}</strong></td><td>${esc(h.dominio)}</td><td>${esc(h.estado)}</td><td>${badgeCriticidad(h.criticidad)}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}
