import { config } from "../config";

/**
 * Estado en memoria de las escrituras reales contra el tenant, conmutable en
 * tiempo real desde la interfaz ("Conectar" / "Desconectar producción") sin
 * necesidad de editar PHX_ENABLE_WRITES ni reiniciar el servidor.
 *
 * Arranca en el valor de PHX_ENABLE_WRITES (por defecto "false"). Si el
 * proceso se reinicia, vuelve a ese valor de arranque — nunca queda
 * "conectado" de forma persistente por accidente.
 */
let escriturasHabilitadas = config.enableWrites;

export function escriturasEstanHabilitadas(): boolean {
  return escriturasHabilitadas;
}

export function establecerEscrituras(valor: boolean): void {
  escriturasHabilitadas = valor;
}
