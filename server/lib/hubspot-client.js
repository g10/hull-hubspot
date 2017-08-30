import Promise from "bluebird";
import request from "superagent";
import prefixPlugin from "superagent-prefix";
import superagentPromisePlugin from "superagent-promise-plugin";

export default class HubspotClient {
  constructor({ ship, client, metric }) {
    this.ship = ship;
    this.client = client;
    this.metric = metric;

    this.req = request;
  }

  attach(req) {
    const accessToken = this.ship.private_settings.token;
    return req
      .use(prefixPlugin(process.env.OVERRIDE_HUBSPOT_URL || "https://api.hubapi.com"))
      .use(superagentPromisePlugin)
      .set("Authorization", `Bearer ${accessToken}`)
      .on("request", (reqData) => {
        this.metric.increment("ship.service_api.call", 1);
        this.client.logger.debug("hubspotClient.req", reqData.url);
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
    this.metric.increment("ship.service_api.call", 1);
    return this.attach(this.req.post("/auth/v1/refresh"))
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send({
        refresh_token: refreshToken,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        redirect_uri: "",
        grant_type: "refresh_token"
      });
  }
}
