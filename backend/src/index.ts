import "dotenv/config";
import express from "express";
import cors from "cors";
import analyseRouter from "./routes/analyse";
import { errorHandler } from "./middleware/errorHandler";
import logger from "./middleware/logger";

const app = express();
const PORT = process.env.PORT ?? 3001;

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://your-app-name.vercel.app",  // add after you get Vercel URL
  ],
  credentials: true
}));

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
  logger.info(`PO Approval API running on http://localhost:${PORT}`);
});

export default app;
