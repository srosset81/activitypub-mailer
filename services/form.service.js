const Handlebars = require('handlebars');
const slugify = require('slugify');
const urlJoin = require('url-join');
const fs = require('fs').promises;
const { ACTIVITY_TYPES, PUBLIC_URI } = require('@semapps/activitypub');
const CONFIG = require('../config');

const FormService = {
  name: 'form',
  dependencies: ['match-bot'],
  settings: {
    matchBotUri: null
  },
  actions: {
    async display(ctx) {
      let actor;

      if( ctx.params.id ) {
        try {
          actor = await ctx.call('activitypub.actor.get', { id: ctx.params.id });
        } catch (e) {
          // Do nothing if actor is not found, the ID will be used for the creation
        }
      }

      if (!actor) {
        actor = {
          'pair:e-mail': ctx.params.email,
          'semapps:mailFrequency': 'weekly'
        };
      }

      if (!actor.location) {
        actor.location = { radius: '25000' };
      }

      ctx.meta.$responseType = 'text/html';
      return this.formTemplate({
        title: 'Suivez les projets de la Fabrique',
        themes: [
          'Agriculture & alimentation',
          'Économie locale',
          'Démocratie',
          'Arts & culture',
          'Éducation',
          'Habitat & oasis',
          'Énergie',
          'Transport',
          'Bien-être',
          'Autre'
        ],
        id: ctx.params.id,
        actor,
        message: ctx.params.message
      });
    },
    async process(ctx) {
      let message;

      if (ctx.params.unsubscribe) {
        await ctx.call('activitypub.actor.remove', { id: ctx.params.id });

        ctx.meta.$statusCode = 302;
        ctx.meta.$location = `/?message=deleted`;
      } else {
        let actor;

        if( ctx.params.id ) {
          try {
            actor = await ctx.call('activitypub.actor.get', { id: ctx.params.id });
          } catch (e) {
            // Do nothing if actor is not found, the ID will be used for the creation
          }
        }

        let themes = [];
        ctx.params.themes.forEach(themeLabel => {
          themes.push(this.getThemesUrisFromLabel(themeLabel));
        })

        let actorData = {
          'pair:e-mail': ctx.params.email,
          'pair:hasInterest': themes,
          'semapps:mailFrequency': ctx.params.frequency
        };

        if (ctx.params.location === 'close-to-me') {
          if (ctx.params['address-result']) {
            const address = JSON.parse(ctx.params['address-result']);
            actorData.location = {
              type: 'Place',
              name: ctx.params.address,
              latitude: address.latlng.lat,
              longitude: address.latlng.lng,
              radius: ctx.params.radius
            };
          } else if (actor && actor.location) {
            // If actor location is already set, only update the radius
            actorData.location = {
              ...actor.location,
              radius: ctx.params.radius
            };
          }
        } else if (ctx.params.location === 'whole-world') {
          // If actor location was set, remove it
          if (actor && actor.location) {
            actorData.location = {
              type: 'Place'
            };
          }
        }

        if (actor) {
          actor = await ctx.call('activitypub.actor.update', {
            '@context': 'https://www.w3.org/ns/activitystreams',
            '@id': ctx.params.id,
            ...actorData
          });

          message = 'updated';
        } else {
          actor = await ctx.call('activitypub.actor.create', {
            slug: ctx.params.id,
            '@context': 'https://www.w3.org/ns/activitystreams',
            type: 'Person',
            ...actorData
          });

          await ctx.call('activitypub.outbox.post', {
            collectionUri: actor.outbox,
            '@context': 'https://www.w3.org/ns/activitystreams',
            actor: actor.id,
            type: ACTIVITY_TYPES.FOLLOW,
            object: this.settings.matchBotUri,
            to: [ this.settings.matchBotUri, urlJoin(actor.id, 'followers'), PUBLIC_URI ]
          });

          // Do not wait for mail to be sent
          ctx.call('mailer.sendConfirmationMail', { actor });

          message = 'created';
        }

        ctx.meta.$statusCode = 302;
        ctx.meta.$location = `/?id=${encodeURI(actor.id)}&message=${message}`;
      }
    }
  },
  async started() {
    this.settings.matchBotUri = await this.broker.call('match-bot.getUri');

    const templateFile = await fs.readFile(__dirname + '/../templates/form.html');

    Handlebars.registerHelper('ifInActorThemes', (elem, returnValue, options) => {
      const themes = this.getThemesUrisFromLabel(elem);
      if (
        options.data.root.actor &&
        options.data.root.actor['pair:hasInterest'] &&
        options.data.root.actor['pair:hasInterest'].some(interest => themes.includes(interest))
      ) {
        return returnValue;
      }
    });

    Handlebars.registerHelper('ifCond', (v1, operator, v2, options) => {
      if (typeof v2 === 'number') v1 = parseInt(v1, 10);
      switch (operator) {
        case '==':
          return v1 == v2 ? options.fn(this) : options.inverse(this);
        case '===':
          return v1 === v2 ? options.fn(this) : options.inverse(this);
        case '!=':
          return v1 != v2 ? options.fn(this) : options.inverse(this);
        case '!==':
          return v1 !== v2 ? options.fn(this) : options.inverse(this);
        case '<':
          return v1 < v2 ? options.fn(this) : options.inverse(this);
        case '<=':
          return v1 <= v2 ? options.fn(this) : options.inverse(this);
        case '>':
          return v1 > v2 ? options.fn(this) : options.inverse(this);
        case '>=':
          return v1 >= v2 ? options.fn(this) : options.inverse(this);
        case '&&':
          return v1 && v2 ? options.fn(this) : options.inverse(this);
        case '||':
          return v1 || v2 ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });

    this.formTemplate = Handlebars.compile(templateFile.toString());
  },
  methods: {
    getThemesUrisFromLabel(label) {
      return label && label.split(/[\s&]+/)
        .map(themeLabel => urlJoin(CONFIG.THEMES_CONTAINER, slugify(themeLabel, { lower: true })))
    }
  }
};

module.exports = FormService;
