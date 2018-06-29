const SyncAgent = require("./lib/sync-agent");

module.exports = {
  "user:update": (ctx, messages) => {
    if (ctx.smartNotifierResponse) {
      ctx.smartNotifierResponse.setFlowControl({
        type: "next",
        size: 100,
        in: 1
      });
    }
    const syncAgent = new SyncAgent(ctx);
    return syncAgent.sendUserUpdateMessages(messages);
  },
  "ship:update": ctx => {
    if (ctx.smartNotifierResponse) {
      ctx.smartNotifierResponse.setFlowControl({
        type: "next",
        size: 1,
        in: 1
      });
    }
    const syncAgent = new SyncAgent(ctx);
    return syncAgent.syncConnector();
  },
  "segment:update": ctx => {
    if (ctx.smartNotifierResponse) {
      ctx.smartNotifierResponse.setFlowControl({
        type: "next",
        size: 1,
        in: 1
      });
    }
    const syncAgent = new SyncAgent(ctx);
    return syncAgent.syncConnector();
  }
};
