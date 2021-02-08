const urlJoin = require('url-join');
const { ImporterService } = require('@semapps/importer');
const { MIME_TYPES } = require('@semapps/mime-types');
const { getSlugFromUri } = require('@semapps/ldp');
const path = require('path');
const CONFIG = require('../config');

module.exports = {
  mixins: [ImporterService],
  settings: {
    importsDir: path.resolve(__dirname, '../imports'),
    allowedActions: [
      'createSubscriber'
    ]
  },
  dependencies: ['ldp', 'activitypub.actor'],
  actions: {
    async createSubscriber(ctx) {
      const { data } = ctx.params;

      const actorExist = await ctx.call('ldp.resource.exist', { resourceUri: data.id });
      if( actorExist ) { console.log(`Actor ${data.id} exist, skipping...`); return; }

      const slug = getSlugFromUri(data.id);
      const location = data['location.latitude'] ? {
        type: 'Place',
        name: data['location.name'],
        latitude: data['location.latitude'],
        longitude: data['location.longitude'],
        radius: data['location.radius']
      } : undefined;

      const actorUri = await ctx.call('ldp.resource.post', {
        containerUri: urlJoin(CONFIG.HOME_URL, 'actors'),
        slug: slug,
        resource: {
          '@context': CONFIG.DEFAULT_JSON_CONTEXT,
          '@type': 'Person',
          "semapps:mailFrequency": data['semapps:mailFrequency'],
          "pair:e-mail": data['pair:e-mail'],
          "pair:hasTopic": data['pair:hasInterest'].split(';'),
          location: location,
          published: data.published
        },
        contentType: MIME_TYPES.JSON
      });

      await ctx.call('activitypub.actor.awaitCreateComplete', { actorUri });

      await ctx.call('activitypub.follow.addFollower', {
        follower: actorUri,
        following: urlJoin(CONFIG.HOME_URL, 'actors', 'match-bot')
      });

      console.log(`Subscriber ${data['pair:e-mail']} created: ${actorUri}`);
    },
    async importAll(ctx) {
      await this.actions.import({
        action: 'createSubscriber',
        fileName: 'subscribers.json'
      });
    }
  }
};
