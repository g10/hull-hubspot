/* global describe, it */
import Hull from "hull";
import express from "express";
import nock from "nock";
import request from "request";

import BatchController from "../server/controller/batch";
import MonitorController from "../server/controller/monitor";
import UsersController from "../server/controller/users";
import FetchAllController from "../server/controller/fetch-all";
import SyncController from "../server/controller/sync";
import NotifyController from "../server/controller/notify";
import WebAppRouter from "../server/router/web-app-router";
import WebOauthRouter from "../server/router/web-oauth-router";
import WebKueRouter from "../server/router/kue";
import ClientMock from "./mocks/client-mock";

const assert = require("assert");

const controllers = {
  batchController: BatchController,
  monitorController: MonitorController,
  fetchAllController: FetchAllController,
  usersController: UsersController,
  notifyController: NotifyController,
  syncController: SyncController
};
const app = express();

const connector = new Hull.Connector({ hostSecret: 1234, port: 8070 });
const clientID = 123;
const clientSecret = "123";
connector.setupApp(app);

connector.queue.adapter.app = (req, res, next) => { return next(); }; // Memory queue does not have app field


app.use((req, res, next) => {
  req.hull = {
    client: ClientMock(),
    ship: {
      private_settings: {
        token: "12345"
      }
    },
    metric: {
      increment: () => {}
    }
  };

  next();
});

app.use("/", WebAppRouter({ ...controllers }))
  .use("/", WebOauthRouter({ clientID, clientSecret }))
  .use("/kue", WebKueRouter({ hostSecret: 1234 }, connector.queue));


connector.startApp(app);

const hubspotMock =
  nock("https://api.hubapi.com")
    .get("/contacts/v2/groups")
    .query(true)
    .reply(200, [
      {
        displayName: "display",
        properties: [
          {
            label: "coke",
            name: "shortName"
          }
        ]
      }
    ]);

describe("Server", () => {
  describe("for /schema/contact_properties", () => {
    it("should return status OK with data from hubspot", (done) => {
      let body = "";

      request
        .get("http://127.0.0.1:8070/schema/contact_properties")
        .on("response", (response) => {
          assert(response.statusCode === 200);
          hubspotMock.done();
        })
        .on("data", (data) => {
          body += data;
        });

      setTimeout(() => {
        const parsedBody = JSON.parse(body).options[0];
        assert(parsedBody.label === "display");
        assert(parsedBody.options[0].label === "coke");
        assert(parsedBody.options[0].value === "shortName");
        done();
      }, 100);
    });
  });
});
