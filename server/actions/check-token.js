const SyncAgent = require("../lib/sync-agent");

function checkTokenAction(req, res) {
  res.end("ok");
  const syncAgent = new SyncAgent(req.hull);
  syncAgent.checkToken();
}

module.exports = checkTokenAction;
