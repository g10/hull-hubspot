/* @flow */
/* eslint-disable */

const _ = require("lodash");
const slug = require("slug");

const DEFAULT_MAPPING = [
  {
    name: "email",
    hull: "email",
    type: "string",
    title: "Email",
    read_only: false
  },
  {
    name: "salutation",
    hull: "hubspot/salutation",
    type: "string",
    title: "Salutation",
    read_only: false
  },
  {
    name: "firstname",
    hull: "hubspot/first_name",
    type: "string",
    title: "First Name",
    read_only: false
  },
  {
    name: "lastname",
    hull: "hubspot/last_name",
    type: "string",
    title: "Last Name",
    read_only: false
  },
  {
    name: "phone",
    hull: "hubspot/phone",
    type: "string",
    title: "Phone Number",
    read_only: false
  },
  {
    name: "mobilephone",
    hull: "hubspot/mobile_phone",
    type: "string",
    title: "Mobile Phone Number",
    read_only: false
  },
  {
    name: "address",
    hull: "hubspot/address_street",
    type: "string",
    title: "Street Address",
    read_only: false
  },
  {
    name: "city",
    hull: "hubspot/address_city",
    type: "string",
    title: "City",
    read_only: false
  },
  {
    name: "zip",
    hull: "hubspot/address_postal_code",
    type: "string",
    title: "Postal Code",
    read_only: false
  },
  {
    name: "state",
    hull: "hubspot/address_state",
    type: "string",
    title: "State/Region",
    read_only: false
  },
  {
    name: "country",
    hull: "hubspot/address_country",
    type: "string",
    title: "Country",
    read_only: false
  },
  {
    name: "fax",
    hull: "hubspot/fax",
    type: "string",
    title: "Fax Number",
    read_only: false
  },
  {
    name: "company",
    hull: "hubspot/company",
    type: "string",
    title: "Company Name",
    read_only: false
  },
  {
    name: "industry",
    hull: "hubspot/industry",
    type: "string",
    title: "Industry",
    read_only: false
  },
  {
    name: "jobtitle",
    hull: "hubspot/job_title",
    type: "string",
    title: "Job Title",
    read_only: false
  },
  {
    name: "numemployees",
    hull: "hubspot/employees_count",
    type: "number",
    title: "Number of Employees",
    read_only: false
  },
  {
    name: "website",
    hull: "hubspot/website",
    type: "string",
    title: "Website URL",
    read_only: false
  },
  {
    name: "createdate",
    hull: "hubspot/created_at",
    type: "date",
    title: "Create Date",
    read_only: false
  },
  {
    name: "closedate",
    hull: "hubspot/closed_at",
    type: "date",
    title: "Close Date",
    read_only: false
  },
  {
    name: "lastmodifieddate",
    hull: "hubspot/updated_at",
    type: "date",
    title: "Last Modified Date",
    read_only: false
  },
  {
    name: "annualrevenue",
    hull: "hubspot/annual_revenue",
    type: "number",
    title: "Annual Revenue",
    read_only: false
  },
  {
    name: "total_revenue",
    hull: "hubspot/total_revenue",
    type: "number",
    title: "Total Revenue",
    read_only: false
  },
  {
    name: "lifecyclestage",
    hull: "hubspot/lifecycle_stage",
    type: "string",
    title: "Lifecycle Stage",
    read_only: false
  },
  {
    name: "days_to_close",
    hull: "hubspot/days_to_close",
    type: "number",
    title: "Days To Close",
    read_only: true
  },
  {
    name: "first_deal_created_date",
    hull: "hubspot/first_deal_created_at",
    type: "date",
    title: "First Deal Created Date",
    read_only: false
  },
  {
    name: "num_associated_deals",
    hull: "hubspot/associated_deals_count",
    type: "number",
    title: "Associated Deals",
    read_only: true
  },
  {
    name: "hubspot_owner_id",
    hull: "hubspot/hubspot_owner_id",
    type: "string",
    title: "HubSpot Owner",
    read_only: false
  },
  {
    name: "hs_email_optout",
    hull: "hubspot/email_optout",
    type: "boolean",
    title: "Opted out of all email",
    read_only: true
  },
  {
    name: "blog_default_hubspot_blog_subscription",
    hull: "hubspot/default_hubspot_blog_subscription",
    type: "boolean",
    title: "Default HubSpot Blog Email Subscription",
    read_only: false
  },
  {
    name: "message",
    hull: "hubspot/message",
    type: "string",
    title: "Message",
    read_only: false
  },
  {
    name: "recent_deal_amount",
    hull: "hubspot/recent_deal_amount",
    type: "number",
    title: "Recent Deal Amount",
    read_only: false
  },
  {
    name: "recent_deal_close_date",
    hull: "hubspot/recent_deal_closed_at",
    type: "date",
    title: "Recent Deal Close Date",
    read_only: false
  },
  {
    name: "num_notes",
    hull: "hubspot/notes_count",
    type: "number",
    title: "Number of Sales Activities",
    read_only: true
  },
  {
    name: "num_contacted_notes",
    hull: "hubspot/contacted_notes_count",
    type: "string",
    title: "Number of times contacted",
    read_only: true
  },
  {
    name: "notes_last_contacted",
    hull: "hubspot/notes_last_contacted_at",
    type: "date",
    title: "Last Contacted",
    read_only: false
  },
  {
    name: "notes_last_updated",
    hull: "hubspot/last_activity_at",
    type: "date",
    title: "Last Activity Date",
    read_only: false
  },
  {
    name: "notes_next_activity_date",
    hull: "hubspot/next_activity_at",
    type: "date",
    title: "Next Activity Date",
    read_only: false
  },
  {
    name: "hubspot_owner_assigneddate",
    hull: "hubspot/owner_assigned_at",
    type: "date",
    title: "Owner Assigned Date",
    read_only: false
  },
  {
    name: "hs_lead_status",
    hull: "hubspot/lead_status",
    type: "string",
    title: "Lead Status",
    read_only: false
  },
  {
    name: "hs_lifecyclestage_customer_date",
    hull: "hubspot/became_customer_at",
    type: "date",
    title: "Became a Customer Date",
    read_only: false
  },
  {
    name: "hs_lifecyclestage_lead_date",
    hull: "hubspot/became_lead_at",
    type: "date",
    title: "Became a Lead Date",
    read_only: false
  },
  {
    name: "hs_lifecyclestage_marketingqualifiedlead_date",
    hull: "hubspot/became_marketing_qualified_lead_at",
    type: "date",
    title: "Became a Marketing Qualified Lead Date",
    read_only: false
  },
  {
    name: "hs_lifecyclestage_salesqualifiedlead_date",
    hull: "hubspot/became_sales_qualified_lead_at",
    type: "date",
    title: "Became a Sales Qualified Lead Date",
    read_only: false
  },
  {
    name: "hs_lifecyclestage_subscriber_date",
    hull: "hubspot/became_subscriber_at",
    type: "date",
    title: "Became a Subscriber Date",
    read_only: false
  },
  {
    name: "hs_lifecyclestage_evangelist_date",
    hull: "hubspot/became_evangelist_at",
    type: "date",
    title: "Became an Evangelist Date",
    read_only: false
  },
  {
    name: "hs_lifecyclestage_opportunity_date",
    hull: "hubspot/became_opportunity_at",
    type: "date",
    title: "Became an Opportunity Date",
    read_only: false
  },
  {
    name: "hs_lifecyclestage_other_date",
    hull: "hubspot/became_other_at",
    type: "date",
    title: "Became an Other Lifecycle Date",
    read_only: false
  }
];

function getFieldsToHubspot(ship: any = {}) {
  const fields = _.get(ship, "private_settings.sync_fields_to_hubspot") || [];
  return fields
    .map(f => {
      if (_.isString(f)) {
        return false;
      }

      if (!f.name) {
        return false;
      }

      const name =
        "hull_" +
        slug(f.name, {
          replacement: "_",
          lower: true
        });
      return {
        label: f.name,
        name,
        hull: f.hull,
        default: _.find(DEFAULT_MAPPING, { name: f.name }),
        overwrite: f.overwrite
      };
    })
    .filter(_.isObject);
}

function getFieldsToHull(ship: any = {}) {
  const fields = DEFAULT_MAPPING.slice();
  const addFields = _.get(ship, "private_settings.sync_fields_to_hull");

  if (addFields && addFields.length > 0) {
    addFields.map(({ name, hull }) => {
      if (name && hull) {
        fields.push({ name, hull: hull.replace(/^traits_/, "") });
      }
    });
  }

  return fields;
}

function getMap(ship: any) {
  return {
    to_hull: getFieldsToHull(ship),
    to_hubspot: getFieldsToHubspot(ship)
  };
}

module.exports = {
  getFieldsToHull,
  getFieldsToHubspot,
  getMap
};
