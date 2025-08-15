# 💧 Fluxo de Água - Backend

![Node.js](https://img.shields.io/badge/Node.js-18.x-green?logo=node.js)
![Express](https://img.shields.io/badge/Express-5.x-lightgrey?logo=express)
![MQTT](https://img.shields.io/badge/MQTT-5.x-purple?logo=mqtt)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-black?logo=socket.io)
![SQLite](https://img.shields.io/badge/SQLite-3-blue?logo=sqlite)

---

## 📜 Visão Geral

Este repositório contém o **servidor backend** do projeto **Fluxo de Água**.  
Ele recebe dados de um **sensor de fluxo de água (ESP32)** via **MQTT**, armazena em um **banco SQLite** e disponibiliza para o **frontend** em tempo real usando **Socket.IO**.

---

## ✨ Funcionalidades

- 📡 Conexão com broker **MQTT** para receber dados do ESP32.
- 💾 Armazenamento de logs no banco **SQLite** via **Knex.js**.
- 📈 Envio de dados em tempo real via **WebSockets**.
- 🗂️ API REST para consulta do histórico de medições.
- ♻️ Limite de armazenamento (10 registros mais recentes).

---

## 📂 Estrutura do Projeto

```
fluxo-de-agua-backend/
│── node_modules/           # Dependências do projeto
│── database.js             # Configuração do banco de dados
│── logs_de_fluxo.db        # Banco de dados SQLite
│── server.js               # Servidor principal (Express + MQTT + Socket.IO)
│── package.json            # Dependências e scripts
│── package-lock.json       # Controle de versões
```

---

## 🚀 Como Rodar o Projeto

### 1️⃣ Clonar repositório

```bash
git clone https://github.com/JuanVictorss/Fluxo-de-agua-Backend.git
cd fluxo-de-agua-backend
```

### 2️⃣ Instalar dependências

```bash
npm install
```

### 3️⃣ Configurar variáveis (opcional)

Se necessário, edite as configurações do broker MQTT e porta no arquivo `server.js`.

### 4️⃣ Iniciar servidor

```bash
node server.js
```

---

## 📡 Endpoints REST

### **Buscar últimos registros**

```
GET /api/logs
```

**Exemplo de resposta:**

```json
[
  {
    "id": 1,
    "data_hora_inicio": "2025-08-15T10:12:34.000Z",
    "data_hora_fim": "2025-08-15T10:15:12.000Z",
    "duracao_segundos": 158,
    "volume_litros_sessao": 12.5,
    "pontos_grafico_vazao": "[{\"time\":\"10:12:35\",\"vazao\":2.5}]"
  }
]
```

---

## 🔄 Comunicação em Tempo Real (WebSocket)

O backend envia eventos via **Socket.IO** para o frontend:

- `dados-fluxo` → Dados atuais do sensor.
- `historico-atualizado` → Novo registro salvo.

---

## 📦 Dependências

```json
"dependencies": {
  "cors": "^2.8.5",
  "express": "^5.1.0",
  "knex": "^3.1.0",
  "mqtt": "^5.14.0",
  "socket.io": "^4.8.1",
  "sqlite3": "^5.1.7"
}
```

---

## 🔗 Repositórios Relacionados

- [📂 Frontend](https://github.com/JuanVictorss/Fluxo-de-agua-Frontend)
- [📂 Firmware ESP32](https://github.com/JuanVictorss/Fluxo-de-agua-ESP32-Firmware.git)

---

## 👨‍💻 Autor

**Juan Victor Souza Silva**.
Projeto para fins acadêmicos na disciplina de **Sistemas Embarcados**.



