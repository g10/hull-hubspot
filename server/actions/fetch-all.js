const SyncAgent = require("../lib/sync-agent");

function fetchAllAction(req, res) {
  res.end("ok");
  const syncAgent = new SyncAgent(req.hull);
  syncAgent.fetchAllContacts();
}

module.exports = fetchAllAction;
