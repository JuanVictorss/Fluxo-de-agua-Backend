const knex = require('knex')({
    client: 'sqlite3',
    connection: {
        filename: './dados_fluxo.db'
    },
    useNullAsDefault: true
});

async function configurarBancoDeDados() {
    if (!(await knex.schema.hasTable('leituras_minuto'))) {
        console.log('[BANCO DE DADOS] Tabela "leituras_minuto" não encontrada, criando...');
        await knex.schema.createTable('leituras_minuto', (table) => {
            table.increments('id').primary();
            table.timestamp('timestamp').defaultTo(knex.fn.now());
            table.float('vazao_media_lpm');
            table.float('vazao_maxima_lpm');
            table.float('volume_no_minuto');
        });
        console.log('[BANCO DE DADOS] Tabela "leituras_minuto" criada com sucesso.');
    } else {
        console.log('[BANCO DE DADOS] Tabela "leituras_minuto" já existe.');
    }
}

module.exports = { knex, configurarBancoDeDados };