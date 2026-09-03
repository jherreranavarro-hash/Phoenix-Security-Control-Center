import { almacen } from "./store";
import { generarId } from "./id";
import type { RegistroAuditoria } from "../types";

export function auditar(entrada: Omit<RegistroAuditoria, "id" | "fecha">): void {
  const registro: RegistroAuditoria = {
    id: generarId("AUD"),
    fecha: new Date().toISOString(),
    ...entrada,
  };
  almacen.registrarAuditoria(registro);
}
