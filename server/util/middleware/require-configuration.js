/**
 * This Middleware makes sure that we have the ship configured to make
 * 3rd API calls
 * @param  {Object}   req
 * @param  {Object}   res
 * @param  {Function} next
 */
export default function requireConfiguration(req, res, next) {
  if (!req.shipApp.syncAgent.isConfigured()) {
    req.hull.client.logger.info("ship is not configured");
    return res.status(403).send("Ship is not configured");
  }
  return next();
}
