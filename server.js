const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mqtt = require("mqtt");
const cors = require("cors");
const { knex, configurarBancoDeDados } = require("./database");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORTA = 3001;
const urlBroker = "mqtt://broker.hivemq.com:1883";
const topico = "ifpe/ads/esp32/fluxoagua";
const LIMITE_LOGS = 10;
let sessaoAtual = null;

async function salvarSessao(sessao) {
  try {
    await knex("logs").insert(sessao);
    console.log(`[BANCO DE DADOS] Sessão de fluxo salva com sucesso.`);

    io.emit("historico-atualizado");

    const { count } = await knex("logs").count("id as count").first();
    if (count > LIMITE_LOGS) {
      const logMaisAntigo = await knex("logs").orderBy("id", "asc").first("id");
      await knex("logs").where("id", logMaisAntigo.id).del();
      console.log(
        `[BANCO DE DADOS] Log antigo (ID: ${logMaisAntigo.id}) removido para manter o limite de ${LIMITE_LOGS}.`
      );
    }
  } catch (error) {
    console.error("[BANCO DE DADOS] Erro ao salvar a sessão:", error);
  }
}

const client = mqtt.connect(urlBroker);
client.on("connect", () => {
  console.log(">>> Conectado ao broker HiveMQ! <<<");
  client.subscribe(topico, () =>
    console.log(`Inscrito no tópico: "${topico}".`)
  );
});

client.on("message", (topicoRecebido, mensagem) => {
  const dadosRecebidos = JSON.parse(mensagem.toString());
  const payloadParaFrontend = { ...dadosRecebidos, volume_sessao_atual: 0 };
  const estaFluindo = dadosRecebidos.flow_rate_lpm > 0;

  if (estaFluindo && !sessaoAtual) {
    sessaoAtual = {
      inicio: new Date(),
      volumeTotalInicial: dadosRecebidos.total_liters,
      pontosGrafico: [],
    };
  }

  if (estaFluindo && sessaoAtual) {
    sessaoAtual.pontosGrafico.push({
      time: new Date().toLocaleTimeString("pt-BR", { hour12: false }),
      vazao: dadosRecebidos.flow_rate_lpm,
    });
    payloadParaFrontend.volume_sessao_atual =
      dadosRecebidos.total_liters - sessaoAtual.volumeTotalInicial;
  } else if (!estaFluindo && sessaoAtual) {
    console.log(
      "[SESSAO] Fluxo parado. Finalizando e salvando sessão imediatamente."
    );
    const fimSessao = new Date();
    const duracao = Math.round((fimSessao - sessaoAtual.inicio) / 1000);
    const volumeSessao =
      dadosRecebidos.total_liters - sessaoAtual.volumeTotalInicial;
    const sessaoParaSalvar = {
      data_hora_inicio: sessaoAtual.inicio,
      data_hora_fim: fimSessao,
      duracao_segundos: duracao,
      volume_litros_sessao: volumeSessao,
      pontos_grafico_vazao: JSON.stringify(sessaoAtual.pontosGrafico),
    };
    salvarSessao(sessaoParaSalvar);
    sessaoAtual = null;
  }

  io.emit("dados-fluxo", JSON.stringify(payloadParaFrontend));
});

app.get("/api/logs", async (req, res) => {
  try {
    const logs = await knex("logs").orderBy("id", "desc").limit(LIMITE_LOGS);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar dados do banco." });
  }
});

async function iniciarServidor() {
  await configurarBancoDeDados();
  io.on("connection", (socket) =>
    console.log(">>> Um usuário se conectou ao WebSocket! <<<")
  );
  server.listen(PORTA, () =>
    console.log(`Servidor rodando e escutando na porta ${PORTA}`)
  );
}
iniciarServidor();
