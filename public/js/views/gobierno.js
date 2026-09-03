import { api, descargar } from "../api.js";
import { abrirModal, badgeCriticidad, cerrarModal, esc, fechaHora, toast } from "../ui.js";

const ESTADOS = ["Evaluacion", "Diseno", "Piloto", "Aprobacion", "Produccion", "Revertido", "Cerrado", "Rechazado"];
const ETIQUETA_ESTADO = {
  Evaluacion: "Evaluación",
  Diseno: "Diseño",
  Piloto: "Piloto",
  Aprobacion: "Aprobación",
  Produccion: "Producción",
  Revertido: "Revertido",
  Cerrado: "Cerrado",
  Rechazado: "Rechazado",
};

let cacheCambios = [];

export async function renderGobierno(app) {
  await cargar(app);
}

async function cargar(app) {
  const data = await api.get("/changes");
  cacheCambios = data.cambios;
  app.innerHTML = `
    <div class="toolbar">
      <select id="f-estado"><option value="">Todos los estados</option>${ESTADOS.map((e) => `<option value="${e}">${ETIQUETA_ESTADO[e]}</option>`).join("")}</select>
      <span style="flex:1"></span>
      <button class="btn-accent" id="btn-nuevo">+ Nuevo cambio</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Configuración / Política</th><th>Solicitante</th><th>Aprobador</th><th>Riesgo</th><th>Estado</th><th>Actualizado</th><th></th></tr></thead>
        <tbody id="tabla-cambios"></tbody>
      </table>
    </div>
  `;
  app.querySelector("#f-estado").addEventListener("change", () => filtrar(app));
  app.querySelector("#btn-nuevo").addEventListener("click", () => formularioNuevoCambio(app));
  app.querySelector("#tabla-cambios").addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-ver]");
    if (btn) mostrarDetalle(app, btn.dataset.ver);
  });
  filtrar(app);
}

function filtrar(app) {
  const estado = app.querySelector("#f-estado").value;
  const lista = estado ? cacheCambios.filter((c) => c.estado === estado) : cacheCambios;
  app.querySelector("#tabla-cambios").innerHTML =
    lista.length === 0
      ? `<tr><td colspan="8"><div class="empty-state">No hay cambios gobernados con este filtro.</div></td></tr>`
      : lista
          .map(
            (c) => `<tr>
              <td>${esc(c.id)}</td>
              <td><strong>${esc(c.configuracionONombrePolitica)}</strong></td>
              <td>${esc(c.solicitante)}</td>
              <td>${esc(c.aprobador)}</td>
              <td>${badgeCriticidad(c.riesgo)}</td>
              <td><span class="badge badge-neutro">${ETIQUETA_ESTADO[c.estado]}</span></td>
              <td>${fechaHora(c.actualizadoEn)}</td>
              <td><button class="btn-ghost btn-sm" data-ver="${c.id}">Ver</button></td>
            </tr>`,
          )
          .join("");
}

function formularioNuevoCambio(app) {
  abrirModal(
    `
    <h2>Nuevo cambio gobernado</h2>
    <div class="field"><label>Configuración o nombre de la política</label><input id="n-config" /></div>
    <div class="field-row">
      <div class="field"><label>Solicitante</label><input id="n-solicitante" /></div>
      <div class="field"><label>Aprobador (no puede ser el solicitante)</label><input id="n-aprobador" /></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Responsable técnico</label><input id="n-responsable" /></div>
      <div class="field"><label>Riesgo</label><select id="n-riesgo"><option>Critica</option><option>Alta</option><option selected>Media</option><option>Baja</option></select></div>
    </div>
    <div class="field"><label>Justificación</label><textarea id="n-justificacion" rows="2"></textarea></div>
    <div class="field"><label>Impacto esperado</label><textarea id="n-impacto" rows="2"></textarea></div>
    <div class="field-row">
      <div class="field"><label>Plan de pruebas</label><textarea id="n-pruebas" rows="2"></textarea></div>
      <div class="field"><label>Plan de reversión</label><textarea id="n-reversion" rows="2"></textarea></div>
    </div>
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
              configuracionONombrePolitica: root.querySelector("#n-config").value.trim(),
              solicitante: root.querySelector("#n-solicitante").value.trim(),
              aprobador: root.querySelector("#n-aprobador").value.trim(),
              responsableTecnico: root.querySelector("#n-responsable").value.trim(),
              riesgo: root.querySelector("#n-riesgo").value,
              justificacion: root.querySelector("#n-justificacion").value.trim(),
              requisitosPrevios: [],
              impactoEsperado: root.querySelector("#n-impacto").value.trim(),
              planPruebas: root.querySelector("#n-pruebas").value.trim(),
              planReversion: root.querySelector("#n-reversion").value.trim(),
            };
            if (!cuerpo.configuracionONombrePolitica || !cuerpo.solicitante || !cuerpo.aprobador) {
              throw new Error("Configuración, solicitante y aprobador son obligatorios.");
            }
            await api.post("/changes", cuerpo);
            toast("Cambio creado en estado Evaluación.", "success");
            cerrarModal();
            await cargar(app);
          } catch (error) {
            toast(error.message, "error");
          }
        });
      },
    },
  );
}

async function mostrarDetalle(app, id) {
  const { cambio } = await api.get(`/changes/${id}`);
  const acciones = accionesDisponibles(cambio);
  abrirModal(
    `
    <h2>${esc(cambio.configuracionONombrePolitica)}</h2>
    <div class="modal-sub">${esc(cambio.id)} · <span class="badge badge-neutro">${ETIQUETA_ESTADO[cambio.estado]}</span> ${badgeCriticidad(cambio.riesgo)}</div>

    <div class="finding-grid">
      <div class="finding-block"><h4>Solicitante</h4><p>${esc(cambio.solicitante)}</p></div>
      <div class="finding-block"><h4>Aprobador</h4><p>${esc(cambio.aprobador)}</p></div>
      <div class="finding-block"><h4>Responsable técnico</h4><p>${esc(cambio.responsableTecnico)}</p></div>
      <div class="finding-block"><h4>Justificación</h4><p>${esc(cambio.justificacion)}</p></div>
      <div class="finding-block"><h4>Impacto esperado</h4><p>${esc(cambio.impactoEsperado)}</p></div>
      <div class="finding-block"><h4>Resultado del piloto</h4><p>${esc(cambio.resultadoPiloto) || "Pendiente"}</p></div>
      <div class="finding-block"><h4>Riesgo residual</h4><p>${esc(cambio.riesgoResidual)}</p></div>
      <div class="finding-block"><h4>Plan de reversión</h4><p>${esc(cambio.planReversion)}</p></div>
    </div>

    <div class="finding-block"><h4>Alcance</h4><p>${cambio.alcance.totalUsuariosAfectados} usuario(s), ${cambio.alcance.totalEquiposAfectados} equipo(s) afectados · ${cambio.alcance.guardadoComoEvidencia ? "alcance guardado como evidencia ✅" : "alcance aún no guardado ⚠️"}. <a href="#/despliegue?cambio=${cambio.id}" id="link-despliegue">Definir alcance en Despliegue →</a></p></div>

    <div class="finding-block"><h4>Evidencias (${cambio.evidencias.length})</h4>
      <div class="pill-list">${cambio.evidencias.map((e) => `<span class="pill">${esc(e.titulo)}</span>`).join("") || '<span class="pill">Ninguna</span>'}</div>
    </div>

    <div class="field-row" style="margin-top:14px">
      <div class="field"><label>Título de evidencia a adjuntar</label><input id="ev-titulo" placeholder="Ej: Captura de piloto exitoso" /></div>
      <div class="field"><label>URL o referencia</label><input id="ev-url" placeholder="https://…" /></div>
    </div>
    <button class="btn-ghost btn-sm" id="btn-adjuntar">Adjuntar evidencia</button>

    <div class="section-title" style="margin-top:18px;font-size:15px">Historial</div>
    <ul class="timeline">
      ${cambio.historial
        .map((h) => `<li><span class="t-actor">${esc(h.actor)}</span> — ${esc(h.accion)}${h.detalle ? ": " + esc(h.detalle) : ""}<div class="t-fecha">${fechaHora(h.fecha)}</div></li>`)
        .join("")}
    </ul>

    <div class="section-title" style="margin-top:18px;font-size:15px">Artefactos descargables</div>
    <div class="pill-list" id="artefactos-lista"></div>

    <div class="modal-actions" style="flex-wrap:wrap">
      <button class="btn-ghost" id="btn-cerrar">Cerrar ventana</button>
      ${acciones}
    </div>
  `,
    { onMount: (root) => cablearDetalle(root, cambio, app) },
  );
}

function accionesDisponibles(cambio) {
  const botones = [];
  if (cambio.estado === "Evaluacion") botones.push(`<button class="btn-primary" data-transicion="Diseno">Pasar a Diseño</button>`);
  if (cambio.estado === "Diseno") botones.push(`<button class="btn-primary" data-transicion="Piloto">Pasar a Piloto</button>`);
  if (cambio.estado === "Piloto") {
    botones.push(`<button class="btn-ghost" id="btn-resultado-piloto">Registrar resultado del piloto</button>`);
    botones.push(`<button class="btn-primary" data-transicion="Aprobacion">Pasar a Aprobación</button>`);
  }
  if (cambio.estado === "Aprobacion") botones.push(`<button class="btn-accent" id="btn-confirmar-despliegue">Confirmar y desplegar a Producción</button>`);
  if (cambio.estado === "Produccion") {
    botones.push(`<button class="btn-primary" data-transicion="Cerrado">Cerrar cambio</button>`);
    botones.push(`<button class="btn-danger" data-transicion="Revertido">Revertir</button>`);
  }
  if (cambio.estado === "Revertido") botones.push(`<button class="btn-primary" data-transicion="Cerrado">Cerrar cambio</button>`);
  if (!["Cerrado", "Rechazado", "Produccion"].includes(cambio.estado)) {
    botones.push(`<button class="btn-danger" data-transicion="Rechazado">Rechazar</button>`);
  }
  return botones.join("");
}

function cablearDetalle(root, cambio, app) {
  root.querySelector("#btn-cerrar").addEventListener("click", cerrarModal);

  const TIPOS_ART = [
    ["politica-gobierno", "Política de gobierno"],
    ["procedimiento-operativo", "Procedimiento operativo"],
    ["evaluacion-riesgo", "Evaluación de riesgo"],
    ["plan-pruebas-piloto", "Plan de pruebas piloto"],
    ["registro-cambio-reversion", "Registro de cambio y reversión"],
    ["informe-implementacion", "Informe de implementación"],
    ["plan-mejora-continua", "Plan de mejora continua"],
    ["inventario-configuraciones", "Inventario de configuraciones"],
  ];
  root.querySelector("#artefactos-lista").innerHTML = TIPOS_ART.map(
    ([tipo, nombre]) => `<button class="btn-ghost btn-sm" data-artefacto="${tipo}">${nombre}</button>`,
  ).join("");
  root.querySelectorAll("[data-artefacto]").forEach((btn) =>
    btn.addEventListener("click", () => descargar(`/artifacts/${btn.dataset.artefacto}/${cambio.id}`)),
  );

  root.querySelector("#btn-adjuntar")?.addEventListener("click", async () => {
    try {
      const titulo = root.querySelector("#ev-titulo").value.trim();
      const url = root.querySelector("#ev-url").value.trim();
      if (!titulo || !url) throw new Error("Indique título y URL de la evidencia.");
      await api.post(`/changes/${cambio.id}/evidencia`, { titulo, url, actor: cambio.responsableTecnico });
      toast("Evidencia adjuntada.", "success");
      cerrarModal();
      await cargar(app);
      mostrarDetalle(app, cambio.id);
    } catch (error) {
      toast(error.message, "error");
    }
  });

  root.querySelector("#btn-resultado-piloto")?.addEventListener("click", () => {
    abrirModal(
      `
      <h2>Registrar resultado del piloto</h2>
      <div class="field"><label>Resultado</label><textarea id="rp-resultado" rows="4" placeholder="Ej: piloto ejecutado con 5 usuarios sin incidentes, 0 tickets de soporte"></textarea></div>
      <div class="modal-actions"><button class="btn-ghost" id="rp-cancelar">Cancelar</button><button class="btn-primary" id="rp-guardar">Guardar</button></div>
    `,
      {
        onMount: (r2) => {
          r2.querySelector("#rp-cancelar").addEventListener("click", cerrarModal);
          r2.querySelector("#rp-guardar").addEventListener("click", async () => {
            try {
              const resultado = r2.querySelector("#rp-resultado").value.trim();
              if (!resultado) throw new Error("Describa el resultado del piloto.");
              await api.post(`/changes/${cambio.id}/resultado-piloto`, { resultado, actor: cambio.responsableTecnico });
              toast("Resultado de piloto registrado.", "success");
              cerrarModal();
              await cargar(app);
              mostrarDetalle(app, cambio.id);
            } catch (error) {
              toast(error.message, "error");
            }
          });
        },
      },
    );
  });

  root.querySelector("#btn-confirmar-despliegue")?.addEventListener("click", () => modalConfirmacion(cambio, app));

  root.querySelectorAll("[data-transicion]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        const actor = window.prompt("Ingrese su correo (actor que ejecuta la transición):", cambio.responsableTecnico) || "";
        if (!actor.trim()) return;
        await api.post(`/changes/${cambio.id}/transicion`, { estado: btn.dataset.transicion, actor: actor.trim() });
        toast(`Cambio movido a ${ETIQUETA_ESTADO[btn.dataset.transicion]}.`, "success");
        cerrarModal();
        await cargar(app);
      } catch (error) {
        toast(error.message, "error");
      }
    }),
  );
}

function modalConfirmacion(cambio, app) {
  if (!cambio.alcance.guardadoComoEvidencia) {
    toast("Debe definir y guardar el alcance del despliegue en el módulo Despliegue antes de confirmar.", "error");
    return;
  }
  abrirModal(
    `
    <h2>Confirmar despliegue a Producción</h2>
    <div class="modal-sub">${cambio.alcance.totalUsuariosAfectados} usuario(s) y ${cambio.alcance.totalEquiposAfectados} equipo(s) afectados. Grupos excluidos: ${cambio.alcance.gruposExcluidos.length} (incluye cuentas de emergencia).</div>
    <div class="alert alert-info">No se puede aprobar ni ejecutar el despliegue sin confirmar explícitamente cada punto.</div>
    <div class="checklist">
      <label><input type="checkbox" data-c="personasAfectadasConfirmado" /> Confirmo que revisé y entiendo las personas afectadas por este cambio.</label>
      <label><input type="checkbox" data-c="gruposAfectadosConfirmado" /> Confirmo los grupos afectados incluidos en el alcance.</label>
      <label><input type="checkbox" data-c="exclusionesConfirmado" /> Confirmo las exclusiones, incluyendo las cuentas de emergencia.</label>
      <label><input type="checkbox" data-c="ventanaCambioConfirmado" /> Confirmo la ventana de cambio (piloto/producción) definida.</label>
      <label><input type="checkbox" data-c="planReversionConfirmado" /> Confirmo que el plan de reversión: "${esc(cambio.planReversion)}" está listo.</label>
      <label><input type="checkbox" data-c="resultadoEsperadoConfirmado" /> Confirmo el resultado esperado de este cambio.</label>
    </div>
    <div class="field"><label>Aprobador que confirma (debe ser: ${esc(cambio.aprobador)})</label><input id="conf-actor" value="${esc(cambio.aprobador)}" /></div>
    <div class="modal-actions">
      <button class="btn-ghost" id="conf-cancelar">Cancelar</button>
      <button class="btn-accent" id="conf-confirmar">Confirmar despliegue</button>
    </div>
  `,
    {
      onMount: (root) => {
        root.querySelector("#conf-cancelar").addEventListener("click", cerrarModal);
        root.querySelector("#conf-confirmar").addEventListener("click", async () => {
          try {
            const actor = root.querySelector("#conf-actor").value.trim();
            const confirmaciones = {};
            root.querySelectorAll("[data-c]").forEach((chk) => (confirmaciones[chk.dataset.c] = chk.checked));
            await api.post(`/changes/${cambio.id}/confirmar-despliegue`, { actor, ...confirmaciones });
            await api.post(`/changes/${cambio.id}/transicion`, { estado: "Produccion", actor });
            toast("Despliegue confirmado y ejecutado a Producción.", "success");
            cerrarModal();
            await cargar(app);
          } catch (error) {
            toast(error.message, "error");
          }
        });
      },
    },
  );
}
