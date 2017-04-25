import _ from "lodash";

export default function getContactProperties(req, res) {
  const { hubspotClient, hullClient } = req.shipApp;

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
      hullClient.logger.error(err);
      res.json({ options: [] });
    });
}
