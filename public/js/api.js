async function solicitar(metodo, ruta, cuerpo) {
  const respuesta = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const contentType = respuesta.headers.get("content-type") || "";
  const datos = contentType.includes("application/json") ? await respuesta.json() : await respuesta.text();
  if (!respuesta.ok) {
    const mensaje = (datos && datos.error) || `Error ${respuesta.status}`;
    throw new Error(mensaje);
  }
  return datos;
}

export const api = {
  get: (ruta) => solicitar("GET", ruta),
  post: (ruta, cuerpo) => solicitar("POST", ruta, cuerpo ?? {}),
  patch: (ruta, cuerpo) => solicitar("PATCH", ruta, cuerpo ?? {}),
};

export function descargar(ruta) {
  window.open(`/api${ruta}`, "_blank");
}
