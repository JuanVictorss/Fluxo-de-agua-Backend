const knex = require("knex")({
  client: "sqlite3",
  connection: {
    filename: "./logs_de_fluxo.db",
  },
  useNullAsDefault: true,
});

async function configurarBancoDeDados() {
  const tableExists = await knex.schema.hasTable("logs");
  if (!tableExists) {
    console.log('[BANCO DE DADOS] Tabela "logs" não encontrada, criando...');
    await knex.schema.createTable("logs", (table) => {
      table.increments("id").primary();
      table.timestamp("data_hora_inicio").defaultTo(knex.fn.now());
      table.timestamp("data_hora_fim");
      table.integer("duracao_segundos");
      table.float("volume_litros_sessao");
      table.text("pontos_grafico_vazao");
    });
    console.log('[BANCO DE DADOS] Tabela "logs" criada com sucesso.');
  } else {
    console.log('[BANCO DE DADOS] Tabela "logs" já existe.');
  }
}

module.exports = { knex, configurarBancoDeDados };
