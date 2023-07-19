import { faker } from '@faker-js/faker'
import { promisify } from 'node:util'
import knex from 'knex'
const dbKnex = knex({
  client: 'pg',
  connection: {
    host: 'localhost',
    port: '5432',
    user: 'postgres',
    database: 'docker',
    password: 'docker',
  }
});

console.time('db-insert')

await dbKnex.schema.hasTable('users').then(function(exists) {
  if (!exists) {
    return dbKnex.schema.createTable('users', function(t) {
      t.uuid('id');
      t.text('name');
      t.integer('age');
      t.text('company');
    });
  }
});


function generateUser() {
  const user = {
    id: faker.datatype.uuid(),
    name: faker.internet.userName(),
    age: faker.datatype.number({ min: 18, max: 110 }),
    company: faker.company.name(),
  }
  return [ user.id, user.name, user.age, user.company]
}
const promises = []
for(let i =0; i < 10000; i++) {
  const user = generateUser()
  promises.push(dbKnex('users').insert([{id: user[0], name: user[1], age: user[2], company: user[3]}]))
}

await Promise.all(promises)
console.log('finished inserting data', promises.length, 'item')