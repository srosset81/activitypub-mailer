module.exports = {
  // You can set all ServiceBroker configurations here
  // See https://moleculer.services/docs/0.14/configuration.html
  errorHandler(error, { ctx = {}, event, action }) {
    console.log('errorHandler', event, action, ctx);
    const { requestID, params } = ctx;
    ctx.call('sentry.sendError', { error, requestID, params, event, action });
    throw error;
  }
};
