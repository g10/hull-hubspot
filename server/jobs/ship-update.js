export default function shipUpdateJob(req) {
  return req.shipApp.syncAgent.setupShip()
  .catch((err) => {
    req.hull.client.logger.error("shipUpdateJob.err", err.stack || err);
  });
}
