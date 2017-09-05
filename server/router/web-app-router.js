/* @flow */
import { Router } from "express";
import cors from "cors";
import { notifHandler, responseMiddleware } from "hull/lib/utils";
import requireConfiguration from "../lib/middleware/require-configuration";
import appMiddleware from "../lib/middleware/app";
import * as actions from "../actions";

export default function (deps: any) {
  const router = Router();
  const {
    monitorController,
    fetchAllController,
    notifyController,
    syncController
  } = deps;

  router.use(appMiddleware());

  router.post("/fetchAll", requireConfiguration, fetchAllController.fetchAllAction, responseMiddleware());
  router.post("/sync", requireConfiguration, syncController.syncAction, responseMiddleware());

  router.use("/batch", requireConfiguration, notifHandler({
    handlers: {
      "user:update": actions.handleBatch,
    }
  }));

  router.use("/notify", notifHandler({
    userHandlerOptions: {
      groupTraits: false
    },
    handlers: {
      "segment:update": notifyController.segmentUpdateHandler,
      "segment:delete": notifyController.segmentDeleteHandler,
      "user:update": notifyController.userUpdateHandler,
      "ship:update": notifyController.shipUpdateHandler
    }
  }));

  router.post("/monitor/checkToken", requireConfiguration, monitorController.checkTokenAction, responseMiddleware());

  router.get("/schema/contact_properties", cors(), requireConfiguration, actions.getContactProperties, responseMiddleware());

  router.post("/migrate", requireConfiguration, (req, res, next) => {
    req.shipApp.syncAgent.migrateSettings().then(next, next);
  }, responseMiddleware());

  router.all("/status", actions.statusCheck);

  return router;
}
