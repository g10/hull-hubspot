/* @flow */
import type { $Response } from "express";
import type { THullRequest } from "hull";

const SyncAgent = require("../lib/sync-agent");

function getContactProperties(req: THullRequest, res: $Response) {
  const syncAgent = new SyncAgent(req.hull);

  syncAgent.getContactProperties().then(contactProperties => {
    res.json(contactProperties);
  });
}

module.exports = getContactProperties;
