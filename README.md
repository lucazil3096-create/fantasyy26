# ⚽ Fantasy Brasileirão 2026

## Estrutura do Projeto

O app foi reorganizado de **1 arquivo monolítico (25.473 linhas)** para uma estrutura modular profissional.

```
fantasy-brasileirao/
├── index.html              ← Página principal (limpa, só carrega módulos)
├── css/
│   └── styles.css          ← Todos os estilos (505 linhas)
├── js/
│   ├── 01-config.js        ← Firebase, API, chaves, dados base (460 linhas)
│   ├── 02-state.js         ← Variáveis globais do app (147 linhas)
│   ├── 03-helpers.js       ← Funções auxiliares, conquistas, desafios (1.139 linhas)
│   ├── 04-pricing.js       ← Sistema de preços estilo Cartola (165 linhas)
│   ├── 05-fixtures.js      ← Jogos ao vivo, cache, detecção de rodada (978 linhas)
│   ├── 06-market.js        ← Trocas, mercado, controle de rodada (1.229 linhas)
│   ├── 07-storage.js       ← Persistência Firebase (221 linhas)
│   ├── 08-chat.js          ← Sistema de chat (706 linhas)
│   ├── 09-api.js           ← Chamadas API externa (682 linhas)
│   ├── 10-scoring.js       ← Pontuação e animação de gol (1.286 linhas)
│   ├── 11-render.js        ← Renderização principal (5.638 linhas)
│   ├── 12-draft.js         ← Draft de jogadores (473 linhas)
│   ├── 13-admin-panel.js   ← Painel administrativo (2.568 linhas)
│   ├── 14-positions.js     ← Sistema de posições (363 linhas)
│   ├── 15-events.js        ← Event handlers + drag & drop (2.218 linhas)
│   ├── 16-draft-extras.js  ← Funções extras do draft (1.066 linhas)
│   ├── 17-admin-functions.js ← Funções admin avançadas (3.951 linhas)
│   └── 18-app.js           ← Inicialização e auto-sync (1.765 linhas)
└── README.md
```

## ⚠️ Regras Importantes

1. **Ordem dos scripts**: Os arquivos JS são numerados (01 a 18) e **devem ser carregados nessa ordem**. O `18-app.js` SEMPRE por último.

2. **Não abrir como arquivo local**: Por usar módulos separados, é necessário um servidor web. Opções:
   - **Firebase Hosting** (recomendado, já usa Firebase)
   - VS Code com extensão **Live Server**
   - Python: `python3 -m http.server 8000`
   - Node: `npx serve .`

3. **Escopo global**: Todas as funções e variáveis são globais (como no original). Ao editar, tome cuidado para não criar conflitos de nome.

## 🔧 Como Editar

Agora ficou fácil encontrar o que precisa alterar:

| Preciso mexer em...          | Arquivo                  |
|------------------------------|--------------------------|
| Config do Firebase/API       | `01-config.js`           |
| Variáveis de estado          | `02-state.js`            |
| Logos, conquistas            | `03-helpers.js`          |
| Preço dos jogadores          | `04-pricing.js`          |
| Jogos ao vivo/rodadas        | `05-fixtures.js`         |
| Mercado/trocas               | `06-market.js`           |
| Salvar dados no Firebase     | `07-storage.js`          |
| Chat                         | `08-chat.js`             |
| APIs externas                | `09-api.js`              |
| Pontuação/animações          | `10-scoring.js`          |
| Telas/interface              | `11-render.js`           |
| Sistema de draft             | `12-draft.js`            |
| Painel admin (layout)        | `13-admin-panel.js`      |
| Posições de jogadores        | `14-positions.js`        |
| Interações do usuário        | `15-events.js`           |
| Draft chat/countdown         | `16-draft-extras.js`     |
| Funções admin avançadas      | `17-admin-functions.js`  |
| Inicialização/sync           | `18-app.js`              |
| Visual/aparência             | `css/styles.css`         |

## 🚀 Deploy no Firebase Hosting

```bash
# Instalar Firebase CLI (se não tiver)
npm install -g firebase-tools

# Login e inicializar
firebase login
firebase init hosting

# Quando perguntar "public directory": .
# Deploy
firebase deploy
```
