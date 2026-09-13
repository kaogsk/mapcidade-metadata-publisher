import express, { type Express } from "express";
import { createRouter, type RouterDeps } from "./routes.js";

export function createApp(deps: RouterDeps): Express {
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  // CORS simples para o frontend Next.js em dev.
  const origin = process.env.CORS_ORIGIN ?? "*";
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use("/api", createRouter(deps));
  return app;
}
