/* @flow */
import { Strategy as HubspotStrategy } from "passport-hubspot-oauth2.0";
import { oAuthHandler } from "hull/lib/utils";
import moment from "moment";
import Promise from "bluebird";

export default function (deps: Object) {
  const {
    clientID,
    clientSecret
  } = deps;

  return oAuthHandler({
    name: "Hubspot",
    Strategy: HubspotStrategy,
    options: {
      clientID,
      clientSecret,
      scope: ["oauth", "contacts", "timeline"]
    },
    isSetup(req) {
      const { client, ship } = req.hull;
      if (req.query.reset) return Promise.reject(new Error("Requested reset"));
      const { token } = ship.private_settings || {};
      if (token) {
        // TODO: we have notices problems with syncing hull segments property
        // TODO: check if below code works after hull-node upgrade.
        // after a Hubspot resync, there may be a problem with notification
        // subscription. Following two lines fixes that problem.
        // AppMiddleware({ queueAdapter, shipCache, instrumentationAgent })(req, {}, () => {});
        req.hull.shipApp.syncAgent.setupShip()
          .catch(err => client.logger.error("connector.configuration.error", { errors: ["Error in creating segments property", err] }));

        return client.get(ship.id).then((s) => {
          return { settings: s.private_settings };
        });
      }
      return Promise.reject(new Error("Not authorized"));
    },
    onLogin: (req) => {
      req.authParams = { ...req.body, ...req.query };
      return Promise.resolve();
    },
    onAuthorize: (req) => {
      const { helpers } = req.hull;
      const { refreshToken, accessToken } = (req.account || {});
      const { expiresIn } = req.account.params;
      return req.hull.shipApp.hubspotClient.get(`/oauth/v1/access-tokens/${accessToken}`)
        .then(res => {
          const portalId = res.body.hub_id;
          const newShip = {
            portal_id: portalId,
            refresh_token: refreshToken,
            token: accessToken,
            expires_in: expiresIn,
            token_fetched_at: moment().utc().format("x"),
          };
          return helpers.updateSettings(newShip);
        });
    },
    views: {
      login: "login.html",
      home: "home.html",
      failure: "failure.html",
      success: "success.html"
    },
  });
}
