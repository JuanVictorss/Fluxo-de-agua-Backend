const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mqtt = require('mqtt');
const cors = require('cors');
const { knex, configurarBancoDeDados } = require('./database');

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

// MODIFICADO: Esta variável agora armazena os pontos completos {time, vazao}
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

setInterval(async () => {
    if (pontosDaHora.length === 0) {
        console.log('[AGREGADOR] Nenhuma atividade na última hora. Nenhum log salvo.');
        return;
    }

    const pontosParaSalvar = [...pontosDaHora];
    pontosDaHora = [];

    const registroSessao = {
        pontos_grafico_vazao: JSON.stringify(pontosParaSalvar)
    };

    try {
        await knex('sessoes').insert(registroSessao);
        console.log(`[AGREGADOR] Sessão da última hora salva com ${pontosParaSalvar.length} pontos.`);
    } catch (error) {
        console.error('[AGREGADOR] Erro ao salvar sessão horária:', error);
    }
}, 60 * 60 * 1000);


app.get('/api/historico/sessoes', async (req, res) => {
    try {
        const sessoes = await knex('sessoes').select('id', 'timestamp_hora').orderBy('id', 'desc');
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