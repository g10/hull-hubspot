import Promise from "bluebird";
import request from "superagent";
import prefixPlugin from "superagent-prefix";

const { superagentUrlTemplatePlugin, superagentInstrumentationPlugin } = require("hull/lib/utils");

export default class HubspotClient {
  constructor({ ship, client, metric }) {
    this.ship = ship;
    this.client = client;
    this.metric = metric;

    const accessToken = this.ship.private_settings.token;
    this.agent = request.agent()
      .use(superagentUrlTemplatePlugin({}))
      .use(superagentInstrumentationPlugin({ logger: client.logger, metric }))
      .use(prefixPlugin(process.env.OVERRIDE_HUBSPOT_URL || "https://api.hubapi.com"))
      .set("Authorization", `Bearer ${accessToken}`)
      .timeout({ response: 5000 });
  }

  get(url) {
    return this.agent.get(url);
  }

  post(url) {
    return this.agent.post(url);
  }

  put(url) {
    return this.agent.put(url);
  }

  refreshAccessToken() {
    const refreshToken = this.ship.private_settings.refresh_token;
    if (!refreshToken) {
      return Promise.reject(new Error("Refresh token is not set."));
    }
    this.metric.increment("ship.service_api.call", 1);
    return this.agent.post("/oauth/v1/token")
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
