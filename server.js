const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mqtt = require('mqtt');
const cors = require('cors');
const { knex, configurarBancoDeDados } = require('./database');
const { type } = require('os');

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORTA = 3001;
const urlBroker = 'mqtt://broker.hivemq.com:1883';

// Tópicos MQTT
const dispositivoId = 'esp32-juanvictor';
const topicoDados = `ifpe/ads/dispositivo/${dispositivoId}/dados`;
const topicoStatus = `ifpe/ads/dispositivo/${dispositivoId}/status`;
const topicoConfigSet = `ifpe/ads/dispositivo/${dispositivoId}/config/set`;
const topicoConfigGet = `ifpe/ads/dispositivo/${dispositivoId}/config/get`;

// armazena os pontos
let pontosDaHora = [];
let configAtualCache = { fator_calibracao: 7.5, intervalo_telemetria_s: 1 };

// Conexão MQTT
const client = mqtt.connect(urlBroker);
client.on('connect', () => {
    console.log('>>> Conectado ao broker HiveMQ! <<<');
    client.subscribe(topicoDados);
    client.subscribe(topicoStatus);
    client.subscribe(topicoConfigGet);
});

client.on('message', (topic, message) => {
    const dataStr = message.toString();
    console.log(`[MQTT] Recebido: ${dataStr} em ${topic}`);
    if (topic === topicoDados) {
        const data = JSON.parse(dataStr);
        pontosDaHora.push({
            time: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
            vazao: data.flow_rate_lpm
        });
        io.emit('dados-fluxo', dataStr);
    }

    if (topic === topicoStatus) {
        try {
            const statusData = JSON.parse(dataStr);
            if (statusData.status) {
                console.log(`[STATUS] Status do ESP32 recebido: ${statusData.status}`);
                io.emit('status-esp32', statusData.status);
            }
        } catch (e) { console.warn("[STATUS] Mensagem de status inválida recebida."); }
    }

    if (topic === topicoConfigGet) {
        try {
            configAtualCache = JSON.parse(dataStr);
            console.log(`[CONFIG] Configuração do ESP32 atualizada no cache:`, configAtualCache);
        } catch (e) { console.warn("[CONFIG] Mensagem de config inválida recebida."); }
    }
});

//corrigido, agora salva um objeto json apenas
setInterval(async () => {
    if (pontosDaHora.length === 0) {
        return;
    }
    
    const pontoParaSalvar = pontosDaHora.shift();

    if (pontoParaSalvar.vazao > 0.01) {
        try {
            const intervalo_s = configAtualCache.intervalo_telemetria_s;
            const vazao_lps = pontoParaSalvar.vazao / 60.0;
            const volumeDoPonto = vazao_lps * intervalo_s;

            const registroSessao = {
                pontos_grafico_vazao: JSON.stringify(pontoParaSalvar),
                volume_total_litros: volumeDoPonto
            };

            await knex('sessoes').insert(registroSessao);
            console.log(`[DB] Registro salvo: ${JSON.stringify(pontoParaSalvar)}`);

        } catch (error) {
            console.error(' Erro ao salvar registro individual:', error);
        }
    }
}, 1000);


app.get('/api/historico/sessoes', async (req, res) => {
    try {
        const sessoes = await knex('sessoes').select('id', 'timestamp_hora', 'volume_total_litros').orderBy('id', 'desc');
        res.json(sessoes);
    } catch (error) { res.status(500).json({ error: 'Erro ao buscar lista de sessões.' }); }
});

app.get('/api/historico/sessoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const sessao = await knex('sessoes').where({ id }).first();
        if (sessao) {
            res.json(sessao);
        } else {
            res.status(404).json({ error: 'Sessão não encontrada.' });
        }
    } catch (error) { res.status(500).json({ error: 'Erro ao buscar dados da sessão.' }); }
});

app.post('/api/config/set', (req, res) => {
    try {
        const configPayload = JSON.stringify(req.body);
        client.publish(topicoConfigSet, configPayload, (err) => {
            if (err) {
                return res.status(500).json({ status: 'falha', erro: err.message });
            }
            console.log(`[API] Comando de configuração enviado: ${configPayload}`);
            res.json({ status: 'sucesso', comando_enviado: req.body });
        });
    } catch (error) {
        res.status(500).json({ status: 'falha', erro: error.message });
    }
});

app.get('/api/config/get', (req, res) => {
    res.json(configAtualCache);
});


async function iniciarServidor() {
    await configurarBancoDeDados();
    io.on('connection', (socket) => console.log('>>> Um usuário se conectou ao WebSocket! <<<'));
    server.listen(PORTA, () => console.log(`Servidor rodando e escutando na porta ${PORTA}`));
}
iniciarServidor();