/* @flow */
import type { $Request, $Response, NextFunction } from "express";

function requireConfiguration(
  req: $Request,
  res: $Response,
  next: NextFunction
) {
  if (!req.hull.shipApp.syncAgent.isConfigured()) {
    req.hull.client.logger.error("connector.configuration.error", {
      errors: "connector is not configured"
    });
    return res.status(403).send("Connector is not configured");
  }
  return next();
}

module.exports = requireConfiguration;
