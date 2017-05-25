/* @flow */
import { Request, Response } from "express";
import _ from "lodash";

export default function getContactProperties(req: Request, res: Response) {
  const { hubspotClient } = req.hull.shipApp;

  return hubspotClient.get("/contacts/v2/groups")
    .query({ includeProperties: true })
    .then(({ body: groups }) => {
      res.json({ options: groups.map((group) => {
        return {
          label: group.displayName,
          options: _.chain(group.properties)
            .map((prop) => {
              return {
                label: prop.label,
                value: prop.name
              };
            })
            .value()
        };
      })
      });
    }).catch((err) => {
      req.hull.client.logger.error(err);
      res.json({ options: [] });
    });
}
