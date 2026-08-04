# Documentação do Projeto — Gestão Pricing 2.0

## 1. Visão Geral
O **Gestão Pricing 2.0** é uma aplicação web para suportar o ciclo de **precificação**, **simulação de preço/margem**, **gestão de leads (New Business)** e **workflow de CS/Business Development**. A aplicação é um frontend React que consome diretamente o **Supabase** (Auth + Postgres), com políticas de segurança via **RLS**.

Objetivos principais:
- Centralizar histórico de preços por cliente/SKU (com controles de “preço atual”, status e gatilhos).
- Permitir importação/exportação (Excel) e manutenção de dados via UI.
- Oferecer uma tela de **Simulador** com catálogo base (custos/preços/margem por código e volume).
- Suportar fluxos complementares (New Business e CS) em cima dos mesmos dados de pricing.

## 2. Stack Técnica

### Frontend
- **React 18** + **React Router v6** (rotas e navegação)
- **Vite** (dev server e build)

### UI/UX
- **Tailwind CSS**
- **Radix UI / shadcn/ui** (componentes em `frontend/src/components/ui`)
- **Lucide React** (ícones)
- **Sonner** (toasts)

### Dados e utilitários
- **Supabase JS** (`@supabase/supabase-js`): Auth + consultas ao Postgres
- **date-fns**: datas, filtros e formatação
- **XLSX**: import/export de planilhas (Pricing e Simulator)
- **Recharts**: gráficos (Analytics e CS)

## 3. Estrutura do Repositório

```
GestaoPricing/
├── frontend/
│   ├── src/
│   │   ├── components/          # Telas e componentes
│   │   ├── components/ui/       # shadcn/ui
│   │   ├── lib/utils.js         # Supabase client + helpers
│   │   └── utils/               # Funções utilitárias (pricingUtils, notifications)
│   ├── scripts/                 # Scripts SQL/JS auxiliares (setup/inspeção)
│   └── package.json
└── supabase/
    └── migrations/              # Migrações SQL do schema (fonte de verdade ideal)
```

## 4. Rotas e Telas (mapa funcional)
Rotas definidas em `frontend/src/App.jsx`:

### 4.1. Autenticação
- `/login`: autenticação via Supabase (com opção “Lembrar de mim”)
- `/cadastro`: criação de usuário (salva `nome`, `sobrenome`, `area` em `user_metadata`)
- `/forgot-password` e `/update-password`: fluxo de recuperação

### 4.2. Seleção de módulo
- `/select`: hub para escolher o “contexto” (Pricing, New Business, Business Dev, Simulador, Catálogo PRO)

### 4.3. Pricing
- `/pricing/dashboard`: gerenciamento e histórico (tabela, filtros, import/export, CRUD)
- `/pricing/analytics`: análises e visualizações (gráficos e filtros)
- `/pricing`: tela placeholder (em evolução)

### 4.4. New Business (Leads)
- `/new-business`: gestão de leads e movimentações (tabela `prices` + `price_rejections`)

### 4.5. Business Dev (CS)
- `/business-development`: workflow e acompanhamento de reajustes em cima de `pricing_history`

### 4.6. Simulator e Catálogo
- `/simulacao`: Simulador de Preços (com catálogo e histórico)
- `/catalogo-pro`: Catálogo PRO (tela em desenvolvimento)

## 5. Conexões, Camadas e Fluxo de Dados

### 5.1. Supabase Client (conexão)
O Supabase é inicializado em `frontend/src/lib/utils.js` via variáveis de ambiente:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Também existe `getApiBase()` para um backend HTTP opcional (`VITE_API_URL`), mas o fluxo principal do projeto está em **Supabase direto no frontend**.

### 5.2. Modelo de autorização (RLS + “area”)
O projeto usa, em vários pontos, a noção de “área”:
- `Pricing`
- `Pré-vendas`
- `CS`

Ela é salva em `auth.users.raw_user_meta_data->>'area'` no cadastro. Diversas políticas e regras de UI se baseiam nisso:
- Em **Pricing**, o usuário costuma ter permissões mais amplas de CRUD.
- Em fluxos de **New Business/CS**, permissões variam por tabela/política.

Importante:
- Parte do controle é feita no banco (RLS).
- Parte do controle é feita na UI (ex.: recursos exibidos só para Pricing).

## 6. Banco de Dados (Supabase/Postgres)

### 6.1. Tabelas principais e relacionamentos

#### `clients`
Cadastro de clientes.
- Campos principais: `id (uuid)`, `name`, `created_at`
- Relacionamento: 1:N com `pricing_history` e 1:N com `client_aliases`

#### `client_aliases`
Normalização de nomes/aliases para resolver inconsistências de input/import.
- Campos principais: `id`, `client_id -> clients.id`, `alias_name`
- Uso típico: mapear “apelidos”/variações para o cliente canônico.

#### `pricing_history`
Histórico de preços por cliente/SKU ao longo do tempo.
- Campos principais (variam por evolução): `client_id`, `sku`, `date`, `net_price`, `gross_price`, `margin_budget`, `currency`, `size`, `manager`, `code`, `category`, `subcategory`, `month`, `obs`, `is_current`, `gate`, `readjustment_status`, `last_price_date`, `updated_at`.
- Relacionamento: N:1 com `clients`
- Regras relevantes:
  - `readjustment_status` possui constraint (valores controlados).
  - Algumas telas determinam “preço atual” por `is_current` (quando existente) e/ou por ordenação de datas.

#### `prices` (New Business / leads)
Tabela usada para leads/oportunidades. Não é criada diretamente nas migrações mais antigas deste repositório (já existia no banco), mas é referenciada e recebe colunas/políticas em migrações mais novas.
- Campos observados via UI: `cliente`, `sku`, `precoliquido`, `precobruto`, `margembruta`, `volume`, `status`, `createdat`, `pricingid`, `category`, `subcategory`, `origin_type`, `origin_tag` (entre outros).

#### `price_rejections`
Registro de “reprovações” ligadas a um lead/preço (motivos e auditoria).
- Campos principais: `price_id -> prices.id`, `motivo`, `user_id`, `created_at`, e espelhos como `cliente`, `sku`, `preco_bruto`, `margem_bruta`.

#### `notifications`
Notificações internas consumidas pela UI (com RLS por usuário).
- Campos principais: `id`, `type`, `message`, `read`, `user_id`, `created_at`
- Observação: a UI insere notificação e trata erro caso a tabela não exista (compatibilidade com ambientes desatualizados).

#### `simulations_history` (Simulator)
Histórico de simulações realizadas/importadas.
- Campos-base (migração inicial): `id`, `created_at`, `user_id`, `sku`, `product_name`, `price`, `cost`, `margin`, `mode`
- Evoluções por migrações: `pis`, `cofins`, `icms`, `gross_price`, `user_email`, `user_name`, `version`
- Evoluções para catálogo integrado: `simulation_number`, `datasul_code`, `volume`, `client_name`, `target`, `observations`, `catalog_cost`, `catalog_price`, `catalog_gross_price`, `catalog_margin`
- Políticas importantes:
  - Insert: usuário só insere sua própria simulação (`auth.uid() = user_id`).
  - Select: permissiva para autenticados (na migração inicial), com filtragens/limitações feitas na UI.
  - Delete: permitido ao dono ou à área `Pricing` (migração específica).

#### `simulation_catalog_prices` (legado)
Tabela antiga de catálogo mantida apenas como referência histórica em migrações anteriores.
- Não faz parte do estado atual do frontend.
- O estado atual consome `catalog_br_prices` no Simulador e `catalog_br_prices` / `catalog_latam_prices` no Catálogo PRO.

#### `users` (tabela pública espelho)
A UI do Simulator faz lookup em uma tabela `public.users` para resolver o nome do usuário pelo `id`/`email`. A definição histórica dessa estrutura também aparece nos scripts legados preservados em `supabase/migrations/legacy/update_schema_v6_safe_no_data_loss.sql`, com:
- `id` (FK para `auth.users`), `nome`, `sobrenome`, `email`, `area`, timestamps
- Trigger/Function para sincronizar a partir de `auth.users`
- RLS permitindo leitura do próprio registro ou pela área `Pricing`

## 7. Funcionalidades por Módulo (detalhamento)

### 7.1. Autenticação e Sessão

#### Cadastro (`/cadastro`)
Fluxo:
1. Usuário informa `nome`, `sobrenome`, `área`, `email` e `senha`.
2. `supabase.auth.signUp()` salva os dados em `user_metadata` (campo `options.data`).
3. Dependendo da configuração do Supabase, o usuário pode precisar confirmar e-mail.

Regras:
- Validação de e-mail corporativo: `@pronutrition.com.br`.
- Áreas permitidas no cadastro (UI): `Pricing`, `Pré-vendas`, `CS`.

#### Login (`/login`)
Fluxo:
1. `supabase.auth.signInWithPassword()`
2. “Lembrar de mim”:
   - `true`: persiste em `localStorage` (`pronutrition_user`, `pronutrition_token`, `pronutrition_remember`)
   - `false`: persiste em `sessionStorage` (mesma aba)

#### Gestão de sessão global
Em `App.jsx`, a aplicação verifica:
- sessão atual do Supabase (`supabase.auth.getSession()`),
- e aplica a regra do “não lembrar” forçando logout em abas novas.

### 7.2. Pricing Dashboard (`/pricing/dashboard`)
Objetivo: ser a “mesa de operação” para cadastro/manutenção de preços.

Principais recursos:
- Carregamento de `clients` e `client_aliases` para filtro e de-para.
- Carregamento de `pricing_history` com join em `clients` (inner join para garantir cliente).
- Filtros por cliente, SKU, categoria/subcategoria, tamanho, datas, código Datasul (campo `code`), etc.
- Importação de Excel com normalização de colunas e criação/atualização de:
  - clientes (se não existirem),
  - aliases,
  - linhas em `pricing_history`.
- Realtime/refresh:
  - subscription em `postgres_changes` para a tabela `pricing_history`, recarregando a tela em inserts/updates/deletes.

Lógicas relevantes:
- “Preço atual”:
  - prioriza `is_current` quando o banco marca explicitamente,
  - caso contrário, deriva pela ordenação (`date`, `updated_at`, `created_at`).
- Categoria/Subcategoria:
  - tenta derivar categoria padrão baseada em palavras-chave quando dados estão inconsistentes.

### 7.3. Pricing Analytics (`/pricing/analytics`)
Objetivo: análises e insights em cima de `pricing_history`.

Recursos típicos:
- Filtros por cliente, SKU e período.
- Gráficos (Recharts) de evolução de preço/margem e outros agregados.
- Tratamentos para “limpar ruído” e exibir apenas pontos onde preço/margem mudaram (ver `filterChangedHistoryPoints`).

### 7.4. New Business (Leads) (`/new-business`)
Objetivo: registrar, acompanhar e atualizar oportunidades/solicitações (lead de preço).

Banco envolvido:
- `prices`: onde o lead é criado/atualizado.
- `price_rejections`: registra reprovações/motivos (auditoria).
- `notifications`: registra eventos de criação/atualização (quando tabela está disponível).

Permissões:
- Migração `20260324_new_business_permissions_prices.sql` libera INSERT/UPDATE/DELETE para áreas relacionadas (Pricing/CS/Pré-vendas).

### 7.5. Business Development / CS (`/business-development`)
Objetivo: acompanhar “gates”, prazos de comunicação e workflow do reajuste.

Banco envolvido:
- `pricing_history` (campos de workflow e contrato)

Lógicas relevantes:
- Cálculo de Gate e datas:
  - Gate é calculado por mês (`calculateGate`), mas pode ser respeitado se já existir no banco.
  - Próxima vigência e data de comunicação (ex.: 30 dias antes), com regra de carência para contratos “novos”.
- Workflow:
  - `readjustment_status` com opções controladas (`WORKFLOW_STATUS_OPTIONS`) e constraint no banco.

## 8. Tela de Simulador (`/simulacao`) — detalhamento com ênfase

### 8.1. Objetivo da tela
Permitir simular cenários de precificação por SKU/código, considerando:
- custo base,
- preço líquido e preço bruto,
- margem,
- alíquotas (PIS, COFINS, ICMS),
- fatores (comissão, frete, encargo, IPI),
com base em um **catálogo de referência** por “código Datasul” e volume.

### 8.2. Catálogo base (origem dos dados)
Consulta principal:
- `catalog_br_prices` com ordenação por `sku` e `volume`.

Comportamento esperado:
- Caso a consulta falhe, a tela deve exibir erro explícito e bloquear a simulação até novo carregamento bem-sucedido.

Chaves de seleção na UI:
- `datasul_code` (chamado de “produto” no select)
- `volume` (1000/3000/5000)

Regra de match:
- seleciona a linha do catálogo onde `datasul_code` e `volume` combinam.

### 8.3. Modos de simulação (cálculos)
A tela opera em três modos (`mode`):

#### A) Simular Margem (a partir do Preço Bruto)
Entradas:
- custo (`cost`)
- preço bruto (`grossPrice`)
- alíquotas (PIS/COFINS/ICMS)
- referência de catálogo: `catalog_price` e `catalog_gross_price` (para inferir fator líquido/bruto)

Lógica:
1. A tela calcula um fator `netFactorFromCatalog` ≈ `catalog_price / catalog_gross_price` (quando ambos > 0).
2. Deriva `preço líquido` como `netPrice = grossPrice * netFactorFromCatalog`.
3. Calcula margem como `margin = ((netPrice - cost) / netPrice) * 100`.

Observação:
- O simulador tenta manter coerência entre bruto e líquido com base no catálogo (não apenas com ICMS).

#### B) Simular Preço (a partir da Margem alvo)
Entradas:
- custo (`cost`)
- margem (`margin`)
- referência para converter líquido ↔ bruto (mesmo `netFactorFromCatalog`)

Lógica:
1. `netPrice = cost / (1 - marginRate)`
2. `grossPrice = netPrice / netFactorFromCatalog`

#### C) Simular Preço Bruto (gross-up por impostos)
Entradas:
- preço líquido (`price`)
- alíquotas PIS/COFINS/ICMS

Lógica:
1. Calcula `fatorImp = 1 - pisLiq - cofinsLiq - icms`, onde:
   - `pisLiq = pisRate * (1 - icmsRate)`
   - `cofinsLiq = cofinsRate * (1 - icmsRate)`
2. Estima `grossPrice = price / fatorImp`.

### 8.4. Salvar simulação no histórico
Ao salvar, a UI insere em `simulations_history`:
- identificação do usuário (`user_id`, `user_email`, `user_name`)
- identificação do item (`sku`, `product_name`, `datasul_code`, `volume`)
- números simulados (`cost`, `price` líquido, `gross_price`, `margin`)
- parâmetros fiscais (`pis`, `cofins`, `icms`)
- metadados do atendimento (`client_name`, `target`, `observations`)
- “snapshot do catálogo” (`catalog_cost`, `catalog_price`, `catalog_gross_price`, `catalog_margin`)

Por que salvar o snapshot do catálogo:
- Para permitir auditoria e comparação futura mesmo que o catálogo seja atualizado depois.

### 8.5. Histórico e governança
Carregamento:
- consulta `simulations_history` (últimas 50), excluindo `mode = 'import'` na listagem principal.

Enriquecimento de nomes:
- busca adicional em `public.users` por `id` e por `email` para exibir um nome amigável.

Exclusão:
- A UI tenta excluir linhas de `simulations_history` e valida se o banco retornou um registro deletado.
- Banco controla via policy: dono ou área `Pricing`.

Importação via Excel:
- Lê a planilha e mapeia colunas como: “ID simulação”, “Versão”, “Custo”, “Margem”, “Preço líquido”, “Preço bruto”.
- Insere em `simulations_history` com `mode = 'import'` e `version`.

### 8.6. Observações importantes (pontos de atenção)
- Alguns parâmetros (comissão/frete/encargo/IPI) impactam a simulação na UI, mas não são persistidos no histórico na implementação atual.
- A UI possui ações de “aprovar/reprovar” simulação (campos como `approval_status`, `approved_at` etc.). Esses campos precisam existir no banco para o update funcionar; caso não existam, a operação falhará no Supabase.

## 9. Tela Catálogo PRO (`/catalogo-pro`) — detalhamento com ênfase

### 9.1. Estado atual
Atualmente a tela `Catálogo PRO` está ativa e consome catálogos separados para Brasil e Latam.

### 9.2. Conexão esperada com o banco (base já criada)
O estado atual do frontend utiliza:
- `catalog_br_prices`
- `catalog_latam_prices`

Essas tabelas contêm o conjunto mínimo para o Catálogo PRO:
- identificação do produto (`datasul_code`, `sku`)
- dimensões comerciais (`volume`)
- referências econômicas (`catalog_cost`, `catalog_price`, `catalog_gross_price`, `catalog_margin`, `price_brl`, `price_usd`)

### 9.3. Como isso se conecta ao Simulator
A tela do Simulador consome `catalog_br_prices`. Ou seja:
- O Catálogo PRO é a tela de manutenção/curadoria dos catálogos.
- O Simulator é a tela de consumo operacional do catálogo Brasil.

### 9.4. Proposta de funcionalidades para o Catálogo PRO (alinhadas ao schema atual)
Com o schema atual, o Catálogo PRO pode evoluir para:
- Listagem e filtros por `datasul_code`, `sku` e `volume`
- CRUD (inserir/editar) respeitando unicidade por `sku` e `volume`
- Importação de planilha para atualizar catálogo em lote
- Auditoria (usar `created_at/updated_at`) e logs (opcional via `notifications`)

## 10. Execução Local

Pré-requisitos:
- Node.js
- npm/yarn

Rodar o frontend:
```bash
cd frontend
npm install
npm run dev
```

Acesso:
- `http://localhost:5173`

## 11. Migrações e evolução do schema

Fonte principal:
- `supabase/migrations/` contém o histórico versionado do schema atual, permissões e RLS.

Legado preservado:
- `supabase/migrations/legacy/` contém os scripts manuais históricos `update_schema_v2.sql` até `update_schema_v6_safe_no_data_loss.sql`.
- Esses arquivos foram aplicados de forma inconsistente entre ambientes e hoje servem apenas como referência histórica. Não devem ser executados como parte do fluxo atual.

Scripts auxiliares:
- `frontend/scripts/` contém apenas scripts operacionais e de inspeção locais, sem fazer parte da cadeia oficial de migrações.
