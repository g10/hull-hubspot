export default function requireConfiguration(req, res, next) {
  if (!req.hull.shipApp.syncAgent.isConfigured()) {
    req.hull.client.logger.info("ship is not configured");
    return res.status(403).send("Ship is not configured");
  }
  return next();
}
