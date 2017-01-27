import Promise from "bluebird";
import _ from "lodash";

export default function getContactProperties(req, res) {
  const { hubspotClient } = req.shipApp;

  return Promise.all([
    hubspotClient.get("/properties/v1/contacts/properties"),
    hubspotClient.get("/properties/v1/contacts/groups")
  ]).spread(({ body: props }, { body: groups }) => {
      res.json({ options: groups.map(group => {
        return {
          label: group.displayName,
          options: _.chain(props)
            .filter({ groupName: group.name})
            .map(prop => {
              return {
                label: prop.label,
                value: prop.name
              }
            })
            .value()
        }
      })
    });
  })
  .catch(() => {
    res.json({ options: [] });
  });
}
