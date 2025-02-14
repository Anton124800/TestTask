exports.up = function(knex) {
    return knex.schema.createTable('tariff_warehouse', table => {
        table.increments('id').primary();
        table.date('fetchDate').notNullable();
        table.float('boxDeliveryAndStorageExpr').notNullable();
        table.float('boxDeliveryBase').notNullable();
        table.float('boxDeliveryLiter').notNullable();
        table.float('boxStorageBase').notNullable();
        table.float('boxStorageLiter').notNullable();
        table.integer('tariff_id').unsigned().notNullable();
        table.integer('warehouse_id').unsigned().notNullable();
        table.foreign('tariff_id').references('id').inTable('tariffs').onDelete('CASCADE');
        table.foreign('warehouse_id').references('id').inTable('warehouses').onDelete('CASCADE');
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('tariff_warehouse');
};
