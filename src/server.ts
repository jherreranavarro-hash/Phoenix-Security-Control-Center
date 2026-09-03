import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { config, isDemoMode } from "./config";
import { resolverIdentidad } from "./middleware/auth";
import { apiRouter } from "./routes";

const app = express();

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(resolverIdentidad);

app.use("/api", apiRouter);

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[phoenix-security] Error no controlado:", err);
  res.status(500).json({ error: "Error interno del servidor." });
});

app.listen(config.port, () => {
  console.log(`Phoenix Security Control Center escuchando en el puerto ${config.port}`);
  console.log(`Modo demostración: ${isDemoMode ? "ACTIVO (sin credenciales de Microsoft Graph)" : "inactivo (Graph conectado)"}`);
  console.log(`Escrituras contra el tenant: ${config.enableWrites ? "HABILITADAS" : "deshabilitadas"}`);
});
