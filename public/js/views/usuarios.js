import { api } from "../api.js";
import { abrirModal, badgeCriticidad, badgeEstado, cerrarModal, esc, toast } from "../ui.js";

const TABS = [
  ["usuarios", "Usuarios"],
  ["grupos", "Grupos"],
  ["licencias", "Licencias"],
  ["exchange", "Exchange"],
  ["campania", "Campaña Business Premium"],
];

let tabActual = "usuarios";

export async function renderUsuarios(app) {
  app.innerHTML = `
    <div class="tabs">${TABS.map(([id, nombre]) => `<button data-tab="${id}" class="${id === tabActual ? "activo" : ""}">${nombre}</button>`).join("")}</div>
    <div id="tab-contenido"></div>
  `;
  app.querySelectorAll("[data-tab]").forEach((btn) =>
    btn.addEventListener("click", () => {
      tabActual = btn.dataset.tab;
      app.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("activo", b.dataset.tab === tabActual));
      pintarTab(app);
    }),
  );
  await pintarTab(app);
}

async function pintarTab(app) {
  const cont = app.querySelector("#tab-contenido");
  cont.innerHTML = `<div class="empty-state">Cargando…</div>`;
  if (tabActual === "usuarios") return pintarUsuarios(cont);
  if (tabActual === "grupos") return pintarGrupos(cont);
  if (tabActual === "licencias") return pintarLicencias(cont);
  if (tabActual === "exchange") return pintarExchange(cont);
  if (tabActual === "campania") return pintarCampania(cont);
}

// ---------------- USUARIOS ----------------
async function pintarUsuarios(cont) {
  const data = await api.get("/users");
  const areas = Array.from(new Set(data.usuarios.map((u) => u.area))).sort();
  cont.innerHTML = `
    <div class="toolbar">
      <input id="fu-buscar" placeholder="Buscar usuario…" />
      <select id="fu-area"><option value="">Todas las áreas</option>${areas.map((a) => `<option>${esc(a)}</option>`).join("")}</select>
      <select id="fu-estado"><option value="">Todos los estados</option><option value="activo">Activos</option><option value="inactivo">Bloqueados</option></select>
      <span style="flex:1"></span>
      <button class="btn-accent" id="btn-nuevo-usuario">+ Crear usuario</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Nombre</th><th>Correo</th><th>Área</th><th>Roles</th><th>Licencias</th><th>MFA</th><th>Estado</th><th></th></tr></thead>
      <tbody id="tbl-usuarios"></tbody>
    </table></div>
  `;

  const pintar = () => {
    const q = cont.querySelector("#fu-buscar").value.toLowerCase();
    const area = cont.querySelector("#fu-area").value;
    const estado = cont.querySelector("#fu-estado").value;
    const lista = data.usuarios.filter(
      (u) =>
        (!q || u.displayName.toLowerCase().includes(q) || u.userPrincipalName.toLowerCase().includes(q)) &&
        (!area || u.area === area) &&
        (!estado || (estado === "activo" ? u.accountEnabled : !u.accountEnabled)),
    );
    cont.querySelector("#tbl-usuarios").innerHTML =
      lista
        .map(
          (u) => `<tr>
            <td><strong>${esc(u.displayName)}</strong>${u.esCuentaEmergencia ? ' <span class="badge badge-critica">Emergencia</span>' : ""}</td>
            <td>${esc(u.userPrincipalName)}</td>
            <td>${esc(u.area)}</td>
            <td>${u.roles.join(", ") || "—"}</td>
            <td>${u.licencias.length ? u.licencias.join(", ") : "Sin licencia"}</td>
            <td>${u.mfaRegistrado ? "✅" : "❌"}</td>
            <td><span class="badge ${u.accountEnabled ? "badge-sync" : "badge-critica"}">${u.accountEnabled ? "Activo" : "Bloqueado"}</span></td>
            <td><button class="btn-ghost btn-sm" data-usuario="${u.id}">Gestionar</button></td>
          </tr>`,
        )
        .join("") || `<tr><td colspan="8"><div class="empty-state">Sin resultados.</div></td></tr>`;
  };
  cont.querySelector("#fu-buscar").addEventListener("input", pintar);
  cont.querySelector("#fu-area").addEventListener("change", pintar);
  cont.querySelector("#fu-estado").addEventListener("change", pintar);
  cont.querySelector("#tbl-usuarios").addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-usuario]");
    if (btn) gestionarUsuario(cont, data.usuarios.find((u) => u.id === btn.dataset.usuario));
  });
  pintar();

  cont.querySelector("#btn-nuevo-usuario").addEventListener("click", () => formularioCrearUsuario(cont));
}

function formularioCrearUsuario(cont) {
  abrirModal(
    `
    <h2>Crear usuario</h2>
    <div class="field-row">
      <div class="field"><label>Nombre completo</label><input id="nu-nombre" /></div>
      <div class="field"><label>Correo (UPN)</label><input id="nu-upn" placeholder="nombre@phoenixservice.com" /></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Área</label><input id="nu-area" /></div>
      <div class="field"><label>Cargo</label><input id="nu-cargo" /></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Solicitante</label><input id="nu-solicitante" /></div>
      <div class="field"><label>Aprobador</label><input id="nu-aprobador" /></div>
    </div>
    <div class="field"><label>Justificación</label><textarea id="nu-justificacion" rows="2"></textarea></div>
    <div class="modal-actions"><button class="btn-ghost" id="nu-cancelar">Cancelar</button><button class="btn-primary" id="nu-guardar">Crear</button></div>
  `,
    {
      onMount: (root) => {
        root.querySelector("#nu-cancelar").addEventListener("click", cerrarModal);
        root.querySelector("#nu-guardar").addEventListener("click", async () => {
          try {
            await api.post("/users", {
              displayName: root.querySelector("#nu-nombre").value.trim(),
              userPrincipalName: root.querySelector("#nu-upn").value.trim(),
              area: root.querySelector("#nu-area").value.trim(),
              cargo: root.querySelector("#nu-cargo").value.trim(),
              solicitante: root.querySelector("#nu-solicitante").value.trim(),
              aprobador: root.querySelector("#nu-aprobador").value.trim(),
              justificacion: root.querySelector("#nu-justificacion").value.trim(),
            });
            toast("Usuario creado.", "success");
            cerrarModal();
            pintarUsuarios(cont);
          } catch (error) {
            toast(error.message, "error");
          }
        });
      },
    },
  );
}

function gestionarUsuario(cont, u) {
  abrirModal(
    `
    <h2>${esc(u.displayName)}</h2>
    <div class="modal-sub">${esc(u.userPrincipalName)} · ${esc(u.area)} · ${esc(u.cargo || "")}</div>
    <div class="finding-grid">
      <div class="finding-block"><h4>Roles de Entra ID</h4><p>${u.roles.join(", ") || "Sin roles"}</p></div>
      <div class="finding-block"><h4>Grupos</h4><p>${u.grupos.join(", ") || "Sin grupos"}</p></div>
      <div class="finding-block"><h4>Licencias</h4><p>${u.licencias.join(", ") || "Sin licencia"}</p></div>
      <div class="finding-block"><h4>Estado</h4><p>${u.accountEnabled ? "Activo" : "Bloqueado"}</p></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Solicitante</label><input id="gu-solicitante" /></div>
      <div class="field"><label>Aprobador</label><input id="gu-aprobador" /></div>
    </div>
    <div class="field"><label>Justificación</label><textarea id="gu-justificacion" rows="2"></textarea></div>
    <div class="modal-actions">
      <button class="btn-ghost" id="gu-cerrar">Cerrar</button>
      <button class="btn-danger" id="gu-bloqueo">${u.accountEnabled ? "Bloquear cuenta" : "Desbloquear cuenta"}</button>
    </div>
  `,
    {
      onMount: (root) => {
        root.querySelector("#gu-cerrar").addEventListener("click", cerrarModal);
        root.querySelector("#gu-bloqueo").addEventListener("click", async () => {
          try {
            const solicitante = root.querySelector("#gu-solicitante").value.trim();
            const aprobador = root.querySelector("#gu-aprobador").value.trim();
            const justificacion = root.querySelector("#gu-justificacion").value.trim();
            if (!solicitante || !aprobador || !justificacion) throw new Error("Complete solicitante, aprobador y justificación.");
            await api.post(`/users/${u.id}/bloqueo`, { bloquear: u.accountEnabled, solicitante, aprobador, justificacion });
            toast(u.accountEnabled ? "Cuenta bloqueada." : "Cuenta desbloqueada.", "success");
            cerrarModal();
            pintarUsuarios(cont);
          } catch (error) {
            toast(error.message, "error");
          }
        });
      },
    },
  );
}

// ---------------- GRUPOS ----------------
async function pintarGrupos(cont) {
  const data = await api.get("/groups");
  cont.innerHTML = `
    <div class="toolbar"><span style="flex:1"></span><button class="btn-accent" id="btn-nuevo-grupo">+ Crear grupo y desplegar políticas</button></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Nombre</th><th>Clasificación</th><th>Propósito</th><th>Miembros</th><th></th></tr></thead>
      <tbody>
        ${data.grupos
          .map(
            (g) => `<tr>
              <td><strong>${esc(g.nombre)}</strong>${g.esGrupoEmergencia ? ' <span class="badge badge-critica">Emergencia</span>' : ""}<div class="section-sub" style="margin:2px 0 0">${esc(g.descripcion)}</div></td>
              <td>${(g.clasificacion || []).join(", ")}</td>
              <td>${esc(g.proposito)}</td>
              <td>${g.miembros.length}</td>
              <td><button class="btn-ghost btn-sm" data-gestionar="${g.id}">Miembros y políticas</button></td>
            </tr>`,
          )
          .join("")}
      </tbody>
    </table></div>
  `;
  cont.querySelector("#btn-nuevo-grupo").addEventListener("click", () => formularioCrearGrupo(cont));
  cont.querySelectorAll("[data-gestionar]").forEach((btn) =>
    btn.addEventListener("click", () => pasoMiembrosYPoliticas(cont, data.grupos.find((g) => g.id === btn.dataset.gestionar))),
  );
}

const PRODUCTO_POR_CLASIFICACION = { EntraID: "Entra ID", Intune: "Intune", Defender: "Defender", Purview: "Purview" };

function formularioCrearGrupo(cont) {
  abrirModal(
    `
    <h2>Paso 1 de 3 — Crear grupo de seguridad</h2>
    <div class="modal-sub">A continuación podrás agregar miembros reales y elegir qué políticas del catálogo desplegar en este grupo.</div>
    <div class="field"><label>Nombre</label><input id="ng-nombre" placeholder="SEC-Dominio-Proposito" /></div>
    <div class="field"><label>Descripción</label><textarea id="ng-descripcion" rows="2"></textarea></div>
    <div class="field-row">
      <div class="field"><label>Clasificación (dominio a desplegar)</label><select id="ng-clasificacion"><option value="EntraID">Entra ID</option><option value="Intune">Intune</option><option value="Defender">Defender</option><option value="Purview">Purview</option><option value="Todos">Todos</option></select></div>
      <div class="field"><label>Propósito</label><select id="ng-proposito"><option value="Piloto">Piloto</option><option value="Produccion">Producción</option><option value="Exclusion">Exclusión</option><option value="Operativo">Operativo</option></select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Solicitante</label><input id="ng-solicitante" /></div>
      <div class="field"><label>Aprobador</label><input id="ng-aprobador" /></div>
    </div>
    <div class="field"><label>Justificación</label><textarea id="ng-justificacion" rows="2"></textarea></div>
    <div class="modal-actions"><button class="btn-ghost" id="ng-cancelar">Cancelar</button><button class="btn-primary" id="ng-guardar">Crear grupo y continuar</button></div>
  `,
    {
      onMount: (root) => {
        root.querySelector("#ng-cancelar").addEventListener("click", cerrarModal);
        root.querySelector("#ng-guardar").addEventListener("click", async () => {
          try {
            const solicitante = root.querySelector("#ng-solicitante").value.trim();
            const aprobador = root.querySelector("#ng-aprobador").value.trim();
            const nombre = root.querySelector("#ng-nombre").value.trim();
            if (!nombre || !solicitante || !aprobador) throw new Error("Complete nombre, solicitante y aprobador.");
            const { grupo } = await api.post("/groups", {
              nombre,
              descripcion: root.querySelector("#ng-descripcion").value.trim(),
              clasificacion: [root.querySelector("#ng-clasificacion").value],
              proposito: root.querySelector("#ng-proposito").value,
              solicitante,
              aprobador,
              justificacion: root.querySelector("#ng-justificacion").value.trim(),
            });
            toast("Grupo creado.", "success");
            pasoMiembrosYPoliticas(cont, grupo, { solicitante, aprobador });
          } catch (error) {
            toast(error.message, "error");
          }
        });
      },
    },
  );
}

async function pasoMiembrosYPoliticas(cont, grupo, prefill = {}) {
  const [candidatosResp, politicasResp] = await Promise.all([
    api.get("/deployment/candidatos"),
    api.get(`/policies${grupo.clasificacion?.[0] && PRODUCTO_POR_CLASIFICACION[grupo.clasificacion[0]] ? `?producto=${encodeURIComponent(PRODUCTO_POR_CLASIFICACION[grupo.clasificacion[0]])}` : ""}`),
  ]);
  const miembrosActuales = new Set(grupo.miembros || []);
  const seleccionPoliticas = new Set();

  abrirModal(
    `
    <h2>Paso 2 de 3 — Miembros de "${esc(grupo.nombre)}"</h2>
    <div class="modal-sub">${miembrosActuales.size} miembro(s) actual(es). Selecciona quién más debe pertenecer a este grupo.</div>
    <input id="pm-buscar" placeholder="Buscar por nombre, correo o área…" style="width:100%;margin-bottom:10px" />
    <div style="max-height:280px;overflow:auto" id="pm-lista"></div>
    <div class="modal-actions">
      <button class="btn-ghost" id="pm-omitir">Omitir por ahora</button>
      <button class="btn-primary" id="pm-continuar">Continuar a políticas →</button>
    </div>
  `,
    {
      onMount: (root) => {
        const pintarLista = (filtro = "") => {
          const q = filtro.toLowerCase();
          const lista = candidatosResp.usuarios.filter(
            (u) => !q || u.displayName.toLowerCase().includes(q) || u.userPrincipalName.toLowerCase().includes(q) || u.area.toLowerCase().includes(q),
          );
          root.querySelector("#pm-lista").innerHTML = lista
            .map(
              (u) => `<label style="display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid var(--color-border)">
                <input type="checkbox" class="chk-pm" data-id="${u.id}" ${miembrosActuales.has(u.id) ? "checked" : ""} ${u.esCuentaEmergencia ? "disabled" : ""} />
                <span style="flex:1">${esc(u.displayName)} <span class="pill">${esc(u.area)}</span>${u.esCuentaEmergencia ? ' <span class="badge badge-critica">Emergencia</span>' : ""}</span>
              </label>`,
            )
            .join("");
        };
        pintarLista();
        root.querySelector("#pm-buscar").addEventListener("input", (ev) => pintarLista(ev.target.value));
        root.querySelector("#pm-omitir").addEventListener("click", () => pasoPoliticas(cont, grupo, politicasResp.politicas, seleccionPoliticas, prefill));
        root.querySelector("#pm-continuar").addEventListener("click", async () => {
          const marcados = Array.from(root.querySelectorAll(".chk-pm")).filter((c) => c.checked && !miembrosActuales.has(c.dataset.id));
          const desmarcados = Array.from(root.querySelectorAll(".chk-pm")).filter((c) => !c.checked && miembrosActuales.has(c.dataset.id));
          if (marcados.length === 0 && desmarcados.length === 0) {
            pasoPoliticas(cont, grupo, politicasResp.politicas, seleccionPoliticas, prefill);
            return;
          }
          const solicitante = prefill.solicitante || window.prompt("Solicitante (correo):", "") || "";
          const aprobador = prefill.aprobador || window.prompt("Aprobador (correo, distinto del solicitante):", "") || "";
          const justificacion = "Agregar miembros al grupo recién creado para despliegue.";
          if (!solicitante || !aprobador) {
            toast("Se requieren solicitante y aprobador para modificar membresías.", "error");
            return;
          }
          try {
            for (const chk of [...marcados, ...desmarcados]) {
              await api.post(`/groups/${grupo.id}/miembros`, {
                usuarioId: chk.dataset.id,
                agregar: marcados.includes(chk),
                solicitante,
                aprobador,
                justificacion,
              });
            }
            toast(`Membresía actualizada (${marcados.length} agregado(s), ${desmarcados.length} quitado(s)).`, "success");
            pasoPoliticas(cont, grupo, politicasResp.politicas, seleccionPoliticas, prefill);
          } catch (error) {
            toast(error.message, "error");
          }
        });
      },
    },
  );
}

function pasoPoliticas(cont, grupo, politicas, seleccionPoliticas, prefill) {
  abrirModal(
    `
    <h2>Paso 3 de 3 — Políticas disponibles para "${esc(grupo.nombre)}"</h2>
    <div class="modal-sub">Catálogo filtrado por dominio (${(grupo.clasificacion || []).join(", ") || "Todos"}). Selecciona las que quieres desplegar en este grupo.</div>
    <div style="max-height:320px;overflow:auto">
      <table style="width:100%">
        <thead><tr><th></th><th>Política</th><th>Producto</th><th>Riesgo</th><th>Estado</th></tr></thead>
        <tbody>
          ${politicas
            .map(
              (p) => `<tr>
                <td><input type="checkbox" class="chk-pol" data-id="${p.id}" /></td>
                <td><strong>${esc(p.nombre)}</strong></td>
                <td>${esc(p.producto)}</td>
                <td>${badgeCriticidad(p.riesgo)}</td>
                <td>${badgeEstado(p.estado)}</td>
              </tr>`,
            )
            .join("") || `<tr><td colspan="5"><div class="empty-state">No hay políticas para este dominio en el catálogo.</div></td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" id="pp-terminar">Terminar sin desplegar políticas</button>
      <button class="btn-accent" id="pp-crear">Crear cambios gobernados con las seleccionadas</button>
    </div>
  `,
    {
      onMount: (root) => {
        root.querySelector("#pp-terminar").addEventListener("click", () => {
          cerrarModal();
          pintarGrupos(cont);
        });
        root.querySelector("#pp-crear").addEventListener("click", async () => {
          const ids = Array.from(root.querySelectorAll(".chk-pol"))
            .filter((c) => c.checked)
            .map((c) => c.dataset.id);
          if (ids.length === 0) {
            toast("Selecciona al menos una política.", "error");
            return;
          }
          const solicitante = prefill.solicitante || window.prompt("Solicitante (correo):", "") || "";
          const aprobador = prefill.aprobador || window.prompt("Aprobador (correo, distinto del solicitante):", "") || "";
          if (!solicitante || !aprobador) {
            toast("Se requieren solicitante y aprobador.", "error");
            return;
          }
          try {
            await api.post("/changes/desde-politicas", {
              politicaIds: ids,
              solicitante,
              aprobador,
              justificacion: `Despliegue de políticas en el grupo "${grupo.nombre}" (${(grupo.clasificacion || []).join(", ")}).`,
            });
            toast(`${ids.length} cambio(s) gobernado(s) creado(s). Defínelos con alcance = grupo "${grupo.nombre}" en el módulo Despliegue.`, "success");
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

// ---------------- LICENCIAS ----------------
async function pintarLicencias(cont) {
  const [skus, asignaciones] = await Promise.all([api.get("/licenses/skus"), api.get("/licenses/asignaciones")]);
  cont.innerHTML = `
    <div class="section-title" style="margin-top:0">Disponibilidad de licencias</div>
    <div class="grid grid-3">
      ${skus.skus
        .map(
          (s) => `<div class="card kpi-tile">
            <span class="kpi-label">${esc(s.nombreComercial)}</span>
            <span class="kpi-value">${s.disponibles}<span style="font-size:14px;color:var(--color-ink-faint)"> disponibles</span></span>
            <span class="kpi-delta">${s.asignadas}/${s.total} asignadas · SKU técnico: ${esc(s.skuPartNumber)}</span>
          </div>`,
        )
        .join("")}
    </div>

    <div class="section-title">Usuarios y licencias</div>
    <div class="toolbar"><input id="fl-buscar" placeholder="Buscar usuario…" /><span class="pill">Sin licencia: ${asignaciones.sinLicencia}</span></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Usuario</th><th>Área</th><th>Licencias actuales</th><th>Estado</th><th></th></tr></thead>
      <tbody id="tbl-licencias"></tbody>
    </table></div>
  `;

  const pintar = () => {
    const q = cont.querySelector("#fl-buscar").value.toLowerCase();
    const lista = asignaciones.usuarios.filter((u) => !q || u.displayName.toLowerCase().includes(q));
    cont.querySelector("#tbl-licencias").innerHTML = lista
      .map(
        (u) => `<tr>
          <td><strong>${esc(u.displayName)}</strong></td>
          <td>${esc(u.area)}</td>
          <td>${u.licencias.length ? u.licencias.join(", ") : '<span class="badge badge-neutro">Sin licencia</span>'}</td>
          <td>${u.accountEnabled ? "Activo" : "Bloqueado"}</td>
          <td><button class="btn-ghost btn-sm" data-lic="${u.id}">Gestionar licencia</button></td>
        </tr>`,
      )
      .join("");
  };
  cont.querySelector("#fl-buscar").addEventListener("input", pintar);
  cont.querySelector("#tbl-licencias").addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-lic]");
    if (btn) formularioLicenciaIndividual(cont, asignaciones.usuarios.find((u) => u.id === btn.dataset.lic), skus.skus);
  });
  pintar();
}

function formularioLicenciaIndividual(cont, u, skus) {
  abrirModal(
    `
    <h2>Gestionar licencia — ${esc(u.displayName)}</h2>
    <div class="modal-sub">Licencias actuales: ${u.licencias.join(", ") || "Ninguna"}</div>
    <div class="field-row">
      <div class="field"><label>Agregar</label><select id="li-agregar"><option value="">— Ninguna —</option>${skus.map((s) => `<option value="${s.skuPartNumber}">${esc(s.nombreComercial)} (${s.disponibles} disp.)</option>`).join("")}</select></div>
      <div class="field"><label>Quitar</label><select id="li-quitar"><option value="">— Ninguna —</option>${u.licencias.map((l) => `<option value="${l}">${esc(l)}</option>`).join("")}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Solicitante</label><input id="li-solicitante" /></div>
      <div class="field"><label>Aprobador</label><input id="li-aprobador" /></div>
    </div>
    <div class="field"><label>Justificación</label><textarea id="li-justificacion" rows="2"></textarea></div>
    <div class="modal-actions"><button class="btn-ghost" id="li-cancelar">Cancelar</button><button class="btn-primary" id="li-guardar">Aplicar cambio</button></div>
  `,
    {
      onMount: (root) => {
        root.querySelector("#li-cancelar").addEventListener("click", cerrarModal);
        root.querySelector("#li-guardar").addEventListener("click", async () => {
          try {
            const agregar = root.querySelector("#li-agregar").value;
            const quitar = root.querySelector("#li-quitar").value;
            const solicitante = root.querySelector("#li-solicitante").value.trim();
            const aprobador = root.querySelector("#li-aprobador").value.trim();
            const justificacion = root.querySelector("#li-justificacion").value.trim();
            if (!agregar && !quitar) throw new Error("Seleccione al menos una licencia a agregar o quitar.");
            if (!solicitante || !aprobador || !justificacion) throw new Error("Complete solicitante, aprobador y justificación.");
            await api.post(`/licenses/${u.id}`, { agregar: agregar ? [agregar] : [], quitar: quitar ? [quitar] : [], solicitante, aprobador, justificacion });
            toast("Licencia actualizada.", "success");
            cerrarModal();
            pintarLicencias(cont);
          } catch (error) {
            toast(error.message, "error");
          }
        });
      },
    },
  );
}

// ---------------- EXCHANGE ----------------
async function pintarExchange(cont) {
  const data = await api.get("/users");
  cont.innerHTML = `
    <div class="toolbar"><input id="fe-buscar" placeholder="Buscar usuario…" /></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Usuario</th><th>Alias</th><th>Reenvío</th><th>Respuesta automática</th><th>Delegados</th><th></th></tr></thead>
      <tbody id="tbl-exchange"></tbody>
    </table></div>
  `;
  const pintar = () => {
    const q = cont.querySelector("#fe-buscar").value.toLowerCase();
    const lista = data.usuarios.filter((u) => !q || u.displayName.toLowerCase().includes(q));
    cont.querySelector("#tbl-exchange").innerHTML = lista
      .map(
        (u) => `<tr>
          <td><strong>${esc(u.displayName)}</strong>${u.buzon.esCompartido ? ' <span class="badge badge-neutro">Compartido</span>' : ""}</td>
          <td>${u.buzon.alias.join(", ")}</td>
          <td>${esc(u.buzon.reenvio) || "—"}</td>
          <td>${u.buzon.respuestaAutomatica ? "Activa" : "Inactiva"}</td>
          <td>${u.buzon.delegados.join(", ") || "—"}</td>
          <td><button class="btn-ghost btn-sm" data-ex="${u.id}">Editar</button></td>
        </tr>`,
      )
      .join("");
  };
  cont.querySelector("#fe-buscar").addEventListener("input", pintar);
  cont.querySelector("#tbl-exchange").addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-ex]");
    if (btn) formularioExchange(cont, data.usuarios.find((u) => u.id === btn.dataset.ex));
  });
  pintar();
}

function formularioExchange(cont, u) {
  abrirModal(
    `
    <h2>Buzón — ${esc(u.displayName)}</h2>
    <div class="field"><label>Reenvío (correo externo o vacío para desactivar)</label><input id="ex-reenvio" value="${esc(u.buzon.reenvio || "")}" /></div>
    <div class="field"><label>Delegados (separados por coma)</label><input id="ex-delegados" value="${esc(u.buzon.delegados.join(", "))}" /></div>
    <div class="field"><label><input type="checkbox" id="ex-respuesta" ${u.buzon.respuestaAutomatica ? "checked" : ""} /> Respuesta automática activa</label></div>
    <div class="field"><label><input type="checkbox" id="ex-compartido" ${u.buzon.esCompartido ? "checked" : ""} /> Es buzón compartido</label></div>
    <div class="field-row">
      <div class="field"><label>Solicitante</label><input id="ex-solicitante" /></div>
      <div class="field"><label>Aprobador</label><input id="ex-aprobador" /></div>
    </div>
    <div class="field"><label>Justificación</label><textarea id="ex-justificacion" rows="2"></textarea></div>
    <div class="modal-actions"><button class="btn-ghost" id="ex-cancelar">Cancelar</button><button class="btn-primary" id="ex-guardar">Guardar</button></div>
  `,
    {
      onMount: (root) => {
        root.querySelector("#ex-cancelar").addEventListener("click", cerrarModal);
        root.querySelector("#ex-guardar").addEventListener("click", async () => {
          try {
            const solicitante = root.querySelector("#ex-solicitante").value.trim();
            const aprobador = root.querySelector("#ex-aprobador").value.trim();
            const justificacion = root.querySelector("#ex-justificacion").value.trim();
            if (!solicitante || !aprobador || !justificacion) throw new Error("Complete solicitante, aprobador y justificación.");
            await api.patch(`/exchange/${u.id}`, {
              reenvio: root.querySelector("#ex-reenvio").value.trim() || undefined,
              delegados: root.querySelector("#ex-delegados").value.split(",").map((d) => d.trim()).filter(Boolean),
              respuestaAutomatica: root.querySelector("#ex-respuesta").checked,
              esCompartido: root.querySelector("#ex-compartido").checked,
              solicitante,
              aprobador,
              justificacion,
            });
            toast("Configuración de Exchange actualizada.", "success");
            cerrarModal();
            pintarExchange(cont);
          } catch (error) {
            toast(error.message, "error");
          }
        });
      },
    },
  );
}

// ---------------- CAMPAÑA MASIVA ----------------
async function pintarCampania(cont) {
  cont.innerHTML = `<div class="empty-state">Cargando vista previa…</div>`;
  const vista = await api.get("/licenses/campania/vista-previa");
  cont.innerHTML = `
    <div class="alert ${vista.fuente === "graph" ? "alert-ok" : "alert-warn"}">
      ${vista.fuente === "graph" ? "Conectado a Microsoft Graph." : "Modo demostración: sin conexión a Microsoft Graph, se usan datos de ejemplo."}
      Revisión generada: ${new Date(vista.generadoEn).toLocaleString("es-CL")}
    </div>

    <div class="grid grid-3">
      <div class="card kpi-tile"><span class="kpi-label">SKU origen</span><span class="kpi-value" style="font-size:16px">${esc(vista.skuOrigen?.nombreComercial || "—")}</span><span class="kpi-delta">${esc(vista.skuOrigen?.skuPartNumber || "")}</span></div>
      <div class="card kpi-tile"><span class="kpi-label">SKU destino</span><span class="kpi-value" style="font-size:16px">${esc(vista.skuDestino?.nombreComercial || "—")}</span><span class="kpi-delta">${vista.disponibles} disponibles</span></div>
      <div class="card kpi-tile"><span class="kpi-label">Cuentas elegibles</span><span class="kpi-value">${vista.elegibles.length}</span><span class="kpi-delta">${vista.suficientes ? "Stock suficiente ✅" : "Stock insuficiente ❌"}</span></div>
    </div>

    ${!vista.suficientes ? `<div class="alert alert-danger">No hay licencias Premium suficientes (${vista.disponibles} disponibles para ${vista.elegibles.length} cuentas elegibles). No se realizará ningún cambio hasta contar con stock suficiente.</div>` : ""}

    <div class="section-title">Personas afectadas (${vista.elegibles.length})</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Nombre</th><th>Correo</th></tr></thead>
      <tbody>${vista.elegibles.map((u) => `<tr><td>${esc(u.displayName)}</td><td>${esc(u.userPrincipalName)}</td></tr>`).join("") || '<tr><td colspan="2"><div class="empty-state">Sin cuentas elegibles.</div></td></tr>'}</tbody>
    </table></div>

    <div style="margin-top:16px;display:flex;gap:10px">
      <button class="btn-ghost" id="btn-refrescar">Actualizar revisión</button>
      <button class="btn-accent" id="btn-ejecutar" ${vista.suficientes && vista.elegibles.length > 0 ? "" : "disabled"}>Ejecutar campaña masiva</button>
    </div>

    <div class="section-title">Historial de ejecuciones</div>
    <div id="historial-campania"></div>
  `;

  cont.querySelector("#btn-refrescar").addEventListener("click", () => pintarCampania(cont));
  cont.querySelector("#btn-ejecutar").addEventListener("click", () => modalEjecutarCampania(cont, vista));
  cargarHistorial(cont);
}

async function cargarHistorial(cont) {
  const { campañas } = await api.get("/licenses/campania/historial");
  const el = cont.querySelector("#historial-campania");
  if (!el) return;
  el.innerHTML = campañas.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Aprobador</th><th>Exitosos</th><th>Fallidos</th><th>Fuente</th></tr></thead>
        <tbody>${campañas.map((c) => `<tr><td>${new Date(c.fecha).toLocaleString("es-CL")}</td><td>${esc(c.aprobador)}</td><td>${c.exitosos}</td><td>${c.fallidos}</td><td>${esc(c.fuente)}</td></tr>`).join("")}</tbody>
      </table></div>`
    : `<div class="empty-state">Sin ejecuciones registradas.</div>`;
}

function modalEjecutarCampania(cont, vista) {
  abrirModal(
    `
    <h2>Ejecutar campaña masiva de licencias</h2>
    <div class="alert alert-danger">Esta operación está restringida exclusivamente al aprobador autorizado (PHX_LICENSE_APPROVER_UPN) y requiere que PHX_ENABLE_WRITES=true durante la ventana aprobada.</div>
    <p>Se migrarán <strong>${vista.elegibles.length}</strong> cuenta(s) de "${esc(vista.skuOrigen?.nombreComercial)}" a "${esc(vista.skuDestino?.nombreComercial)}" en una sola operación por usuario.</p>
    <div class="checklist">
      <label><input type="checkbox" id="cm-impacto" /> Confirmo que revisé la lista completa de personas afectadas mostrada en pantalla.</label>
    </div>
    <div class="field"><label>Escriba exactamente: <code>AUTORIZO CAMBIO MASIVO A BUSINESS PREMIUM</code></label><input id="cm-frase" /></div>
    <div class="modal-actions">
      <button class="btn-ghost" id="cm-cancelar">Cancelar</button>
      <button class="btn-danger" id="cm-ejecutar">Ejecutar migración</button>
    </div>
  `,
    {
      onMount: (root) => {
        root.querySelector("#cm-cancelar").addEventListener("click", cerrarModal);
        root.querySelector("#cm-ejecutar").addEventListener("click", async () => {
          try {
            const confirmoRevisionImpacto = root.querySelector("#cm-impacto").checked;
            const frase = root.querySelector("#cm-frase").value;
            const resultado = await api.post("/licenses/campania/ejecutar", {
              frase,
              tokenRevision: vista.tokenRevision,
              confirmoRevisionImpacto,
            });
            toast(`Campaña ejecutada: ${resultado.resultado.exitosos}/${resultado.resultado.totalElegibles} migradas. ${resultado.recomendacion}`, "success");
            cerrarModal();
            pintarCampania(cont);
          } catch (error) {
            toast(error.message, "error");
          }
        });
      },
    },
  );
}
