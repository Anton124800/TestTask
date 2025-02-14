exports.up = function(knex) {
    return knex.schema.createTable('tariffs', (table) => {
        table.increments('id').primary();
        table.date('dtNextBox').notNullable();
        table.date('dtTillMax').notNullable();
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('tariffs');
};
