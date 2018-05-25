/* @flow */
const { Request, Response } = require("express");
const _ = require("lodash");

function getContactProperties(req: Request, res: Response) {
  const { hubspotClient } = req.hull.shipApp;
  const { cache } = req.hull;

  return cache
    .wrap("contact_properties", () => {
      return hubspotClient
        .get("/contacts/v2/groups")
        .query({ includeProperties: true })
        .then(response => {
          return response.body;
        });
    })
    .then(groups => {
      res.json({
        options: groups.map(group => {
          return {
            label: group.displayName,
            options: _.chain(group.properties)
              .map(prop => {
                return {
                  label: prop.label,
                  value: prop.name
                };
              })
              .value()
          };
        })
      });
    })
    .catch(err => {
      req.hull.client.logger.error(err);
      res.json({ options: [] });
    });
}

module.exports = getContactProperties;
