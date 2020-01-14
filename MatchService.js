{
    name: "match",
    actions: {
        alertuser(ctx) {
            console.log (ctx.params.username)
            ctx.call("users.create", {
              username: ctx.params.username,
              name: ctx.params.name,
              status: 1
            })
        }
    }
}
