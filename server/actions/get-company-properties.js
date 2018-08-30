/* @flow */
import type { $Response } from "express";
import type { THullRequest } from "hull";

const SyncAgent = require("../lib/sync-agent");

function getCompanyProperties(req: THullRequest, res: $Response) {
  const syncAgent = new SyncAgent(req.hull);

  syncAgent.getCompanyProperties().then(companyProperties => {
    res.json(companyProperties);
  });
}

module.exports = getCompanyProperties;
