/* @flow */
import { Router } from "express";
import cors from "cors";
import { notifHandler, batchHandler, responseMiddleware } from "hull/lib/utils";
import RequireConfiguration from "../lib/middleware/require-configuration";
import AppMiddleware from "../lib/middleware/app";
import * as actions from "../actions";

export default function (deps: any) {
  const router = Router();
  const {
    batchController,
    monitorController,
    fetchAllController,
    notifyController,
    syncController
  } = deps;

  router.use(AppMiddleware());

  router.post("/fetchAll", RequireConfiguration, fetchAllController.fetchAllAction, responseMiddleware());
  router.post("/sync", RequireConfiguration, syncController.syncAction, responseMiddleware());

  router.use("/batch", RequireConfiguration, batchHandler(batchController.batchExtractJobHandler));
  router.use("/notify", RequireConfiguration, notifHandler({
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

  router.post("/monitor/checkToken", RequireConfiguration, monitorController.checkTokenAction, responseMiddleware());

  router.get("/schema/contact_properties", cors(), RequireConfiguration, actions.getContactProperties, responseMiddleware());

  router.post("/migrate", RequireConfiguration, (req, res, next) => {
    req.shipApp.syncAgent.migrateSettings().then(next, next);
  }, responseMiddleware());

  return router;
}
