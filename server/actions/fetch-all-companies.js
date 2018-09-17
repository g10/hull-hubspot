const SyncAgent = require("../lib/sync-agent");

function fetchAllCompaniesAction(req, res) {
  res.end("ok");
  const syncAgent = new SyncAgent(req.hull);
  syncAgent.fetchAllCompanies();
}

module.exports = fetchAllCompaniesAction;
