/* @flow */
import { Request, Response, Next } from "express";

export default function requireConfiguration(req: Request, res: Response, next: Next) {
  if (!req.hull.shipApp.syncAgent.isConfigured()) {
    req.hull.client.logger.error("connector.configuration.error", { errors: "connector is not configured" });
    return res.status(403).send("Connector is not configured");
  }
  return next();
}
