import { api } from "../api.js";
import { esc, toast } from "../ui.js";

let estadoAlcance = null;
let candidatos = { usuarios: [], grupos: [] };
let esRevisorAutorizado = false;
let cambioActual = null;

export async function renderDespliegue(app, params) {
  const [salud, cambiosResp] = await Promise.all([api.get("/health"), api.get("/changes")]);
  esRevisorAutorizado = (salud.usuario?.roles || []).some((r) => ["GobiernoTI", "Aprobador"].includes(r));
  const cambios = cambiosResp.cambios.filter((c) => !["Cerrado", "Rechazado"].includes(c.estado));
  const preseleccion = params.get("cambio");

  app.innerHTML = `
    <div class="toolbar">
      <label style="margin:0">Cambio gobernado:</label>
      <select id="sel-cambio" style="min-width:340px">
        <option value="">Seleccione un cambio…</option>
        ${cambios.map((c) => `<option value="${c.id}" ${c.id === preseleccion ? "selected" : ""}>${esc(c.id)} — ${esc(c.configuracionONombrePolitica)}</option>`).join("")}
      </select>
    </div>
    <div id="contenedor-alcance"></div>
  `;

  const selector = app.querySelector("#sel-cambio");
  selector.addEventListener("change", () => cargarCambio(app, selector.value));
  if (preseleccion) await cargarCambio(app, preseleccion);
}

async function cargarCambio(app, cambioId) {
  const contenedor = app.querySelector("#contenedor-alcance");
  if (!cambioId) {
    contenedor.innerHTML = "";
    return;
  }
  const [{ cambio }, cand] = await Promise.all([api.get(`/changes/${cambioId}`), api.get("/deployment/candidatos")]);
  cambioActual = cambio;
  candidatos = cand;
  estadoAlcance = {
    gruposIncluidos: new Set(cambio.alcance.gruposIncluidos),
    usuariosIndividuales: new Set(cambio.alcance.usuariosIndividuales),
    gruposExcluidos: new Set(cambio.alcance.gruposExcluidos),
  };

  contenedor.innerHTML = `
    <div class="alert alert-info">No se podrá aprobar ni ejecutar este cambio sin confirmar personas afectadas, grupos, exclusiones, ventana y plan de reversión en el módulo Gobierno.</div>

    <div class="grid grid-2" style="align-items:start">
      <div class="card">
        <h3>Grupos de Entra ID (alcance)</h3>
        <div style="max-height:260px;overflow:auto">
          ${candidatos.grupos
            .map(
              (g) => `<label style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--color-border)">
                <input type="checkbox" class="chk-grupo-incluir" data-id="${g.id}" ${estadoAlcance.gruposIncluidos.has(g.id) ? "checked" : ""} ${g.esGrupoEmergencia ? "disabled" : ""} />
                <span style="flex:1">${esc(g.nombre)} <span class="pill">${g.totalMiembros} miembros</span> ${g.esGrupoEmergencia ? '<span class="badge badge-critica">Emergencia — excluido siempre</span>' : ""}</span>
              </label>`,
            )
            .join("")}
        </div>
        <h4 style="margin-top:14px">Grupos excluidos explícitamente</h4>
        <div style="max-height:160px;overflow:auto">
          ${candidatos.grupos
            .map(
              (g) => `<label style="display:flex;gap:8px;align-items:center;padding:4px 0">
                <input type="checkbox" class="chk-grupo-excluir" data-id="${g.id}" ${estadoAlcance.gruposExcluidos.has(g.id) || g.esGrupoEmergencia ? "checked" : ""} ${g.esGrupoEmergencia ? "disabled" : ""} />
                <span>${esc(g.nombre)}</span>
              </label>`,
            )
            .join("")}
        </div>
      </div>

      <div class="card">
        <div class="card-title-row">
          <h3>Usuarios individuales</h3>
          <div>
            <button class="btn-ghost btn-sm" id="btn-todos">Seleccionar todos</button>
            <button class="btn-ghost btn-sm" id="btn-limpiar">Limpiar selección</button>
          </div>
        </div>
        <input id="buscar-usuario" placeholder="Buscar por nombre, correo o área…" style="width:100%;margin-bottom:10px" />
        <div style="max-height:300px;overflow:auto" id="lista-usuarios"></div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:16px">
      <div class="card">
        <h3>Ventana de cambio</h3>
        <div class="field-row">
          <div class="field"><label>Piloto — inicio</label><input type="datetime-local" id="v-piloto-inicio" value="${aInputDatetime(cambio.alcance.ventanaPilotoInicio)}" /></div>
          <div class="field"><label>Piloto — fin</label><input type="datetime-local" id="v-piloto-fin" value="${aInputDatetime(cambio.alcance.ventanaPilotoFin)}" /></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Producción — inicio</label><input type="datetime-local" id="v-prod-inicio" value="${aInputDatetime(cambio.alcance.ventanaProduccionInicio)}" /></div>
          <div class="field"><label>Producción — fin</label><input type="datetime-local" id="v-prod-fin" value="${aInputDatetime(cambio.alcance.ventanaProduccionFin)}" /></div>
        </div>
      </div>
      <div class="card">
        <h3>Validaciones previas</h3>
        <textarea id="v-validaciones" rows="4" placeholder="Una validación por línea">${cambio.alcance.validacionesPrevias.join("\n")}</textarea>
      </div>
    </div>

    <div class="card" style="margin-top:16px" id="panel-impacto">
      <div class="card-title-row">
        <h3>Impacto calculado</h3>
        <button class="btn-primary btn-sm" id="btn-calcular">Calcular impacto</button>
      </div>
      <p id="resumen-impacto" class="section-sub">Presione "Calcular impacto" para ver personas y equipos afectados.</p>
      <div id="detalle-impacto"></div>
      ${!esRevisorAutorizado ? '<p class="alert alert-warn">El detalle individual de personas afectadas solo se muestra a revisores autorizados (roles GobiernoTI / Aprobador).</p>' : ""}
    </div>

    <div style="margin-top:16px;display:flex;gap:10px">
      <button class="btn-accent" id="btn-guardar-alcance">Guardar alcance final como evidencia</button>
    </div>
  `;

  renderListaUsuarios(contenedor);
  cablearContenedor(app, contenedor, cambio);
}

function aInputDatetime(iso) {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function renderListaUsuarios(contenedor, filtro = "") {
  const q = filtro.toLowerCase();
  const lista = candidatos.usuarios.filter(
    (u) => !q || u.displayName.toLowerCase().includes(q) || u.userPrincipalName.toLowerCase().includes(q) || u.area.toLowerCase().includes(q),
  );
  contenedor.querySelector("#lista-usuarios").innerHTML = lista
    .map(
      (u) => `<label style="display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid var(--color-border)">
        <input type="checkbox" class="chk-usuario" data-id="${u.id}" ${estadoAlcance.usuariosIndividuales.has(u.id) ? "checked" : ""} ${u.esCuentaEmergencia ? "disabled" : ""} />
        <span style="flex:1">${esc(u.displayName)} <span class="pill">${esc(u.area)}</span> ${u.esCuentaEmergencia ? '<span class="badge badge-critica">Emergencia</span>' : ""}</span>
      </label>`,
    )
    .join("");
}

function leerAlcanceDraft(contenedor) {
  const validaciones = contenedor
    .querySelector("#v-validaciones")
    .value.split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
  return {
    gruposIncluidos: Array.from(estadoAlcance.gruposIncluidos),
    usuariosIndividuales: Array.from(estadoAlcance.usuariosIndividuales),
    gruposExcluidos: Array.from(estadoAlcance.gruposExcluidos),
    ventanaPilotoInicio: contenedor.querySelector("#v-piloto-inicio").value || undefined,
    ventanaPilotoFin: contenedor.querySelector("#v-piloto-fin").value || undefined,
    ventanaProduccionInicio: contenedor.querySelector("#v-prod-inicio").value || undefined,
    ventanaProduccionFin: contenedor.querySelector("#v-prod-fin").value || undefined,
    validacionesPrevias: validaciones,
  };
}

function cablearContenedor(app, contenedor, cambio) {
  contenedor.querySelector("#buscar-usuario").addEventListener("input", (ev) => renderListaUsuarios(contenedor, ev.target.value));

  contenedor.addEventListener("change", (ev) => {
    const g1 = ev.target.closest(".chk-grupo-incluir");
    if (g1) {
      if (g1.checked) estadoAlcance.gruposIncluidos.add(g1.dataset.id);
      else estadoAlcance.gruposIncluidos.delete(g1.dataset.id);
    }
    const g2 = ev.target.closest(".chk-grupo-excluir");
    if (g2) {
      if (g2.checked) estadoAlcance.gruposExcluidos.add(g2.dataset.id);
      else estadoAlcance.gruposExcluidos.delete(g2.dataset.id);
    }
    const u = ev.target.closest(".chk-usuario");
    if (u) {
      if (u.checked) estadoAlcance.usuariosIndividuales.add(u.dataset.id);
      else estadoAlcance.usuariosIndividuales.delete(u.dataset.id);
    }
  });

  contenedor.querySelector("#btn-todos").addEventListener("click", () => {
    candidatos.usuarios.filter((u) => !u.esCuentaEmergencia).forEach((u) => estadoAlcance.usuariosIndividuales.add(u.id));
    renderListaUsuarios(contenedor, contenedor.querySelector("#buscar-usuario").value);
  });
  contenedor.querySelector("#btn-limpiar").addEventListener("click", () => {
    estadoAlcance.usuariosIndividuales.clear();
    renderListaUsuarios(contenedor, contenedor.querySelector("#buscar-usuario").value);
  });

  contenedor.querySelector("#btn-calcular").addEventListener("click", async () => {
    try {
      const draft = leerAlcanceDraft(contenedor);
      const resultado = await api.post("/deployment/calcular-impacto", draft);
      contenedor.querySelector("#resumen-impacto").innerHTML =
        `<strong>${resultado.totalUsuarios}</strong> usuario(s) y <strong>${resultado.totalEquipos}</strong> equipo(s) quedarán afectados (excluyendo cuentas de emergencia).`;
      contenedor.querySelector("#detalle-impacto").innerHTML = esRevisorAutorizado
        ? `<div class="pill-list">${resultado.usuariosAfectados.map((u) => `<span class="pill">${esc(u.displayName)} (${esc(u.area)})</span>`).join("") || "<span class='pill'>Sin personas afectadas</span>"}</div>`
        : "";
    } catch (error) {
      toast(error.message, "error");
    }
  });

  contenedor.querySelector("#btn-guardar-alcance").addEventListener("click", async () => {
    try {
      const draft = leerAlcanceDraft(contenedor);
      await api.patch(`/changes/${cambio.id}/alcance`, draft);
      await api.post(`/changes/${cambio.id}/guardar-alcance`, { actor: cambio.responsableTecnico });
      toast("Alcance final guardado como evidencia del cambio.", "success");
    } catch (error) {
      toast(error.message, "error");
    }
  });
}
