import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import multer from "multer";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  (pinoHttp as any)({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const uploadsDir = path.resolve(__dirname, "../uploads");
app.use("/api/uploads", express.static(uploadsDir));

app.use("/api", router);

const clientDistCandidates = [
  path.resolve(__dirname, "../../jimma-mis/dist/public"),
  path.resolve(process.cwd(), "artifacts/jimma-mis/dist/public"),
];
const clientDist = clientDistCandidates.find((dir) => fs.existsSync(dir));

if (clientDist) {
  logger.info({ clientDist }, "Serving static frontend assets");
  app.use(express.static(clientDist));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      return res.sendFile(path.join(clientDist, "index.html"));
    }
    next();
  });
}

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Multer errors (file size, unexpected field, etc.) → 400
  if (err instanceof multer.MulterError) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "File too large. Maximum size is 5 MB." : err.message;
    res.status(400).json({ error: msg });
    return;
  }
  // Custom fileFilter errors (wrong file type) → 400
  if (err instanceof Error && (err.message.includes("Only JPG") || err.message.includes("images are allowed"))) {
    res.status(400).json({ error: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: message });
});

export default app;
