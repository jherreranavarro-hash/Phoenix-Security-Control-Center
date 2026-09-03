import { obtenerTokenProduccion, obtenerTokenSoloLectura } from "./auth";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function llamarGraph(
  metodo: "GET" | "POST" | "PATCH" | "DELETE",
  ruta: string,
  modo: "lectura" | "produccion",
  cuerpo?: unknown,
): Promise<unknown> {
  const token = modo === "lectura" ? await obtenerTokenSoloLectura() : await obtenerTokenProduccion();
  const respuesta = await fetch(`${GRAPH_BASE}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  if (!respuesta.ok) {
    const texto = await respuesta.text().catch(() => "");
    throw new Error(`Microsoft Graph respondió ${respuesta.status} en ${ruta}: ${texto}`);
  }

  if (respuesta.status === 204) return null;
  return respuesta.json();
}

export const graphLectura = {
  get: (ruta: string) => llamarGraph("GET", ruta, "lectura"),
};

export const graphProduccion = {
  get: (ruta: string) => llamarGraph("GET", ruta, "produccion"),
  post: (ruta: string, cuerpo?: unknown) => llamarGraph("POST", ruta, "produccion", cuerpo),
  patch: (ruta: string, cuerpo?: unknown) => llamarGraph("PATCH", ruta, "produccion", cuerpo),
  del: (ruta: string) => llamarGraph("DELETE", ruta, "produccion"),
};

export async function paginarTodo(rutaInicial: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let ruta: string | null = rutaInicial;
  while (ruta) {
    const pagina: any = await graphLectura.get(ruta.startsWith("http") ? ruta.replace("https://graph.microsoft.com/v1.0", "") : ruta);
    if (Array.isArray(pagina?.value)) items.push(...pagina.value);
    ruta = pagina?.["@odata.nextLink"] ?? null;
  }
  return items;
}
