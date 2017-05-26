export default function shipUpdateJob(ctx) {
  return ctx.shipApp.syncAgent.setupShip()
  .catch((err) => {
    ctx.client.logger.error("shipUpdateJob.err", err.stack || err);
  });
}
