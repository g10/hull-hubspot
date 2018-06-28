const _ = require("lodash");
const Promise = require("bluebird");

const TYPES_MAPPING = {
  string: { type: "string", fieldType: "text" },
  number: { type: "number", fieldType: "text" },
  date: { type: "datetime", fieldType: "text" },
  boolean: {
    type: "bool",
    fieldType: "booleancheckbox",
    options: [
      {
        description: null,
        doubleData: 0,
        label: "Yes",
        displayOrder: -1,
        hidden: false,
        readOnly: false,
        value: true
      },
      {
        description: null,
        doubleData: 0,
        label: "No",
        displayOrder: -1,
        hidden: false,
        readOnly: false,
        value: false
      }
    ]
  }
};

class ContactPropertyUtil {
  constructor({
    logger,
    metric,
    hubspotClient,
    userSegments,
    hubspotProperties,
    hullProperties
  }) {
    this.hubspotClient = hubspotClient;
    this.logger = logger;
    this.metric = metric;
    this.userSegments = userSegments;

    this.hubspotProperties = hubspotProperties;
    this.hullProperties = hullProperties;
  }

  // get
  // return Promise.all([
  //     this.hubspotClient.retryUnauthorized(() => {
  //       return this.hubspotClient
  //         .get("/contacts/v2/groups")
  //         .query({ includeProperties: true });
  //     }),
  //     this.hullClient.utils.properties.get()
  //   ]).then(([groupsResponse = {}, hullProperties = {}]) => {
  //     const groups = (groupsResponse && groupsResponse.body) || [];
  //     const properties = _.reduce(
  //       customProps,
  //       (props, customProp) => {
  //         const hullProp = _.find(hullProperties, { id: customProp.hull });
  //         props.push(_.merge({}, customProp, _.pick(hullProp, ["type"])));
  //         return props;
  //       },
  //       []
  //     );
  //     return this.contactPropertyUtil
  //       .sync({
  //         groups,
  //         properties
  //       })
  //       .then(() => groups);
  //   });

  sync({ groups, properties }) {
    console.log({ groups, properties });
    const uniqueSegments = _.uniqBy(this.segments, "name");
    const propertiesList = this.getPropertiesList({
      segments: uniqueSegments,
      properties
    });
    return this.ensureHullGroup(groups)
      .then(() => this.ensureCustomProperties(propertiesList, groups))
      .catch(err => {
        this.logger.error("connector.sync.error", {
          error: err.response && err.response.body && err.response.body.message
        });
        this.metric.event({
          title: "connector.sync.error",
          text: JSON.stringify(err.response && err.response.body)
        });
      });
  }

  ensureHullGroup(groups) {
    const group = _.find(groups, g => g.name === "hull");
    if (group) {
      return Promise.resolve(group);
    }
    return this.hubspotClient
      .post("/contacts/v2/groups")
      .send({
        name: "hull",
        displayName: "Hull Properties",
        displayOrder: 1
      })
      .then(res => res.body);
  }

  ensureCustomProperties(propertiesList, group = {}) {
    const groupProperties = _.flatten(group.map(g => g.properties)).reduce(
      (props, prop) => {
        return Object.assign(props, { [prop.name]: prop });
      },
      {}
    );
    return Promise.all(
      propertiesList.map(property =>
        this.ensureProperty(groupProperties, property)
      )
    ).then((...props) =>
      this.logger.debug(
        "ContactProperty.ensureCustomProperties",
        _.map(props[0], p => p.name)
      )
    );
  }

  shouldUpdateProperty(currentValue, newValue) {
    if (newValue.name === "hull_segments") {
      const currentSegmentNames = (currentValue.options || [])
        .map(o => o.label)
        .sort();
      const newSegmentNames = (newValue.options || []).map(o => o.label).sort();
      return !_.isEqual(currentSegmentNames, newSegmentNames);
    }
    return false;
  }

  ensureProperty(groupProperties, property) {
    const exists =
      groupProperties[property.name] ||
      groupProperties[property.name.replace(/^hull_/, "")];
    if (exists) {
      if (this.shouldUpdateProperty(exists, property)) {
        return this.hubspotClient
          .put(`/contacts/v2/properties/named/${property.name}`)
          .send(property)
          .then(res => res.body);
      }
      return Promise.resolve(exists);
    }

    return this.hubspotClient
      .post("/contacts/v2/properties")
      .send(property)
      .then(res => res.body);
  }

  getPropertiesList({ properties, segments }) {
    return [this.getHullSegmentsProperty(segments)].concat(
      properties.map(({ label, type, name }, displayOrder) => {
        const propType = TYPES_MAPPING[type] || TYPES_MAPPING.string;
        return {
          ...propType,
          name,
          label,
          displayOrder,
          calculated: false,
          groupName: "hull",
          formField: false
        };
      })
    );
  }

  getHullSegmentsProperty(segments = []) {
    const options = _.map(segments, (s, i) => this.optionsHash(s.name, i));
    return {
      options,
      description: "All the Segments the User belongs to in Hull",
      label: "Hull Segments",
      groupName: "hull",
      fieldType: "checkbox",
      formField: false,
      name: "hull_segments",
      type: "enumeration",
      displayOrder: 0
    };
  }

  optionsHash(name, i) {
    return {
      hidden: false,
      description: null,
      value: _.trim(name),
      readOnly: false,
      doubleData: 0.0,
      label: name,
      displayOrder: i
    };
  }
}

module.exports = ContactPropertyUtil;
