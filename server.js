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

// topicos mqtt
const dispositivoId = 'esp32-juanvictor'; // 
const topicoDados = `ifpe/ads/dispositivo/${dispositivoId}/dados`;
const topicoStatus = `ifpe/ads/dispositivo/${dispositivoId}/status`;
const topicoConfigSet = `ifpe/ads/dispositivo/${dispositivoId}/config/set`;

// armazenar segundos
let leiturasDoMinuto = [];

//MQTT
const client = mqtt.connect(urlBroker);
client.on('connect', () => {
    console.log('>>> Conectado ao broker HiveMQ! <<<');
    client.subscribe(topicoDados);
    client.subscribe(topicoStatus);
});

// mensagens
client.on('message', (topic, message) => {
    const dataStr = message.toString();

    // dados
    if (topic === topicoDados) {
        const data = JSON.parse(dataStr);
        leiturasDoMinuto.push(data.flow_rate_lpm); 
        io.emit('dados-fluxo', dataStr); 
    }

    // status
    if (topic === topicoStatus) {
        try {
            const statusData = JSON.parse(dataStr);
            if (statusData.status) {
                console.log(`[STATUS] Status do ESP32 recebido: ${statusData.status}`);
                io.emit('status-esp32', statusData.status); 
            }
        } catch (e) { console.warn("[STATUS] Mensagem de status inválida recebida."); }
    }
});

setInterval(async () => {
    if (leiturasDoMinuto.length === 0) return;

    const leituras = [...leiturasDoMinuto]; 
    leiturasDoMinuto = []; 

    const somaVazao = leituras.reduce((acc, val) => acc + val, 0);
    const vazaoMedia = somaVazao / leituras.length;
    const vazaoMaxima = Math.max(...leituras);
    const volumeNoMinuto = (somaVazao / 60);

    const registroAgregado = {
        vazao_media_lpm: vazaoMedia,
        vazao_maxima_lpm: vazaoMaxima,
        volume_no_minuto: volumeNoMinuto,
    };

    try {
        await knex('leituras_minuto').insert(registroAgregado);
        console.log('[AGREGADOR] Dados do último minuto salvos:', registroAgregado);
    } catch (error) {
        console.error('[AGREGADOR] Erro ao salvar dados agregados:', error);
    }
}, 60 * 1000); 

// buscar historico
app.get('/api/historico/12h', async (req, res) => {
    try {
        const limite = 12 * 60;
        const dados = await knex('leituras_minuto').orderBy('id', 'desc').limit(limite);
        res.json(dados.reverse());
    } catch (error) { res.status(500).json({ error: 'Erro ao buscar dados do banco.' }); }
});

// enviar dados para o esp32
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

async function iniciarServidor() {
    await configurarBancoDeDados();
    io.on('connection', (socket) => console.log('>>> Um usuário se conectou ao WebSocket! <<<'));
    server.listen(PORTA, () => console.log(`Servidor rodando e escutando na porta ${PORTA}`));
}
iniciarServidor();