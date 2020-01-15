const Handlebars = require("handlebars");
const fs = require('fs').promises;

module.exports = {
  name: "form",
  actions: {
    display(ctx) {
      ctx.meta.$responseType = "text/html";
      return(this.formTemplate({ title: 'ActivityPub Mailer' }));
    },
    process(ctx) {
      console.log('email', ctx.params.email);
      // TODO call users.create
      ctx.meta.$responseType = "text/text";
      return('Success !');
    }
  },
  async started() {
    const templateFile = await fs.readFile('./templates/form.html');
    this.formTemplate = Handlebars.compile(templateFile.toString());
  }
};
