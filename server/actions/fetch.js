/* @flow */
const { Request, Response } = require("express");
const SyncAgent = require("../lib/sync-agent");

/**
 * Handles operation for automatic sync changes of hubspot profiles
 * to hull users.
 */
function fetchAction(req: Request, res: Response) {
  const ctx = req.hull;
  res.json({ ok: true });
  const syncAgent = new SyncAgent(ctx);
  syncAgent.fetchRecentContacts();
}

module.exports = fetchAction;
