export default function shipUpdateHandler(ctx) {
  const { syncAgent } = ctx.shipApp;
  if (!syncAgent.isConfigured()) {
    ctx.client.logger.error("connector.configuration.error", { errors: "connector is not configured" });
    return Promise.resolve();
  }
  return ctx.shipApp.syncAgent.setupShip()
    .catch((err) => {
      ctx.client.logger.error("shipUpdateJob.err", err.stack || err);
    });
}
