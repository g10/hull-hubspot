import { Router } from "express";
import cors from "cors";
import { notifHandler, batchHandler } from "hull/lib/utils";
import RequireConfiguration from "../lib/middleware/require-configuration";
import AppMiddleware from "../lib/middleware/app";
import * as actions from "../actions";

export default function (deps) {
  const router = Router();
  const {
    batchController,
    monitorController,
    fetchAllController,
    notifyController,
    syncController
  } = deps;

  router.use(AppMiddleware());

  router.post("/fetchAll", RequireConfiguration, fetchAllController.fetchAllAction);
  router.post("/sync", RequireConfiguration, syncController.syncAction);

  router.use("/batch", RequireConfiguration, batchHandler(batchController.handleBatchExtractJob, {}));
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

  router.post("/monitor/checkToken", RequireConfiguration, monitorController.checkTokenAction);

  router.get("/schema/contact_properties", cors(), RequireConfiguration, actions.getContactProperties);

  router.post("/migrate", (req, res, next) => {
    req.shipApp.syncAgent.migrateSettings().then(next, next);
  });

  return router;
}
