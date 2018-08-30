const SyncAgent = require("./lib/sync-agent");

module.exports = {
  "user:update": (ctx, messages) => {
    if (ctx.smartNotifierResponse) {
      ctx.smartNotifierResponse.setFlowControl({
        type: "next",
        size: parseInt(process.env.FLOW_CONTROL_SIZE, 10) || 100,
        in: parseInt(process.env.FLOW_CONTROL_IN, 10) || 10,
        in_time: parseInt(process.env.FLOW_CONTROL_IN_TIME, 10) || 10
      });
    }
    const syncAgent = new SyncAgent(ctx);
    return syncAgent.sendUserUpdateMessages(messages);
  },
  "account:update": (ctx, messages) => {
    const syncAgent = new SyncAgent(ctx);
    return syncAgent.sendAccountUpdateMessages(messages);
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
  "users_segment:update": ctx => {
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
