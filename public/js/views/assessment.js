import { api } from "../api.js";
import { abrirModal, badgeCriticidad, badgeEstado, badgeModo, cerrarModal, esc, porcentaje, toast } from "../ui.js";

const DOMINIOS = ["EntraID", "Intune", "Defender", "Purview", "Exchange", "Licencias"];
const ESTADOS = ["Implementado", "Parcial", "Brecha", "NoAplica", "RequiereLicencia"];

let cacheHallazgos = [];

export async function renderAssessment(app) {
  const data = await api.get("/assessment");
  cacheHallazgos = data.hallazgos;
  app.innerHTML = plantilla(data);
  cablear(app);
}

function plantilla(data) {
  return `
    ${data.modoDemostracion ? `<div class="alert alert-warn">${badgeModo(true)} Radiografía calculada sobre datos de demostración del tenant.</div>` : ""}
    <div class="toolbar">
      <input id="f-buscar" placeholder="Buscar hallazgo…" />
      <select id="f-dominio"><option value="">Todos los dominios</option>${DOMINIOS.map((d) => `<option value="${d}">${d}</option>`).join("")}</select>
      <select id="f-estado"><option value="">Todos los estados</option>${ESTADOS.map((e) => `<option value="${e}">${e}</option>`).join("")}</select>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Hallazgo</th><th>Dominio</th><th>Estado</th><th>Criticidad</th><th>Cobertura</th><th>Licencia</th><th></th></tr></thead>
        <tbody id="tabla-hallazgos"></tbody>
      </table>
    </div>
  `;
}

function filas(lista) {
  if (lista.length === 0) return `<tr><td colspan="7"><div class="empty-state">No hay hallazgos con estos filtros.</div></td></tr>`;
  return lista
    .map(
      (h) => `<tr>
        <td><strong>${esc(h.nombre)}</strong></td>
        <td>${esc(h.dominio)}</td>
        <td>${badgeEstado(h.estado)}</td>
        <td>${badgeCriticidad(h.criticidad)}</td>
        <td>${h.cobertura.cubiertos}/${h.cobertura.total} (${porcentaje(h.cobertura.cubiertos, h.cobertura.total)}%)</td>
        <td>${esc(h.licenciaRequerida)}</td>
        <td><button class="btn-ghost btn-sm" data-ver="${h.id}">Ver detalle</button></td>
      </tr>`,
    )
    .join("");
}

function aplicarFiltros(app) {
  const buscar = app.querySelector("#f-buscar").value.toLowerCase();
  const dominio = app.querySelector("#f-dominio").value;
  const estado = app.querySelector("#f-estado").value;
  const lista = cacheHallazgos.filter(
    (h) =>
      (!buscar || h.nombre.toLowerCase().includes(buscar)) &&
      (!dominio || h.dominio === dominio) &&
      (!estado || h.estado === estado),
  );
  app.querySelector("#tabla-hallazgos").innerHTML = filas(lista);
}

function cablear(app) {
  aplicarFiltros(app);
  ["#f-buscar", "#f-dominio", "#f-estado"].forEach((sel) => {
    app.querySelector(sel).addEventListener("input", () => aplicarFiltros(app));
    app.querySelector(sel).addEventListener("change", () => aplicarFiltros(app));
  });
  app.querySelector("#tabla-hallazgos").addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-ver]");
    if (btn) mostrarDetalle(btn.dataset.ver);
  });
}

function mostrarDetalle(id) {
  const h = cacheHallazgos.find((x) => x.id === id);
  if (!h) return;
  abrirModal(
    `
    <h2>${esc(h.nombre)}</h2>
    <div class="modal-sub">${esc(h.dominio)} · ${badgeEstado(h.estado)} ${badgeCriticidad(h.criticidad)}</div>
    <div class="finding-grid">
      <div class="finding-block"><h4>Qué existe actualmente</h4><p>${esc(h.queExiste)}</p></div>
      <div class="finding-block"><h4>Qué falta por implementar</h4><p>${esc(h.queFalta)}</p></div>
      <div class="finding-block"><h4>Por qué es relevante</h4><p>${esc(h.porQueRelevante)}</p></div>
      <div class="finding-block"><h4>Cobertura</h4><p>${h.cobertura.cubiertos} de ${h.cobertura.total} (${porcentaje(h.cobertura.cubiertos, h.cobertura.total)}%)</p></div>
      <div class="finding-block"><h4>Licencia requerida</h4><p>${esc(h.licenciaRequerida)}</p></div>
      <div class="finding-block"><h4>Responsable</h4><p>${esc(h.responsable)}</p></div>
      <div class="finding-block"><h4>Próxima acción recomendada</h4><p>${esc(h.proximaAccion)}</p></div>
      <div class="finding-block"><h4>Plan de reversión</h4><p>${esc(h.planReversion)}</p></div>
    </div>
    <div class="finding-block"><h4>Usuarios/equipos pendientes</h4><div class="pill-list">${
      h.pendientes.length ? h.pendientes.slice(0, 12).map((p) => `<span class="pill">${esc(p)}</span>`).join("") : '<span class="pill">Ninguno pendiente</span>'
    }${h.pendientes.length > 12 ? `<span class="pill">+${h.pendientes.length - 12} más</span>` : ""}</div></div>
    <div class="finding-block" style="margin-top:10px"><h4>Prerrequisitos</h4><div class="pill-list">${h.prerrequisitos.map((p) => `<span class="pill">${esc(p)}</span>`).join("") || '<span class="pill">Ninguno</span>'}</div></div>
    <div class="finding-block" style="margin-top:10px"><h4>Validaciones obligatorias</h4><div class="pill-list">${h.validaciones.map((p) => `<span class="pill">${esc(p)}</span>`).join("") || '<span class="pill">Ninguna</span>'}</div></div>
    <div class="modal-actions">
      <button class="btn-ghost" id="btn-cerrar">Cerrar</button>
      <button class="btn-accent" id="btn-crear-cambio">Crear cambio gobernado</button>
    </div>
  `,
    { onMount: (root) => cablearDetalle(root, h) },
  );
}

function cablearDetalle(root, h) {
  root.querySelector("#btn-cerrar").addEventListener("click", cerrarModal);
  root.querySelector("#btn-crear-cambio").addEventListener("click", () => formularioCrearCambio(h));
}

function formularioCrearCambio(h) {
  abrirModal(
    `
    <h2>Crear cambio gobernado</h2>
    <div class="modal-sub">A partir del hallazgo: ${esc(h.nombre)}</div>
    <div class="field-row">
      <div class="field"><label>Solicitante</label><input id="c-solicitante" placeholder="nombre@phoenixservice.com" /></div>
      <div class="field"><label>Aprobador (no puede ser el solicitante)</label><input id="c-aprobador" placeholder="nombre@phoenixservice.com" /></div>
    </div>
    <div class="field"><label>Responsable técnico</label><input id="c-responsable" value="${esc(h.responsable)}" /></div>
    <div class="field"><label>Justificación</label><textarea id="c-justificacion" rows="3">${esc(h.queFalta)}</textarea></div>
    <div class="modal-actions">
      <button class="btn-ghost" id="btn-cancelar">Cancelar</button>
      <button class="btn-primary" id="btn-guardar">Crear cambio</button>
    </div>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancelar").addEventListener("click", cerrarModal);
        root.querySelector("#btn-guardar").addEventListener("click", async () => {
          try {
            const cuerpo = {
              solicitante: root.querySelector("#c-solicitante").value.trim(),
              aprobador: root.querySelector("#c-aprobador").value.trim(),
              responsableTecnico: root.querySelector("#c-responsable").value.trim(),
              justificacion: root.querySelector("#c-justificacion").value.trim(),
            };
            if (!cuerpo.solicitante || !cuerpo.aprobador) throw new Error("Solicitante y aprobador son obligatorios.");
            await api.post(`/changes/desde-hallazgo/${h.id}`, cuerpo);
            toast("Cambio gobernado creado en estado Evaluación.", "success");
            cerrarModal();
            window.location.hash = "#/gobierno";
          } catch (error) {
            toast(error.message, "error");
          }
        });
      },
    },
  );
}
