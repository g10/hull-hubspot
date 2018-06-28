// @flow
import type { IncomingMessage } from "http";
import type { THullConnector, THullReqContext } from "hull";
import type {
  HubspotUserUpdateMessageEnvelope,
  HubspotContactPropertyGroups,
  HubspotReadContact
} from "../types";

declare type HubspotGetAllContactsResponse = {
  ...IncomingMessage,
  body: {
    contacts: Array<HubspotReadContact>,
    "has-more": boolean,
    "time-offset": string,
    "vid-offset": string
  }
};

const _ = require("lodash");
const Promise = require("bluebird");
const superagent = require("superagent");
const prefixPlugin = require("superagent-prefix");
// const promiseRetry = require("promise-retry");
const moment = require("moment");
const stream = require("stream");

const {
  superagentUrlTemplatePlugin,
  superagentInstrumentationPlugin
} = require("hull/lib/utils");

class HubspotClient {
  connector: THullConnector;
  client: Object;
  metric: Object;
  agent: superagent;
  helpers: Object;

  constructor({ ship, client, metric, helpers }: THullReqContext) {
    this.connector = ship;
    this.client = client;
    this.metric = metric;
    this.helpers = helpers;

    const accessToken = this.connector.private_settings.token;
    this.agent = superagent
      .agent()
      .use(superagentUrlTemplatePlugin({}))
      .use(superagentInstrumentationPlugin({ logger: client.logger, metric }))
      .use(
        prefixPlugin(
          process.env.OVERRIDE_HUBSPOT_URL || "https://api.hubapi.com"
        )
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .timeout({ response: 5000 });
  }

  // get(url: string): superagent {
  //   return this.agent.get(url);
  // }

  // post(url: string): superagent {
  //   return this.agent.post(url);
  // }

  // put(url: string): superagent {
  //   return this.agent.put(url);
  // }

  refreshAccessToken(): Promise<*> {
    const refreshToken = this.connector.private_settings.refresh_token;
    if (!refreshToken) {
      return Promise.reject(new Error("Refresh token is not set."));
    }
    this.metric.increment("ship.service_api.call", 1);
    return this.agent
      .post("/oauth/v1/token")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send({
        refresh_token: refreshToken,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        redirect_uri: "",
        grant_type: "refresh_token"
      });
  }

  isConfigured() {
    return !_.isEmpty(this.connector.private_settings.token);
  }

  /**
   * This is a wrapper which handles the access_token errors for hubspot queries
   * and runs `checkToken` to make sure that our token didn't expire.
   * Then it retries the query once.
   * @param {Promise} promise
   */
  retryUnauthorized(promise: () => Promise<mixed>): Promise<*> {
    return promise().catch(err => {
      if (err.response.unauthorized) {
        this.client.logger.debug("retrying query", _.get(err, "response.body"));
        console.log("CHECKING TOKEN");
        return this.checkToken({ force: true })
          .then(() => {
            console.log("CHECKED TOKEN");
            // this.hubspotClient.ship = this.ship;
            return true;
          })
          .then(() => promise());
      }
      return Promise.reject(err);
    });
  }

  checkToken({ force = false }: { force: boolean } = {}): Promise<*> {
    let { token_fetched_at, expires_in } = this.connector.private_settings;
    if (!token_fetched_at || !expires_in) {
      this.client.logger.error(
        "checkToken: Ship private settings lack token information"
      );
      token_fetched_at = moment()
        .utc()
        .format("x");
      expires_in = 0;
    }

    const expiresAt = moment(token_fetched_at, "x").add(expires_in, "seconds");
    const willExpireIn = expiresAt.diff(moment(), "seconds");
    const willExpireSoon =
      willExpireIn <= (parseInt(process.env.HUBSPOT_TOKEN_REFRESH_ADVANCE, 10) || 600); // 10 minutes
    this.client.logger.debug("access_token", {
      fetched_at: moment(token_fetched_at, "x").format(),
      expires_in,
      expires_at: expiresAt.format(),
      will_expire_in: willExpireIn,
      utc_now: moment().format(),
      will_expire_soon: willExpireSoon
    });
    if (willExpireSoon || force) {
      return this.refreshAccessToken()
        .catch(refreshErr => {
          this.client.logger.error("Error in refreshAccessToken", refreshErr);
          return Promise.reject(refreshErr);
        })
        .then(res => {
          this.agent.set("Authorization", `Bearer ${res.body.access_token}`);
          return this.helpers.updateSettings({
            expires_in: res.body.expires_in,
            token_fetched_at: moment()
              .utc()
              .format("x"),
            token: res.body.access_token
          });
        });
    }
    return Promise.resolve("valid");
  }

  /**
   * Get 100 hubspot contacts and queues their import
   * and getting another 100 - needs to be processed in one queue without
   * any concurrency
   * @see http://developers.hubspot.com/docs/methods/contacts/get_contacts
   * @param  {Number} [count=100]
   * @param  {Number} [offset=0]
   * @return {Promise}
   */
  getAllContacts(
    properties: Array<string>,
    count: number = 100,
    offset: number = 0
  ): Promise<HubspotGetAllContactsResponse> {
    return this.retryUnauthorized(() => {
      return this.agent.get("/contacts/v1/lists/all/contacts/all").query({
        count,
        vidOffset: offset,
        property: properties
      });
    });
  }

  getAllContactsStream(
    properties: Array<string>,
    count: number = 100,
    offset: ?string = null
  ): stream.Duplex {
    const duplexStream = new stream.Duplex({
      objectMode: true,
      read() {},
      write() {}
    });
    const getAllContacts = this.getAllContacts.bind(this);

    function getAllContactsPage(pageCount, pageOffset) {
      return getAllContacts(properties, pageCount, pageOffset).then(
        response => {
          const contacts = response.body.contacts;
          const hasMore = response.body["has-more"];
          const vidOffset = response.body["vid-offset"];
          if (contacts.length > 0) {
            duplexStream.push(contacts);
            if (hasMore) {
              return getAllContactsPage(pageCount, vidOffset);
            }
          }
          return Promise.resolve();
        }
      );
    }

    getAllContactsPage(count, offset)
      .then(() => duplexStream.push(null))
      .catch(error => duplexStream.destroy(error));
    return duplexStream;
  }

  /**
   * Get most recent contacts and filters out these who last modification
   * time if older that the lastFetchAt. If there are any contacts modified since
   * that time queues import of them and getting next chunk from hubspot API.
   * @see http://developers.hubspot.com/docs/methods/contacts/get_recently_updated_contacts
   * @param  {Date} lastFetchAt
   * @param  {Date} stopFetchAt
   * @param  {Number} [count=100]
   * @param  {Number} [offset=0]
   * @return {Promise -> Array}
   */
  getRecentlyUpdatedContacts(
    properties: Array<string>,
    count: number = 100,
    offset: ?string = null
  ): Promise<IncomingMessage> {
    console.log(">>> getRecentlyUpdatedContacts");
    return this.retryUnauthorized(() => {
      return this.agent
        .get("/contacts/v1/lists/recently_updated/contacts/recent")
        .query({
          count,
          vidOffset: offset,
          property: properties
        });
    });
  }

  getRecentContactsStream(
    lastFetchAt: moment,
    stopFetchAt: moment,
    properties: Array<string>,
    count: number = 100,
    offset: ?string = null
  ): stream.Duplex {
    console.log(">> getRecentContactsStream", lastFetchAt, stopFetchAt);
    const duplexStream = new stream.Duplex({
      objectMode: true,
      read() {},
      write() {}
    });
    const getRecentlyUpdatedContacts = this.getRecentlyUpdatedContacts.bind(
      this
    );

    function getRecentContactsPage(pageCount, pageOffset) {
      return getRecentlyUpdatedContacts(properties, pageCount, pageOffset).then(
        response => {
          const contacts = response.body.contacts.filter(c => {
            const time = moment(
              c.properties.lastmodifieddate.value,
              "x"
            ).milliseconds(0);
            console.log(">>> time", time);
            return (
              time.isAfter(lastFetchAt) &&
              time
                .subtract(
                  process.env.HUBSPOT_FETCH_OVERLAP_SEC || 10,
                  "seconds"
                )
                .isBefore(stopFetchAt)
            );
          });
          const hasMore = response.body["has-more"];
          const vidOffset = response.body["vid-offset"];
          const timeOffset = response.body["time-offset"];
          if (contacts.length > 0) {
            duplexStream.push(contacts);
            if (hasMore) {
              return getRecentContactsPage(pageCount, vidOffset);
            }
          }
        }
      );
    }

    getRecentContactsPage(count, offset)
      .then(() => duplexStream.push(null))
      .catch(error => duplexStream.destroy(error));
    return duplexStream;
  }

  postContacts(
    envelopes: Array<HubspotUserUpdateMessageEnvelope>
  ): Promise<Array<HubspotUserUpdateMessageEnvelope>> {
    const body = envelopes.map(envelope => envelope.hubspotWriteContact);
    return this.retryUnauthorized(() => {
      return this.agent
        .post("/contacts/v1/contact/batch/")
        .query({
          auditId: "Hull"
        })
        .set("Content-Type", "application/json")
        .send(body);
    })
      .then(res => {
        if (res.statusCode === 202) {
          return Promise.resolve(envelopes);
        }
        const erroredOutEnvelopes = envelopes.map(envelope => {
          envelope.error = "unknown response from hubspot";
          return envelope;
        });
        return Promise.resolve(erroredOutEnvelopes);
      })
      .catch(responseError => {
        let parsedErrorInfo = {};
        try {
          parsedErrorInfo = JSON.parse(responseError.extra);
        } catch (e) {} // eslint-disable-line no-empty
        if (parsedErrorInfo.status !== "error") {
          const erroredOutEnvelopes = envelopes.map(envelope => {
            envelope.error = "unknown response from hubspot";
            return envelope;
          });
          return Promise.resolve(erroredOutEnvelopes);
        }
        const erroredOutEnvelopes = _.get(
          parsedErrorInfo,
          "failureMessages",
          []
        ).map(error => {
          const envelope = envelopes[error.index];
          const hubspotMessage =
            error.propertyValidationResult &&
            _.truncate(error.propertyValidationResult.message, {
              length: 100
            });
          const hubspotPropertyName =
            error.propertyValidationResult &&
            error.propertyValidationResult.name;
          envelope.error = hubspotMessage || error.message;
          envelope.errorProperty = hubspotPropertyName;
          return envelope;
        });

        const retryEnvelopes = envelopes.filter((envelope, index) => {
          return !_.find(parsedErrorInfo.failureMessages, { index });
        });

        if (retryEnvelopes.length === 0) {
          return Promise.resolve(erroredOutEnvelopes);
        }
        const retryBody = envelopes.map(
          envelope => envelope.hubspotWriteContact
        );
        return this.agent
          .post("/contacts/v1/contact/batch/")
          .query({
            auditId: "Hull"
          })
          .set("Content-Type", "application/json")
          .send(retryBody)
          .then(res => {
            if (res.statusCode === 202) {
              return Promise.resolve(envelopes);
            }
            const retryErroredOutEnvelopes = envelopes.map(envelope => {
              envelope.error = "unknown response from hubspot";
              return envelope;
            });
            return Promise.resolve(retryErroredOutEnvelopes);
          })
          .catch(() => {
            const retryErroredOutEnvelopes = envelopes.map(envelope => {
              envelope.error = "batch retry rejected";
              return envelope;
            });
            return Promise.resolve(retryErroredOutEnvelopes);
          });
      });
  }

  getContactPropertyGroups(): Promise<HubspotContactPropertyGroups> {
    return this.retryUnauthorized(() => {
      return this.agent
        .get("/contacts/v2/groups")
        .query({ includeProperties: true })
        .then(response => response.body);
    });
  }
}

module.exports = HubspotClient;
