/* @flow */
import { Router } from "express";
import { Strategy as HubspotStrategy } from "passport-hubspot";
import { oAuthHandler } from "hull/lib/utils";
import moment from "moment";

export default function (deps: any) {
  const router = Router();

  const {
    clientID,
    clientSecret
  } = deps;

  router.use("/auth", oAuthHandler({
    name: "Hubspot",
    Strategy: HubspotStrategy,
    options: {
      clientID,
      clientSecret,
      scope: ["offline", "contacts-rw", "events-rw"]
    },
    isSetup(req) {
      const { client, ship } = req.hull;
      if (req.query.reset) return Promise.reject();
      const { token } = ship.private_settings || {};
      if (token) {
        // TODO: we have notices problems with syncing hull segments property
        // TODO: check if below code works after hull-node upgrade.
        // after a Hubspot resync, there may be a problem with notification
        // subscription. Following two lines fixes that problem.
        // AppMiddleware({ queueAdapter, shipCache, instrumentationAgent })(req, {}, () => {});
        req.hull.shipApp.syncAgent.setupShip()
          .catch(err => client.logger.error("Error in creating segments property", err));

        return client.get(ship.id).then((s) => {
          return { settings: s.private_settings };
        });
      }
      return Promise.reject();
    },
    onLogin: (req) => {
      const { helpers } = req.hull;
      req.authParams = { ...req.body, ...req.query };
      const newShip = {
        portal_id: req.authParams.portalId
      };
      return helpers.updateSettings(newShip);
    },
    onAuthorize: (req) => {
      const { helpers } = req.hull;
      const { refreshToken, accessToken, expiresIn } = (req.account || {});
      const newShip = {
        refresh_token: refreshToken,
        token: accessToken,
        expires_in: expiresIn,
        token_fetched_at: moment().utc().format("x"),
      };
      return helpers.updateSettings(newShip);
    },
    views: {
      login: "login.html",
      home: "home.html",
      failure: "failure.html",
      success: "success.html"
    },
  }));

  return router;
}
