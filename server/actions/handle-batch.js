import _ from "lodash";

export default function handleBatch(ctx, messages) {
  const users = messages.map(m => m.user);
  ctx.metric.event({
    title: "batch",
    text: `User count: ${users.length}`
  });
  const filteredUsers = users.filter(user => ctx.shipApp.syncAgent.userWhitelisted(user) && !_.isEmpty(user.email));
  return ctx.enqueue("sendUsersJob", {
    users: filteredUsers
  });
}
