import { api } from "../api.js";
import { badgeCriticidad, badgeModo, esc, fechaHora } from "../ui.js";

export async function renderResumen(app) {
  const d = await api.get("/dashboard/resumen");

  app.innerHTML = `
    <div class="grid grid-4">
      <div class="card kpi-tile">
        <span class="kpi-label">Puntaje global de postura</span>
        <span class="kpi-value">${d.puntajeGlobal}<span style="font-size:16px;color:var(--color-ink-faint)">/100</span></span>
        <span class="kpi-delta">Punto de inflexión: ${d.puntoInflexion} · Meta anual: ${d.metaAnual}</span>
      </div>
      <div class="card kpi-tile">
        <span class="kpi-label">Brechas críticas</span>
        <span class="kpi-value" style="color:var(--color-danger)">${d.brechas.criticas}</span>
        <span class="kpi-delta">Altas: ${d.brechas.altas} · Medias: ${d.brechas.medias} · Bajas: ${d.brechas.bajas}</span>
      </div>
      <div class="card kpi-tile">
        <span class="kpi-label">Controles implementados</span>
        <span class="kpi-value" style="color:var(--color-success)">${d.brechas.implementados}</span>
        <span class="kpi-delta">Sobre el total de hallazgos evaluados</span>
      </div>
      <div class="card kpi-tile">
        <span class="kpi-label">Cambios pendientes de aprobación</span>
        <span class="kpi-value" style="color:var(--color-warning)">${d.cambiosPendientesAprobacion}</span>
        <span class="kpi-delta"><a href="#/gobierno">Ver en Gobierno →</a></span>
      </div>
    </div>

    ${
      d.modoDemostracion
        ? `<div class="alert alert-warn" style="margin-top:16px">${badgeModo(true)} Estos indicadores se calculan sobre datos de demostración del tenant de Phoenix Service. Cuando exista conexión a Microsoft Graph, se calcularán en tiempo real.</div>`
        : ""
    }

    <div class="section-title">Accesos directos</div>
    <div class="grid grid-4">
      <a class="card" href="#/assessment" style="text-decoration:none;color:inherit"><h3>🔍 Assessment</h3><p class="section-sub" style="margin:0">Radiografía completa del tenant</p></a>
      <a class="card" href="#/politicas" style="text-decoration:none;color:inherit"><h3>📋 Políticas</h3><p class="section-sub" style="margin:0">Catálogo de políticas por producto</p></a>
      <a class="card" href="#/gobierno" style="text-decoration:none;color:inherit"><h3>🛡️ Gobierno</h3><p class="section-sub" style="margin:0">Cambios y aprobaciones</p></a>
      <a class="card" href="#/despliegue" style="text-decoration:none;color:inherit"><h3>🚀 Despliegue</h3><p class="section-sub" style="margin:0">Control de impacto y alcance</p></a>
    </div>

    <div class="grid grid-2" style="margin-top:28px;align-items:start">
      <div>
        <div class="section-title">Plan de mejora recomendado</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Hallazgo</th><th>Dominio</th><th>Riesgo</th><th>Próxima acción</th></tr></thead>
            <tbody>
              ${d.planMejoraRecomendado
                .map(
                  (h) => `<tr>
                    <td><strong>${esc(h.nombre)}</strong></td>
                    <td>${esc(h.dominio)}</td>
                    <td>${badgeCriticidad(h.criticidad)}</td>
                    <td>${esc(h.proximaAccion)}</td>
                  </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <div class="section-title">Avance mensual (demostrativo)</div>
        <div class="card">
          <div style="display:flex;align-items:flex-end;gap:10px;height:140px">
            ${d.indicadoresAvanceMensual
              .map(
                (m) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px">
                  <div style="width:100%;background:var(--color-accent);border-radius:6px 6px 0 0;height:${Math.max(4, m.puntaje)}px"></div>
                  <span style="font-size:11px;color:var(--color-ink-faint)">${esc(m.mes)}</span>
                </div>`,
              )
              .join("")}
          </div>
        </div>
      </div>

      <div>
        <div class="section-title">Actividad y bitácora reciente</div>
        <div class="card">
          ${
            d.actividadReciente.length === 0
              ? `<div class="empty-state">Aún no hay actividad registrada.</div>`
              : `<ul class="timeline">
                  ${d.actividadReciente
                    .map(
                      (a) => `<li>
                        <span class="t-actor">${esc(a.actor)}</span> — ${esc(a.accion)}
                        <div class="t-fecha">${fechaHora(a.fecha)} · ${esc(a.entidad)}${a.entidadId ? " #" + esc(a.entidadId) : ""} · ${esc(a.resultado)}</div>
                      </li>`,
                    )
                    .join("")}
                </ul>`
          }
        </div>
      </div>
    </div>
  `;
}
