# Baja Telemetry Studio

MVP full-stack de telemetria para veículo **Baja SAE**, preparado para portfólio e repositório GitHub `baja-telemetry-studio`.

> **Demonstração, não sistema de segurança veicular.** Todos os dados iniciais, limites de alerta, localização, volta e traçado são **simulados**. É necessária calibração e validação com sensores antes de qualquer uso real. O dashboard não substitui instrumentação crítica ou sistemas de proteção do veículo.

## Funcionalidades implementadas

- Dashboard dark de automobilismo, responsivo e com conta-giros (RPM), velocidade, temperaturas, aceleração, inclinação e bateria.
- Telemetria via WebSocket com reconexão automática.
- Simulador no backend com 1 amostra/segundo e histórico inicial para abrir o sistema com dados.
- Visualização vetorial da pista de demonstração a partir de coordenadas GPS e posição do veículo.
- Histórico de velocidade, RPM e temperatura, com seleção de variável.
- Replay com play/pause, barra temporal, reinício e retorno ao modo LIVE.
- Registro de alertas por limiares de demonstração e eventos na interface.
- Exportação do histórico da sessão em CSV.
- Integração opcional com MQTT, PostgreSQL e firmware Arduino C++ para ESP32-S3.
- Endpoints REST de telemetria, eventos, health check e controle do simulador.

## Arquitetura

```text
ESP32-S3 + sensores reais (futuro)            Simulador Node.js
                |                                    |
             MQTT                                   |
                |                                    |
                +---------------> Node.js/Express <--+
                                      |   |
                        PostgreSQL <--+   +--> WebSocket
                                              |
                                     React / Vite dashboard
                                       |          |
                                 Circuito GPS  Replay/gráficos
```

## Prévia offline (sem instalação)

Abra o arquivo `preview.html` diretamente no navegador para conferir o visual e experimentar o replay sem precisar de backend. Esta prévia é independente do aplicativo React e usa apenas dados artificiais.

## Inicialização rápida (sem Docker)

Requisitos: **Node.js 20+**, **npm**.

```bash
npm install
npm run dev
```

Abra **http://localhost:5173**. A API ficará em **http://localhost:4000**.

Não é necessário ter ESP32, Docker, MQTT ou PostgreSQL para testar a demonstração: a API gera dados fictícios e armazena histórico na memória (máximo de 2.000 registros). No navegador, o replay usa os últimos 1.000 registros recebidos.

## MQTT e PostgreSQL (opcionais)

```bash
# Na raiz do repositório
# docker compose up -d
# cp apps/server/.env.example apps/server/.env
```

Edite `apps/server/.env`:

```ini
SIMULATE=false
MQTT_ENABLED=true
MQTT_URL=mqtt://localhost:1883
MQTT_TOPIC=baja/telemetry
PG_ENABLED=true
DATABASE_URL=postgresql://baja:baja_dev_password@localhost:5432/baja_telemetry
```

Em seguida execute `npm run dev`. Para simular dados **junto** com o hardware, defina `SIMULATE=true` (as fontes aparecerão misturadas no histórico).

**Atenção:** o Mosquitto do Docker Compose aceita clientes sem senha, apenas para prototipagem em rede de confiança. Para exposição na internet implemente autenticação, ACL, TLS, rate limit, gestão de segredos, controle de acesso e retenção.

## Payload MQTT

Publicar JSON no tópico `baja/telemetry`:

```json
{
  "rpm": 4200,
  "speedKmh": 47.0,
  "engineTempC": 82.0,
  "cvtTempC": 69.0,
  "accelerationG": 0.27,
  "inclineDeg": 4.5,
  "batteryV": 12.6,
  "lat": -2.53,
  "lon": -44.3,
  "lap": 1,
  "progress": 0.42,
  "seq": 100
}
```

`ts` opcional (ISO 8601). Os nove campos de sensor acima, incluindo `lat` e `lon`, são obrigatórios. Os campos `seq`, `lap` e `progress` são opcionais. O broker não é acessível via navegador: o Node.js atua como gateway.

## Firmware

Veja `firmware/esp32-s3/esp32-s3.ino`. Instale **ArduinoJson 7** e **PubSubClient** no Arduino IDE ou PlatformIO. Atualize credenciais Wi-Fi e `MQTT_BROKER` com o endereço IP LAN do computador que roda o Mosquitto.

**Este sketch também gera dados falsos**; ele comprova apenas o caminho ESP32 → MQTT → API → dashboard. Para conectar sensores reais, são necessários os respectivos drivers, condicionamento dos sinais (sobretudo RPM automotivo), aterramento, proteção elétrica, calibração e aquisição GPS.

## Rotas da API

| Rota | Método | Uso |
|---|---|---|
| `/api/health` | GET | Estado da conexão, fontes e armazenamento |
| `/api/telemetry/latest` | GET | Última amostra |
| `/api/telemetry/history?limit=360` | GET | Histórico recente, máximo de 2.000 |
| `/api/events` | GET | Alertas recentes |
| `/api/simulation` | POST | `{"running": false}` pausa, `true` retoma simulação |
| `/ws` | WebSocket | Eventos `init`, `telemetry`, `event`, `status` |

## Testes e build

```bash
npm test
npm run build
npm start
```

Após `build`, o Express pode servir o front-end em `http://localhost:4000` sem Vite.

## Estrutura

```text
baja-telemetry-studio/
├── apps/
│   ├── server/src/          # Express, MQTT, WS, simulador, testes
│   └── web/src/             # React, dashboards, componentes, CSS
├── firmware/esp32-s3/      # Firmware demonstrativo Arduino
├── infra/
│   ├── mosquitto/          # Broker local
│   └── postgres/           # DDL da tabela de telemetria
├── docker-compose.yml
└── package.json            # Monorepo npm workspaces
```

## Evoluções sugeridas

1. Drivers e protocolos reais: hall sensor/indutivo para RPM, termopares com interface adequada, IMU e GPS GNSS.
2. Detecção automática de linha de chegada (geofence), cronômetro por timestamps GPS, melhor volta, setores e ranking.
3. Histórico completo consultado diretamente do PostgreSQL (o MVP grava, mas consulta o buffer de RAM no dashboard).
4. Mapa com base cartográfica, login da equipe, sessões e veículos múltiplos.
5. Pacotes offline no ESP32 com reconexão, sincronização NTP/GNSS, TLS e autenticação MQTT.
6. Regras configuráveis e diagnósticos de saúde dos sensores.

## Identidade visual

Paleta: `#0A0B18`, `#101023`, `#9E78F8`, `#32C7E5`, `#F6F7FB`, `#FFFFFF`. Tipografia: Rajdhani + DM Sans (fallbacks locais). Gráficos e circuito foram construídos em SVG/React, sem imagens externas ou chaves de mapa.

**Licença:** adicionar a licença escolhida antes da publicação pública.
