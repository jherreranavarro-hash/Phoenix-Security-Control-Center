export function esc(texto) {
  if (texto === null || texto === undefined) return "";
  return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function fechaCorta(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

export function fechaHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL");
}

const CLASE_CRITICIDAD = { Critica: "critica", Alta: "alta", Media: "media", Baja: "baja" };
export function badgeCriticidad(c) {
  return `<span class="badge badge-${CLASE_CRITICIDAD[c] || "neutro"}">${esc(c)}</span>`;
}

const CLASE_ESTADO = {
  Implementado: "implementado",
  Parcial: "parcial",
  Brecha: "brecha",
  NoAplica: "noaplica",
  RequiereLicencia: "requierelicencia",
};
const TEXTO_ESTADO = {
  Implementado: "Implementado",
  Parcial: "Parcial",
  Brecha: "Brecha",
  NoAplica: "No aplica",
  RequiereLicencia: "Requiere licencia",
};
export function badgeEstado(e) {
  return `<span class="badge badge-${CLASE_ESTADO[e] || "neutro"}">${esc(TEXTO_ESTADO[e] || e)}</span>`;
}

export function badgeModo(modoDemostracion) {
  return modoDemostracion
    ? `<span class="badge badge-demo">● Demostración</span>`
    : `<span class="badge badge-sync">● Sincronizado con Microsoft Graph</span>`;
}

export function barra(actual, meta) {
  const pct = Math.max(0, Math.min(100, actual));
  const clase = actual >= meta ? "ok" : actual >= meta * 0.7 ? "warn" : "";
  return `<div class="progress-track"><div class="progress-fill ${clase}" style="width:${pct}%"></div></div>`;
}

export function toast(mensaje, tipo = "info") {
  const stack = document.getElementById("toast-stack");
  const el = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.textContent = mensaje;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

const modalRoot = () => document.getElementById("modal-root");

export function cerrarModal() {
  const root = modalRoot();
  root.hidden = true;
  root.innerHTML = "";
}

export function abrirModal(html, { onMount } = {}) {
  const root = modalRoot();
  root.innerHTML = `<div class="modal">${html}</div>`;
  root.hidden = false;
  root.onclick = (ev) => {
    if (ev.target === root) cerrarModal();
  };
  if (onMount) onMount(root);
  return root;
}

export function porcentaje(cubiertos, total) {
  if (!total) return 0;
  return Math.round((cubiertos / total) * 100);
}
