import { Knex } from 'knex'
import { DOMAIN_REQUESTS_COLUMNS, DOMAIN_REQUESTS_TABLE } from '../models/domain-request'

export async function up(knex: Knex): Promise<any> {
  if (!(await knex.schema.hasTable(DOMAIN_REQUESTS_TABLE))) {
    return knex.schema.createTable(DOMAIN_REQUESTS_TABLE, (t) => {
      t.string(DOMAIN_REQUESTS_COLUMNS.domainHash).notNullable()
      // TODO when implementing replay handling,
      // this field needs to either be nonNullable or taken out of the PK
      // issue: https://github.com/celo-org/celo-monorepo/issues/9909
      t.dateTime(DOMAIN_REQUESTS_COLUMNS.timestamp).nullable()
      t.string(DOMAIN_REQUESTS_COLUMNS.blindedMessage).notNullable()
      t.primary([
        DOMAIN_REQUESTS_COLUMNS.domainHash,
        DOMAIN_REQUESTS_COLUMNS.timestamp,
        DOMAIN_REQUESTS_COLUMNS.blindedMessage,
      ])
    })
  }

  return null
}

export async function down(knex: Knex): Promise<any> {
  return knex.schema.dropTable(DOMAIN_REQUESTS_TABLE)
}
