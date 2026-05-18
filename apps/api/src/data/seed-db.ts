import { getDatabaseInfo, resetStore } from "./store";

const store = resetStore();
const databaseInfo = getDatabaseInfo();

console.log(
  `Demo database seeded: ${store.users.length} users, ${store.roles.length} roles, ${store.requirements.length} requirements, ${store.reviewFlows.length} review flows.`
);
console.log(`Database: ${databaseInfo.provider} ${databaseInfo.file}`);
console.log("Password for all demo accounts: Demo@123456");
console.table(
  store.users.map((user) => ({
    departmentId: user.departmentId,
    employeeNo: user.username,
    email: user.email,
    title: user.title
  }))
);
