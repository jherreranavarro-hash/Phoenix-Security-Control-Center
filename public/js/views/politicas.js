import { api } from "../api.js";
import { abrirModal, badgeCriticidad, badgeEstado, cerrarModal, esc, porcentaje, toast } from "../ui.js";

const PRODUCTOS = ["Entra ID", "Intune", "Defender", "Purview", "Exchange"];
let cachePoliticas = [];
const seleccion = new Set();

export async function renderPoliticas(app) {
  const data = await api.get("/policies");
  cachePoliticas = data.politicas;
  seleccion.clear();
  app.innerHTML = `
    <div class="toolbar">
      <input id="f-buscar" placeholder="Buscar política…" />
      <select id="f-producto"><option value="">Todos los productos</option>${PRODUCTOS.map((p) => `<option value="${p}">${p}</option>`).join("")}</select>
      <span style="flex:1"></span>
      <span id="contador-seleccion" class="badge badge-neutro">0 seleccionadas</span>
      <button class="btn-accent" id="btn-crear-cambios" disabled>Crear cambios gobernados</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th></th><th>Política</th><th>Producto</th><th>Riesgo</th><th>Cobertura</th><th>Licenciamiento</th><th>Responsable</th><th>Estado</th></tr></thead>
        <tbody id="tabla-politicas"></tbody>
      </table>
    </div>
  `;
  cablear(app);
}

function filas(lista) {
  if (lista.length === 0) return `<tr><td colspan="8"><div class="empty-state">No hay políticas con estos filtros.</div></td></tr>`;
  return lista
    .map(
      (p) => `<tr>
        <td><input type="checkbox" class="chk-politica" data-id="${p.id}" ${seleccion.has(p.id) ? "checked" : ""} /></td>
        <td><strong style="cursor:pointer" data-detalle="${p.id}">${esc(p.nombre)}</strong></td>
        <td>${esc(p.producto)}</td>
        <td>${badgeCriticidad(p.riesgo)}</td>
        <td>${p.coberturaActual.cubiertos}/${p.coberturaActual.total} (${porcentaje(p.coberturaActual.cubiertos, p.coberturaActual.total)}%)</td>
        <td>${esc(p.licenciamiento)}</td>
        <td>${esc(p.responsable)}</td>
        <td>${badgeEstado(p.estado)}</td>
      </tr>`,
    )
    .join("");
}

function actualizarTabla(app) {
  const buscar = app.querySelector("#f-buscar").value.toLowerCase();
  const producto = app.querySelector("#f-producto").value;
  const lista = cachePoliticas.filter((p) => (!buscar || p.nombre.toLowerCase().includes(buscar)) && (!producto || p.producto === producto));
  app.querySelector("#tabla-politicas").innerHTML = filas(lista);
  actualizarContador(app);
}

function actualizarContador(app) {
  app.querySelector("#contador-seleccion").textContent = `${seleccion.size} seleccionadas`;
  app.querySelector("#btn-crear-cambios").disabled = seleccion.size === 0;
}

function cablear(app) {
  actualizarTabla(app);
  app.querySelector("#f-buscar").addEventListener("input", () => actualizarTabla(app));
  app.querySelector("#f-producto").addEventListener("change", () => actualizarTabla(app));

  app.querySelector("#tabla-politicas").addEventListener("change", (ev) => {
    const chk = ev.target.closest(".chk-politica");
    if (!chk) return;
    if (chk.checked) seleccion.add(chk.dataset.id);
    else seleccion.delete(chk.dataset.id);
    actualizarContador(app);
  });

  app.querySelector("#tabla-politicas").addEventListener("click", (ev) => {
    const nombre = ev.target.closest("[data-detalle]");
    if (nombre) mostrarDetalle(nombre.dataset.detalle);
  });

  app.querySelector("#btn-crear-cambios").addEventListener("click", () => formularioCrearCambios());
}

function mostrarDetalle(id) {
  const p = cachePoliticas.find((x) => x.id === id);
  if (!p) return;
  abrirModal(`
    <h2>${esc(p.nombre)}</h2>
    <div class="modal-sub">${esc(p.producto)} · ${badgeCriticidad(p.riesgo)} ${badgeEstado(p.estado)}</div>
    <p>${esc(p.descripcion)}</p>
    <div class="finding-grid">
      <div class="finding-block"><h4>Requisitos previos</h4><p>${p.requisitosPrevios.join(", ") || "Ninguno"}</p></div>
      <div class="finding-block"><h4>Licenciamiento</h4><p>${esc(p.licenciamiento)}</p></div>
      <div class="finding-block"><h4>Impacto operacional</h4><p>${esc(p.impactoOperacional)}</p></div>
      <div class="finding-block"><h4>Responsable</h4><p>${esc(p.responsable)}</p></div>
    </div>
    <div class="modal-actions"><button class="btn-ghost" id="btn-cerrar">Cerrar</button></div>
  `, { onMount: (root) => root.querySelector("#btn-cerrar").addEventListener("click", cerrarModal) });
}

function formularioCrearCambios() {
  const ids = Array.from(seleccion);
  const nombres = cachePoliticas.filter((p) => ids.includes(p.id)).map((p) => p.nombre);
  abrirModal(
    `
    <h2>Crear cambios gobernados</h2>
    <div class="modal-sub">${ids.length} política(s) seleccionada(s): ${esc(nombres.join(", "))}</div>
    <div class="field-row">
      <div class="field"><label>Solicitante</label><input id="c-solicitante" placeholder="nombre@phoenixservice.com" /></div>
      <div class="field"><label>Aprobador (no puede ser el solicitante)</label><input id="c-aprobador" placeholder="nombre@phoenixservice.com" /></div>
    </div>
    <div class="field"><label>Justificación (opcional)</label><textarea id="c-justificacion" rows="3" placeholder="Se usará una justificación estándar por política si se deja en blanco."></textarea></div>
    <div class="modal-actions">
      <button class="btn-ghost" id="btn-cancelar">Cancelar</button>
      <button class="btn-primary" id="btn-guardar">Crear ${ids.length} cambio(s)</button>
    </div>
  `,
    {
      onMount: (root) => {
        root.querySelector("#btn-cancelar").addEventListener("click", cerrarModal);
        root.querySelector("#btn-guardar").addEventListener("click", async () => {
          try {
            const solicitante = root.querySelector("#c-solicitante").value.trim();
            const aprobador = root.querySelector("#c-aprobador").value.trim();
            const justificacion = root.querySelector("#c-justificacion").value.trim() || undefined;
            if (!solicitante || !aprobador) throw new Error("Solicitante y aprobador son obligatorios.");
            await api.post("/changes/desde-politicas", { politicaIds: ids, solicitante, aprobador, justificacion });
            toast(`${ids.length} cambio(s) gobernado(s) creado(s) en estado Evaluación.`, "success");
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
