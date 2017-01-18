import Promise from "bluebird";
import request from "superagent";
import prefixPlugin from "superagent-prefix";
import superagentPromisePlugin from "superagent-promise-plugin";

export default class HubspotClient {
  constructor({ ship, hullClient, instrumentationAgent }) {
    this.ship = ship;
    this.hullClient = hullClient;
    this.instrumentationAgent = instrumentationAgent;

    this.req = request;
  }

  attach(req) {
    const accessToken = this.ship.private_settings.token;
    return req
      .use(prefixPlugin("https://api.hubapi.com"))
      .use(superagentPromisePlugin)
      .query({ access_token: accessToken })
      .on("request", (reqData) => {
        this.instrumentationAgent.metricInc("ship.service_api.call", 1, this.hullClient.configuration());
        this.hullClient.logger.info("hubspotClient.req", reqData.url);
      });
  }

  get(url) {
    const req = this.req.get(url);
    return this.attach(req);
  }

  post(url) {
    const req = this.req.post(url);
    return this.attach(req);
  }

  put(url) {
    const req = this.req.put(url);
    return this.attach(req);
  }

  refreshAccessToken() {
    const refreshToken = this.ship.private_settings.refresh_token;
    if (!refreshToken) {
      return Promise.reject(new Error("Refresh token is not set."));
    }
    this.instrumentationAgent.metricInc("ship.service_api.call", 1, this.hullClient.configuration());
    return this.attach(this.req.post("/auth/v1/refresh"))
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send({
        refresh_token: refreshToken,
        client_id: process.env.CLIENT_ID,
        grant_type: "refresh_token"
      });
  }
}
