import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { CambioGobernado, RegistroAuditoria } from "../types";

/**
 * Almacén de gobierno persistido en un archivo JSON local.
 *
 * Phoenix aún no cuenta con suscripción Azure ni base de datos gestionada
 * para este módulo, así que la trazabilidad de cambios, aprobaciones y la
 * bitácora de auditoría se guardan aquí. Cuando exista Azure SQL / Cosmos DB
 * disponible, esta clase puede sustituirse manteniendo la misma interfaz.
 */

interface EstadoAlmacen {
  cambios: CambioGobernado[];
  auditoria: RegistroAuditoria[];
  overridesDirectorio: {
    usuariosCreados: Record<string, unknown>[];
    usuariosBloqueados: string[];
    gruposCreados: Record<string, unknown>[];
    membresias: Record<string, string[]>;
    licenciasAsignadas: Record<string, string[]>;
    exchangeConfig: Record<string, Record<string, unknown>>;
    roles: Record<string, string[]>;
  };
  campañasLicencia: Record<string, unknown>[];
}

const DATA_DIR = join(__dirname, "..", "..", "data");
const DATA_FILE = join(DATA_DIR, "store.json");

function estadoInicial(): EstadoAlmacen {
  return {
    cambios: [],
    auditoria: [],
    overridesDirectorio: {
      usuariosCreados: [],
      usuariosBloqueados: [],
      gruposCreados: [],
      membresias: {},
      licenciasAsignadas: {},
      exchangeConfig: {},
      roles: {},
    },
    campañasLicencia: [],
  };
}

class AlmacenGobierno {
  private estado: EstadoAlmacen;

  constructor() {
    this.estado = this.cargar();
  }

  private cargar(): EstadoAlmacen {
    try {
      if (existsSync(DATA_FILE)) {
        const contenido = readFileSync(DATA_FILE, "utf-8");
        return { ...estadoInicial(), ...JSON.parse(contenido) };
      }
    } catch (error) {
      console.error("[phoenix-security] No se pudo leer el almacén, se inicia en blanco:", error);
    }
    return estadoInicial();
  }

  private guardar(): void {
    try {
      if (!existsSync(dirname(DATA_FILE))) {
        mkdirSync(dirname(DATA_FILE), { recursive: true });
      }
      writeFileSync(DATA_FILE, JSON.stringify(this.estado, null, 2), "utf-8");
    } catch (error) {
      console.error("[phoenix-security] No se pudo persistir el almacén:", error);
    }
  }

  // --- Cambios gobernados ---
  listarCambios(): CambioGobernado[] {
    return this.estado.cambios;
  }

  obtenerCambio(id: string): CambioGobernado | undefined {
    return this.estado.cambios.find((c) => c.id === id);
  }

  guardarCambio(cambio: CambioGobernado): void {
    const idx = this.estado.cambios.findIndex((c) => c.id === cambio.id);
    if (idx >= 0) this.estado.cambios[idx] = cambio;
    else this.estado.cambios.unshift(cambio);
    this.guardar();
  }

  // --- Auditoría ---
  registrarAuditoria(registro: RegistroAuditoria): void {
    this.estado.auditoria.unshift(registro);
    if (this.estado.auditoria.length > 5000) {
      this.estado.auditoria = this.estado.auditoria.slice(0, 5000);
    }
    this.guardar();
  }

  listarAuditoria(limite = 200): RegistroAuditoria[] {
    return this.estado.auditoria.slice(0, limite);
  }

  // --- Overrides de directorio (solo aplican en modo demostración) ---
  get overrides() {
    return this.estado.overridesDirectorio;
  }

  guardarOverrides(): void {
    this.guardar();
  }

  // --- Campañas de licencias ---
  registrarCampaña(registro: Record<string, unknown>): void {
    this.estado.campañasLicencia.unshift(registro);
    this.guardar();
  }

  listarCampañas(): Record<string, unknown>[] {
    return this.estado.campañasLicencia;
  }
}

export const almacen = new AlmacenGobierno();
