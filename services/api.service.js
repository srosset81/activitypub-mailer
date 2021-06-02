const ApiGateway = require('moleculer-web');
const CONFIG = require('../config');

const ApiService = {
  mixins: [ApiGateway],
  settings: {
    port: CONFIG.PORT,
    cors: {
      origin: '*',
      exposedHeaders: '*'
    },
    assets: {
      folder: './public',
      options: {} // `server-static` module options
    },
    routes: [
      {
        bodyParsers: {
          json: true,
          urlencoded: { extended: true }
        },
        aliases: {
          'POST /': 'form.process',
          'GET /': 'form.display',
          'GET /mailer/:frequency': 'mailer.processNotifications'
        }
      }
    ]
  }
};

module.exports = ApiService;
