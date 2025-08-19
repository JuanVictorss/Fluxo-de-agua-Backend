// database.js (Nova estrutura para sessões horárias)

const knex = require('knex')({
    client: 'sqlite3',
    connection: {
        filename: './sessoes_horarias.db' // Novo nome para o arquivo do banco
    },
    useNullAsDefault: true
});

async function configurarBancoDeDados() {
    if (!(await knex.schema.hasTable('sessoes'))) {
        console.log('[BANCO DE DADOS] Tabela "sessoes" não encontrada, criando...');
        await knex.schema.createTable('sessoes', (table) => {
            table.increments('id').primary();
            table.timestamp('timestamp_hora').defaultTo(knex.fn.now()); 
            table.text('pontos_grafico_vazao'); 
        });
        console.log('[BANCO DE DADOS] Tabela "sessoes" criada com sucesso.');
    } else {
        console.log('[BANCO DE DADOS] Tabela "sessoes" já existe.');
    }
}

module.exports = { knex, configurarBancoDeDados };