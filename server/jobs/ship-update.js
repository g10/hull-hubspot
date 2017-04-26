export default function shipUpdateJob(req) {
  return req.hull.shipApp.syncAgent.setupShip()
  .catch((err) => {
    req.hull.client.logger.error("shipUpdateJob.err", err.stack || err);
  });
}
