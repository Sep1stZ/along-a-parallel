import { getStore } from '../src/lib/server/store';
const store = getStore();
console.log(`SQLite initialized and seeded: ${store.filename}`);
console.log(
  `Places: ${store.db.prepare('SELECT count(*) AS count FROM places').get()?.count}; routes: ${store.getRoutes().length}`,
);
store.close();
