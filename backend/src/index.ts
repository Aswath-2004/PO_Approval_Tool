import "dotenv/config";
import express from "express";
import cors from "cors";
import analyseRouter from "./routes/analyse";
import { errorHandler } from "./middleware/errorHandler";
import logger from "./middleware/logger";

const app = express();
const PORT = process.env.PORT ?? 3001;

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://po-approval-tool.vercel.app", // ✅ no trailing slash
    ],
    credentials: true,
  })
);

// ✅ MUST HAVE: JSON body parsing
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.debug({ method: req.method, path: req.path }, "Incoming request");
  next();
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use("/api", analyseRouter);

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`PO Approval API running on port ${PORT}`);
});

export default app;