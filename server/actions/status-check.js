/* @flow */

import { Request, Response } from "express";
import _ from "lodash";

export default function (req: Request, res: Response) {
  const { ship = {}, client = {}, shipApp = {} } = req.hull;
  const messages = [];
  let status = "ok";
  const pushMessage = (message) => {
    status = "error";
    messages.push(message);
  };
  const promises = [];


  if (!_.get(ship, "private_settings.token")) {
    pushMessage("Missing API token.");
  }

  if (!_.get(ship, "private_settings.refresh_token")) {
    pushMessage("Missing refresh token.");
  }

  if (!_.get(ship, "private_settings.portal_id")) {
    pushMessage("Missing portal id.");
  }

  if (_.isEmpty(_.get(ship, "private_settings.sync_fields_to_hubspot", []))) {
    pushMessage("No fields are going to be sent from hull to hubspot because of missing configuration.");
  }

  if (_.isEmpty(_.get(ship, "private_settings.sync_fields_to_hull", []))) {
    pushMessage("No fields are going to be sent from hubspot to hull because of missing configuration.");
  }

  if (_.isEmpty(_.get(ship, "private_settings.synchronized_segments", []))) {
    pushMessage("No segments will be synchronized because of missing configuration.");
  }

  if (_.get(shipApp, "hubspotAgent")) {
    if (_.get(ship, "private_settings.token")) {
      promises.push(shipApp.hubspotAgent.getContacts({}, 1).then(results => {
        if (results.body.contacts && results.body.contacts.length === 0) {
          pushMessage("Got Zero results when fetching contacts.");
        }
      }).catch(err => {
        pushMessage(`Could not get response from Hubspot due to error ${_.get(err, "msg", _.get(err, "message", ""))}`);
      }));
      promises.push(shipApp.hubspotClient.get("/contacts/v2/groups").query({ includeProperties: true }).then(result => {
        if (!_.find(result.body, g => g.name === "hull")) {
          pushMessage("Hubspot is not properly configured. Missing hull group");
        } else if (!_.find(result.body, g => g.displayName === "Hull Properties")) {
          pushMessage("Hubspot is not properly configured. Missing hull group name");
        } else if (!_.find(result.body.filter(g => g.name === "hull"), g => _.includes(g.properties.map(p => p.name), "hull_segments"))) {
          pushMessage("Hubspot is not properly configured. Missing hull segments as hull group property");
        }
      }).catch(err => {
        pushMessage(`Could not get response from Hubspot due to error ${_.get(err, "msg", _.get(err, "message", ""))}`);
      }));
    }
  } else {
    pushMessage("Connector is missing configuration.");
  }

  Promise.all(promises).then(() => {
    res.json({ status, messages });
    return client.put(ship.id, { status, status_messages: messages });
  });
}
