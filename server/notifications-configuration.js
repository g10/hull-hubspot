const SyncAgent = require("./lib/sync-agent");

module.exports = {
  "user:update": (ctx, messages) => {
    const syncAgent = new SyncAgent(ctx);
    return syncAgent.sendUserUpdateMessages(messages);
  },
  "ship:update": ctx => {
    const syncAgent = new SyncAgent(ctx);
    return syncAgent.syncConnector();
  },
  "segment:update": ctx => {
    const syncAgent = new SyncAgent(ctx);
    return syncAgent.syncConnector();
  }
};
