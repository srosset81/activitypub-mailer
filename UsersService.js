const DbService = require("moleculer-db");

module.exports=
{
    name: "users",

    // Mixin DB service into (current) 'users' service
    mixins: [DbService],

    settings: {
        fields: ["_id", "username", "name"],
        entityValidator: {
      username: "string"
    }
    },

    afterConnected() {
        // Seed the DB with ˙this.create`
    }
}
