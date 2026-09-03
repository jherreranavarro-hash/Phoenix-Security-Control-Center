import { api } from "../api.js";
import { esc } from "../ui.js";

export async function renderIntegraciones(app) {
  const data = await api.get("/domains");
  app.innerHTML = `
    <div class="grid grid-3">
      <div class="card kpi-tile"><span class="kpi-label">Dominio predeterminado</span><span class="kpi-value" style="font-size:18px">${esc(data.dominioPredeterminado)}</span></div>
      <div class="card kpi-tile"><span class="kpi-label">Usuarios internos</span><span class="kpi-value">${data.usuariosInternos}</span></div>
      <div class="card kpi-tile"><span class="kpi-label">Usuarios invitados</span><span class="kpi-value">${data.usuariosInvitados}</span></div>
    </div>

    <div class="section-title">Dominios verificados</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Dominio</th><th>Predeterminado</th><th>Verificado</th></tr></thead>
      <tbody>${data.dominios.map((d) => `<tr><td>${esc(d.dominio)}</td><td>${d.predeterminado ? "✅" : "—"}</td><td>${d.verificado ? "✅ Verificado" : "⚠️ Pendiente"}</td></tr>`).join("")}</tbody>
    </table></div>

    <div class="section-title">Usuarios invitados</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Nombre</th><th>Correo</th><th>Estado</th><th>Invitación</th></tr></thead>
      <tbody>${data.invitados.map((i) => `<tr><td>${esc(i.displayName)}</td><td>${esc(i.mail)}</td><td>${i.accountEnabled ? "Habilitado" : "Deshabilitado"}</td><td>${i.invitacionAceptada ? "Aceptada" : "Pendiente"}</td></tr>`).join("")}</tbody>
    </table></div>

    <div class="section-title">Acceso de invitados en Microsoft Teams</div>
    <div class="card">
      <p>Acceso de invitados: <strong>${data.accesoInvitadosTeams.permiteAccesoInvitados ? "Habilitado" : "Deshabilitado"}</strong></p>
      <p>Llamadas de invitados: <strong>${data.accesoInvitadosTeams.permiteLlamadasInvitados ? "Habilitado" : "Deshabilitado"}</strong></p>
      <p>Reuniones con invitados: <strong>${data.accesoInvitadosTeams.permiteReunionesInvitados ? "Habilitado" : "Deshabilitado"}</strong></p>
    </div>

    <div class="section-title">Diagnóstico de acceso ("No tiene los permisos requeridos para acceder a esta organización")</div>
    <div class="card">
      <div class="field"><label>Correo a diagnosticar</label><input id="diag-correo" placeholder="usuario@dominio.com" /></div>
      <button class="btn-primary" id="diag-ejecutar">Ejecutar diagnóstico</button>
      <div id="diag-resultado" style="margin-top:16px"></div>
    </div>
  `;

  app.querySelector("#diag-ejecutar").addEventListener("click", async () => {
    const correo = app.querySelector("#diag-correo").value.trim();
    if (!correo) return;
    const resultado = await api.post("/domains/diagnostico", { correo });
    app.querySelector("#diag-resultado").innerHTML = `
      <p class="section-sub">Tipo detectado: <strong>${esc(resultado.tipo)}</strong></p>
      <ol class="steps">
        ${resultado.pasos.map((p) => `<li class="${p.ok ? "ok" : "fail"}"><strong>${esc(p.paso)}</strong><div class="section-sub" style="margin:2px 0 0">${esc(p.resultado)}</div></li>`).join("")}
      </ol>
    `;
  });
}
