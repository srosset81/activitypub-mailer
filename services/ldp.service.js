const { LdpService } = require('@semapps/ldp');
const { containers } = require('@semapps/activitypub');
const CONFIG = require('../config');
const ontologies = require('../ontologies');

module.exports = {
  mixins: [LdpService],
  settings: {
    baseUrl: CONFIG.HOME_URL,
    ontologies,
    containers,
    defaultContainerOptions: {
      jsonContext: CONFIG.DEFAULT_JSON_CONTEXT
    }
  }
};
