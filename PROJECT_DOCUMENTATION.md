# Documentação do Projeto — Gestão Pricing 2.0

## 1. Visão Geral
O **Gestão Pricing 2.0** é uma aplicação web para suportar o ciclo de **precificação**, **simulação de preço/margem**, **gestão de leads (New Business)** e **workflow de CS/Business Development**. A aplicação é um frontend React que consome diretamente o **Supabase** (Auth + Postgres), com políticas de segurança via **RLS**.

Objetivos principais:
- Centralizar histórico de preços por cliente/SKU (com controles de "preço atual", status e gatilhos).
- Permitir importação/exportação (Excel) e manutenção de dados via UI.
- Oferecer uma tela de **Simulador** com catálogo base (custos/preços/margem por código e volume), políticas mínimas e 5 modos de simulação.
- Oferecer **Catálogo PRO Brasil e Latam** com custos abertos do VBA e reconciliação em lote.
- Suportar fluxos complementares (New Business e CS) em cima dos mesmos dados de pricing.
- Log de auditoria centralizado via `public.activity_log` (sino de atividades exclusivo Pricing).

## 2. Stack Técnica

### Frontend
- **React 18** + **React Router v6** (rotas e navegação)
- **Vite** (dev server e build — porta default 5174)

### UI/UX
- **Tailwind CSS**
- **Radix UI / shadcn/ui** (componentes em `frontend/src/components/ui`)
- **Lucide React** (ícones)
- **Sonner** (toasts)

### Dados e utilitários
- **Supabase JS** (`@supabase/supabase-js`): Auth + consultas ao Postgres
- **date-fns**: datas, filtros e formatação
- **XLSX**: import/export de planilhas (Pricing, Simulator, Catálogo PRO)
- **Recharts**: gráficos (Analytics e CS)

## 3. Estrutura do Repositório

```
GestaoPricing/
├── frontend/
│   ├── src/
│   │   ├── components/          # Telas e componentes (SimulationPage, CatalogoPro, Header)
│   │   ├── components/ui/       # shadcn/ui (Radix)
│   │   ├── contexts/            # AuthContext (sessão + área + regra remember)
│   │   ├── lib/utils.js         # Supabase client + helpers gerais
│   │   └── utils/               # Regras de negócio
│   │       ├── pricingUtils.js
│   │       ├── simulationPricing.js
│   │       ├── activityLog.js                      # logImport, logExport + polling de atividades
│   │       ├── catalogImportReconciliation.js      # parseVbaVersaoLabel + reconcileVbaCatalogRow
│   │       └── catalogImportReconciliation.test.js
│   ├── scripts/                 # Scripts SQL/JS auxiliares (SEM versionamento — não são migrações)
│   └── package.json
└── supabase/
    └── migrations/              # Migrações SQL do schema (fonte de verdade ideal)
```

## 3.5. Arquivos de utilitário de negócio (`frontend/src/utils/`)

| Arquivo | Propósito |
|---|---|
| `simulationPricing.js` | Cálculo de preço/margem e conversão bruto↔líquido via alíquotas e fatores abertos (denominador igual VBA). |
| `pricingUtils.js` | Helpers gerais: formatação de moeda, normalização de strings para lookup (`normalizeLookupValue`), gate calculado, etc. |
| `activityLog.js` | **Não usa mais tabela `notifications`**. Comunica-se com `public.activity_log` via RPC (`unread_activity_count`, `mark_activity_read`, `log_export`, `log_import`). Regras: polling 60s respeitando `document.visibilityState`, carregamento incremental (~20 itens), exportações/importações instrumentadas manualmente com `try/catch` não bloqueante. |
| `catalogImportReconciliation.js` | Ponto único de lógica compartilhada entre Catálogo BR e Preços Mínimos. **Não duplicar funções daqui.** |

### `catalogImportReconciliation.js` — API
```js
parseVbaVersaoLabel(versaoRaw, volumeColuna)
// Entrada : "Nome Produto (1K)"  + volumeColuna=1000
// Saída   : { skuLimpo: "Nome Produto", volumeExtraido: 1000, bateComVolume: true, temSufixoNk: false }
// Trata   : sufixo "(NK)", "(K)" vs coluna volume, normaliza (K/MIL) e casas decimais
// Atenção : skuLimpo DEVE ser salvo como `versao` para o match com `sku` do catálogo funcionar.
//           Se gravar com "(NK)" embutido a política mínima para de proteger (fail-open).

reconcileVbaCatalogRow({
  custoTotal, precoLiq, precoBruto, margemInformada,
  custoMp, custoEmb, custoPerda, custoGgf, custoMod,
  freteValor, encargoValor, comissaoValor, impostosValor
})
// Retorna: { ok: true, derived: { icms_rate, pis_rate, cofins_rate,
//                                   frete_rate, comissao_rate, encargo_rate } }
//      ou: { ok: false, errors: ['custoTotal não bate com soma de abertos', '...'] }
//
// Premissas hardcoded alinhadas ao VBA:
//   PIS    = 1,65% fixo sobre preço líquido (FORA do ICMS)
//   COFINS = 7,60% fixo sobre preço líquido (FORA do ICMS)
//   ICMS   = calculado por linha a partir de impostosValor informado
```

## 4. Rotas e Telas (mapa funcional)
Rotas definidas em `frontend/src/App.jsx`:

### 4.1. Autenticação
- `/login`: autenticação via Supabase (com opção "Lembrar de mim")
- `/cadastro`: criação de usuário (salva `nome`, `sobrenome`, `area` em `user_metadata`)
- `/forgot-password` e `/update-password`: fluxo de recuperação **com estabelecimento explícito de sessão** antes de `updateUser`

### 4.2. Seleção de módulo
- `/select`: hub para escolher o "contexto" (Pricing, New Business, Business Dev, Simulador, Catálogo PRO)

### 4.3. Pricing
- `/pricing/dashboard`: gerenciamento e histórico (tabela, filtros, import/export, CRUD)
- `/pricing/analytics`: análises e visualizações (gráficos e filtros)
- `/pricing`: tela placeholder (em evolução)

### 4.4. New Business (Leads)
- `/new-business`: gestão de leads e movimentações (tabela `prices` + `price_rejections`)

### 4.5. Business Dev (CS)
- `/business-development`: workflow e acompanhamento de reajustes em cima de `pricing_history`

### 4.6. Simulator e Catálogo
- `/simulacao`: Simulador de Preços (catálogo Brasil, 5 modos de simulação, política mínima, importador de regras mínimas, persistência de `frete`)
- `/catalogo-pro`: Catálogo PRO (Brasil + Latam com custos abertos do VBA, importação em lote e popups de colunas)

### 4.7. Log de auditoria / Atividades (Header)
Sino de atividades exclusivo para usuários da área `Pricing`. Consome a view/RPC `activity_log` no banco:
- Badge com contagem não lidas via **polling de 60s** (pausa quando `document.visibilityState !== 'visible'`)
- Painel abre em popover com `summary` formatado em PT-BR (produzido 100% no banco via trigger), data relativa, filtros por período, paginação de ~20 itens
- Marca como lidas via RPC `mark_activity_read`
- Exportações e importações são **registradas manualmente** via RPC `log_export` / `log_import` após sucesso, dentro de `try/catch` para **não bloquear** o fluxo principal

## 5. Conexões, Camadas e Fluxo de Dados

### 5.1. Supabase Client (conexão)
O Supabase é inicializado em `frontend/src/lib/utils.js` via variáveis de ambiente:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Também existe `getApiBase()` para um backend HTTP opcional (`VITE_API_URL`), mas o fluxo principal do projeto está em **Supabase direto no frontend**.

### 5.2. Modelo de autorização (RLS + "area")
O projeto usa, em vários pontos, a noção de "área":
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
- Uso típico: mapear "apelidos"/variações para o cliente canônico.

#### `pricing_history`
Histórico de preços por cliente/SKU ao longo do tempo.
- Campos principais: `client_id`, `sku`, `date`, `net_price`, `gross_price`, `margin_budget`, `currency`, `size`, `manager`, `code`, `category`, `subcategory`, `month`, `obs`, `is_current`, `gate`, `readjustment_status`, `last_price_date`, `updated_at`
- Relacionamento: N:1 com `clients`
- Regras relevantes:
  - `readjustment_status` possui constraint (valores controlados).
  - Algumas telas determinam "preço atual" por `is_current` (quando existente) e/ou por ordenação de datas.

#### `prices` (New Business / leads)
Tabela usada para leads/oportunidades. Não é criada diretamente nas migrações mais antigas (já existia no banco), mas recebe colunas/políticas em migrações mais novas.
- Campos observados via UI: `cliente`, `sku`, `precoliquido`, `precobruto`, `margembruta`, `volume`, `status`, `createdat`, `pricingid`, `category`, `subcategory`, `origin_type`, `origin_tag`

#### `price_rejections`
Registro de "reprovações" ligadas a um lead/preço (motivos e auditoria).
- Campos principais: `price_id -> prices.id`, `motivo`, `user_id`, `created_at`, e espelhos como `cliente`, `sku`, `preco_bruto`, `margem_bruta`.

#### `activity_log` (substitui `notifications`)
Log de auditoria centralizado **no banco** (via triggers + RPCs manuais para exportações/importações).
- Estrutura: `id`, `user_id`, `table_name`, `operation`, `record_id`, `summary` (PT-BR formatado no banco), `created_at`
- **RLS**: bloqueia UPDATE/DELETE (logs imutáveis pela aplicação); SELECT permitido por usuário dono ou área `Pricing`
- **RPCs consumidas pelo frontend**: `unread_activity_count`, `mark_activity_read`, `log_export`, `log_import`
- Regras duras de UI (ver activityLog.js / project_memory):
  - O texto `summary` **já vem formatado pelo banco em pt-BR** e deve ser exibido como está, sem reconstrução no frontend.
  - Exportações e importações **não são capturadas por trigger** (SELECT não dispara trigger). Portanto são instrumentadas **no frontend** após sucesso, com `try/catch` não bloqueante.

#### `notifications` (legado, REMOVIDO da UI)
Antiga tabela de notificações. Pode existir em ambientes antigos mas **não é mais usada**. Qualquer referência a `addNotification` foi removida da UI e dos utils.

#### `simulations_history` (Simulator)
Histórico de simulações realizadas/importadas.
- Campos-base (migração inicial): `id`, `created_at`, `user_id`, `sku`, `product_name`, `price`, `cost`, `margin`, `mode`
- Evoluções por migrações: `pis`, `cofins`, `icms`, `gross_price`, `user_email`, `user_name`, `version`
- Evoluções catálogo: `simulation_number`, `datasul_code`, `volume`, `client_name`, `client_id`, `target`, `observations`, `catalog_cost`, `catalog_price`, `catalog_gross_price`, `catalog_margin`
- **Campo adicionado 2026-08**: `frete numeric default 0`
  - Persistido em **todos os modos** de simulação (mesmo sendo 0).
  - UI de edição só existe na aba **Simular Frete**.
  - `useEffect` reseta `frete = 0` ao sair da aba FREIGHT (garante que só FREIGHT tem frete ≠ 0).
- Políticas importantes:
  - Insert: usuário só insere sua própria simulação (`auth.uid() = user_id`).
  - Select: permissiva para autenticados, com filtragens/limitações feitas na UI.
  - Delete: permitido ao dono ou à área `Pricing` (migração `20260318_add_delete_policy_simulations_history.sql`).

#### `catalog_br_prices` (Catálogo PRO Brasil + consumo do Simulator)
Tabela de catálogo Brasil, alimentada por importação em lote com reconciliação VBA.
- Unicidade (constraint/make-sure): `(sku, volume)`
- Identificação do produto: `datasul_code`, `sku`, `product_name`
- Dimensões comerciais: `volume`
- Preços e margem base: `catalog_cost`, `catalog_price` (líquido), `catalog_gross_price`, `catalog_margin`
- Preços unitários: `price_brl`, `price_usd`
- **Campos VBA abertos (adicionados 2026-08, fora das migrações versionadas)**:
  - `custo_total numeric`, `preco_liq numeric`
  - `custo_mp numeric`, `custo_emb numeric`, `custo_perda numeric`, `custo_ggf numeric`, `custo_mod numeric`
  - `frete_valor numeric`, `encargo_valor numeric`, `comissao_valor numeric`, `impostos_valor numeric`
  - `icms_rate numeric`, `pis_rate numeric`, `cofins_rate numeric`
  - `frete_rate numeric`, `comissao_rate numeric`, `encargo_rate numeric`
  - `id_versao_vba text`, `data_versao_vba date` (nullable; serial Excel grava null automaticamente, não bloqueia linha)
- ⚠️ **Aviso de "fora das migrações"**: colunas abertas do VBA foram aplicadas direto no banco PRD. Não rodar migration recriando a tabela. Refletir no migration futuramente.

#### `catalog_latam_prices` (Catálogo PRO Latam)
Paralelo a `catalog_br_prices` para América Latina. Schema similar com campos em USD na maioria, sem integração com Simulator por enquanto.

#### `simulation_minimum_price_rules` (Política mínima do Simulador)
Regras de "chão" por versão e volume. Aplicadas no Simulador nos modos **MARGIN / PRICE / FREIGHT** antes de permitir salvar.
- Match: `(versao, volume)` onde `versao` **deve normalizar igual** ao `catalog_br_prices.sku` (usando `normalizeLookupValue`).
- Valores base: `custo_total numeric`, `preco_liq numeric` (chão para comparação de margem e preço líquido).
- **Mesmo schema de campos VBA do catalog_br (2026-08)**:
  `custo_mp, custo_emb, custo_perda, custo_ggf, custo_mod`,
  `frete_valor, encargo_valor, comissao_valor, impostos_valor`,
  `icms_rate, pis_rate, cofins_rate, frete_rate, comissao_rate, encargo_rate`,
  `id_versao_vba text, data_versao_vba date`.
- ⚠️ **Risco crítico (fail-open)**: `evaluateMinimumPolicy` é **fail-open** — se não encontrar nenhuma regra por `(versao, volume)`, não avisa o usuário e **não bloqueia o save**. Portanto:
  1. Nunca gravar `versao` com sufixo "(NK)" embutido. Sempre gravar `skuLimpo` de `parseVbaVersaoLabel`.
  2. `versao` e `catalog_br_prices.sku` precisam normalizar para a **mesma string**.
  3. Volume exato. Sem match → nenhuma proteção. A regra fica silenciosamente inativa.

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
2. "Lembrar de mim" (controlo em `AuthContext.syncSession`):
   - `true`: persiste em `localStorage` (`pronutrition_user`, `pronutrition_token`, `pronutrition_remember`)
   - `false`: usa sessionStorage / persistência padrão do Supabase, e em tabs novas ou reload sem remember o `syncSession` força `signOut` para garantir "não lembrar".

#### Gestão de sessão global (`AuthContext.jsx`)
- `syncSession()` roda no mount de qualquer página.
- Se houver sessão ativa, a mantém quando: `remember === true` OU existe `pronutrition_user` no storage OU a rota é **`/update-password`** (sessão de recuperação de senha; não deslogar prematuro).
- Fora desse conjunto a sessão sem remember é deslogada automaticamente.

#### Fluxo de reset de senha (`/update-password`)
Ordem obrigatória (UpdatePassword.jsx):
1. **Estabelecer sessão antes de qualquer submit** — o link de reset pode chegar em 3 formatos:
   - `?code=...` (PKCE) → `supabase.auth.exchangeCodeForSession(code)`
   - `?token_hash=...` / `?token=...` + `?type=...` → `supabase.auth.verifyOtp({ token_hash, type })`
   - Nenhum dos dois (hash implícito / sessão recuperada pelo client) → `supabase.auth.getSession()` exige sessão ativa.
2. Em caso de falha: erro na área de erro e botão permanece desabilitado via `sessionReady = false`.
3. Submit com sucesso:
   - `supabase.auth.updateUser({ password })`
   - `supabase.auth.signOut()` logo em seguida (encerra a sessão de recuperação para não permitir navegação client-side já-logado).
   - Tela troca para estado "concluído": só mensagem de sucesso + botão "Voltar para login". Nenhum auto-redirect.

### 7.2. Pricing Dashboard (`/pricing/dashboard`)
Objetivo: ser a "mesa de operação" para cadastro/manutenção de preços.

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
- "Preço atual":
  - prioriza `is_current` quando o banco marca explicitamente,
  - caso contrário, deriva pela ordenação (`date`, `updated_at`, `created_at`).
- Categoria/Subcategoria:
  - tenta derivar categoria padrão baseada em palavras-chave quando dados estão inconsistentes.

### 7.3. Pricing Analytics (`/pricing/analytics`)
Objetivo: análises e insights em cima de `pricing_history`.

Recursos típicos:
- Filtros por cliente, SKU e período.
- Gráficos (Recharts) de evolução de preço/margem e outros agregados.
- Tratamentos para "limpar ruído" e exibir apenas pontos onde preço/margem mudaram (ver `filterChangedHistoryPoints`).

### 7.4. New Business (Leads) (`/new-business`)
Objetivo: registrar, acompanhar e atualizar oportunidades/solicitações (lead de preço).

Banco envolvido:
- `prices`: onde o lead é criado/atualizado.
- `price_rejections`: registra reprovações/motivos (auditoria).
- `activity_log`: registra eventos de criação/atualização via triggers de banco.

Permissões:
- Migração `20260324_new_business_permissions_prices.sql` libera INSERT/UPDATE/DELETE para áreas relacionadas (Pricing/CS/Pré-vendas).

### 7.5. Business Development / CS (`/business-development`)
Objetivo: acompanhar "gates", prazos de comunicação e workflow do reajuste.

Banco envolvido:
- `pricing_history` (campos de workflow e contrato)

Lógicas relevantes:
- Cálculo de Gate e datas:
  - Gate é calculado por mês (`calculateGate`), mas pode ser respeitado se já existir no banco.
  - Próxima vigência e data de comunicação (ex.: 30 dias antes), com regra de carência para contratos "novos".
- Workflow:
  - `readjustment_status` com opções controladas (`WORKFLOW_STATUS_OPTIONS`) e constraint no banco.

## 8. Tela de Simulador (`/simulacao`) — detalhamento com ênfase

### 8.1. Objetivo da tela
Permitir simular cenários de precificação por SKU/código, considerando:
- custo base,
- preço líquido e preço bruto,
- margem,
- alíquotas (PIS **fixo 1,65%**, COFINS **fixo 7,6%**, ICMS variável por linha ou importação),
- fatores (comissão, **frete** agora editável, encargo, IPI),
com base em um **catálogo de referência** por "código Datasul" e volume.
Políticas mínimas de `simulation_minimum_price_rules` são aplicadas em MARGIN / PRICE / FREIGHT.

### 8.2. Catálogo base (origem dos dados)
Consulta principal:
- `catalog_br_prices` com ordenação por `sku` e `volume`.

Comportamento esperado:
- Caso a consulta falhe, a tela deve exibir erro explícito e bloquear a simulação até novo carregamento bem-sucedido.

Chaves de seleção na UI:
- `datasul_code` (chamado de "produto" no select)
- `volume` (1000/3000/5000)

Regra de match:
- seleciona a linha do catálogo onde `datasul_code` e `volume` combinam.

### 8.3. Modos de simulação (cálculos)
A tela opera em **5 modos** (`SIMULATION_MODES`). Os 2 primeiros compartilham a mesma matemática de conversão líquido↔bruto via alíquotas (não usa mais o fator `netFactorFromCatalog` derivado de preços do catálogo — o antigo netFactor foi removido).

#### Premissas usadas em MARGIN / PRICE / FREIGHT (todas iguais ao VBA):
```
taxaPis = 0,0165   (fixo, sobre preço líquido — FORA do ICMS)
taxaCofins = 0,076 (fixo, sobre preço líquido — FORA do ICMS)
taxaIcms = 0..N    (definido pelo usuário ou herdado da importação)
fatores somados no denominador:
   comissaoRate + freteRate + encargoRate
e IPI rateado no numerador se aplicavel.
```
O cálculo resolve o preço líquido a partir do custo/margem usando a fórmula de **denominador 1 - margem - pisLiq - cofinsLiq - icms*líquido - comissão - frete - encargo**, exatamente como no VBA. Depois converte para bruto usando o mesmo conjunto de impostos.

#### A) Simular Margem (MARGIN)
- Entradas editáveis: `preço bruto`, `custo` trava por catálogo.
- Resultados: preço líquido calculado a partir do bruto, e a **margem resultante**.

#### B) Simular Preço (PRICE)
- Entradas editáveis: `margem alvo (%)`. Custo trava por catálogo.
- Resultados: preço líquido e preço bruto sugeridos para bater a margem.

#### C) Simular Frete (FREIGHT) **— NOVIDADE 2026-08**
Idêntico ao PRICE em matemática. **Muda só a UI**:
- Entradas editáveis: `Frete (%)` e `Margem Alvo (%)` (esta última pré-preenchida pelo catalog_margin do SKU selecionado).
- Custo trava por catálogo.
- `frete` só é editável nesta aba. Ao sair da aba para qualquer outra, `useEffect` reseta `frete = 0` automaticamente.
- Política mínima (8.7) também é aplicada aqui.

#### D) Simular Preço Bruto (GROSS_CALCULATION — gross-up por impostos)
Modo separado de conversão líquido → bruto, sem envolver catálogo.
- Entradas: `preço líquido (price)` + alíquotas PIS/COFINS/ICMS editáveis
- Saída: `preço bruto` calculado por gross-up (soma impostos sobre a base de dentro do ICMS)

#### E) Simular Preço Líquido (NET_CALCULATION — bruto → líquido)
Inverso do D. Entrada bruta, saída líquida com PIS/COFINS/ICMS.
Ambos D/E não entram em política mínima, não travam custo, não usam catálogo para margem default.

### 8.4. Salvar simulação no histórico
Ao salvar, a UI insere em `simulations_history` com:
- identificação do usuário (`user_id`, `user_email`, `user_name`)
- identificação do item (`sku`, `product_name`, `datasul_code`, `volume`)
- números simulados (`cost`, `price` líquido, `gross_price`, `margin`)
- parâmetros fiscais (`pis`, `cofins`, `icms`)
- **NOVO 2026-08**: `frete` (em todos os modos; default 0 se não for FREIGHT)
- metadados do atendimento (`client_name`, `target`, `observations`)
- "snapshot do catálogo" (`catalog_cost`, `catalog_price`, `catalog_gross_price`, `catalog_margin`)

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
- Lê a planilha e mapeia colunas como: "ID simulação", "Versão", "Custo", "Margem", "Preço líquido", "Preço bruto".
- Insere em `simulations_history` com `mode = 'import'` e `version`.

### 8.6. Importador de regras mínimas (Preços Mínimos) — 2026-08
Em `SimulationPage.handleMinimumRulesFileChange`, mesmo padrão do importador Brasil do Catálogo PRO. **Reutiliza `catalogImportReconciliation.js` (não duplicar)**.

#### Resumo do fluxo (mesma API usada no Catálogo BR)
1. **Aliases de coluna expandidos (2026-08)**:
   - `versao` (existe antes)
   - `custoTotal:['custototal']`, `precoLiq:['precoliq']`, `precoBruto:['precobruto']`, `margem:['margem']`, `volume:['volume']`
   - `custoMp, custoEmb, custoPerda, custoGgf, custoMod`
   - `freteValor`, `encargoValor:['encargofinancvalor']`, `comissaoValor`, `impostosValor`
   - `idVersaoVba:['idversao']`, `dataVersaoVba:['dataversao']`
2. **Uma ÚNICA derivação de `versao` por linha** via `parseVbaVersaoLabel(versaoRaw, volume)`.
   - `versaoFinal = skuLimpo` (sempre sem sufixo "(NK)").
   - Usada em obrigatórios, chave de deduplicação e payload final. Nunca lê `versao` crua duas vezes.
3. **Campos VBA opcionais**: sem eles → importa como antes (base só).
4. **Com todos os 9 campos numéricos**: roda `reconcileVbaCatalogRow(...)`.
   - `ok:false` → `invalidRows++`, linha **fica FORA do payload**, motivo em amostra de erros (até 10), toast informa.
   - `ok:true` → salva campos abertos + `derived` (taxas) no upsert.
5. **`data_versao_vba` null-safe**: valor não for data pronta para Postgres (serial Excel p. ex.) → grava `null` automaticamente, NÃO bloqueia linha, NÃO conta erro, NÃO avisa.
6. **Toast curto** de sucesso/quantidades + `logImport(..., p_table_name='simulation_minimum_price_rules', ...)` dentro de try/catch não bloqueante.

### 8.7. Política mínima e "fail-open" (RISCO se versao/sku divergirem)
**Aplicado em MARGIN/PRICE/FREIGHT**, antes do `handleSaveSimulation` permitir salvar.

Lookup (em `selectedMinimumRule`):
```js
normalizeLookupValue(rule.versao) === normalizeLookupValue(catalogEntry.sku)
  AND rule.volume === volume (exato)
```
Se encontrar → compara `preço_líquido_resultante >= rule.preco_liq` + `margem >= rule.custo_total derivada`. Abaixo → bloqueio com warning explícito.

**Se NÃO encontrar regra nenhuma → `evaluateMinimumPolicy` é FAIL-OPEN**:
- Não avisa o usuário.
- Não bloqueia o save.
- A regra simplesmente não é aplicada.

Isso é por design (para catálogos sem mínimos não travar operação), mas tem um perigo: **se as versões forem gravadas com nomes que não normalizam igual ao sku, a proteção cai silenciosamente**.

Resumo de regras de integridade para importação:
- ❌ **NÃO** grave `"Produto X (NK)"` em `versao` se `catalog_br_prices.sku` é `"Produto X"`.
- ✅ Grave sempre `skuLimpo` retornado por `parseVbaVersaoLabel`.
- ✅ `volume` exato (float tolerance).
- ✅ Rastreabilidade: se algo não estiver batendo, cheque `normalizeLookupValue` nos dois valores.

### 8.8. Observações importantes (pontos de atenção)
- `comissao` e `ipi`: já entram na matemática desde antes, mas **ainda não têm UI de edição dedicada** fora do import VBA e não são persistidos no `simulations_history` (fora de escopo 2026-08 — só `frete` entrou).
- A UI possui ações de "aprovar/reprovar" simulação (campos como `approval_status`, `approved_at` etc.). Esses campos precisam existir no banco para o update funcionar; caso não existam, a operação falhará no Supabase.

## 9. Tela Catálogo PRO (`/catalogo-pro`) — detalhamento com ênfase

### 9.1. Estado atual
Tela `Catálogo PRO` ativa e consome **Brasil e Latam** como abas independentes. Importações em lote com reconciliação VBA só na aba Brasil (Latam mantém fluxo antigo por enquanto).

### 9.2. Schemas
O estado atual do frontend usa:
- `catalog_br_prices` (schema completo na § 6)
- `catalog_latam_prices`

### 9.3. Como isso se conecta ao Simulator
A tela do Simulador **consome `catalog_br_prices`**. Ou seja:
- O Catálogo PRO é a tela de manutenção/curadoria dos catálogos.
- O Simulator é a tela de consumo operacional do catálogo Brasil.

### 9.4. Importador Brasil (custos abertos VBA + popup de colunas) — 2026-08
Mesmo padrão do importador de Preços Mínimos (mesmos aliases, mesma reconciliação, **mesma regra de `versao` derivada UMA vez**).

Diferenças pontuais:
- Tabela destino: `catalog_br_prices`
- `logImport(..., p_table_name='catalog_br_prices', ...)`
- Popup de "Colunas detectadas" no carregamento inicial da planilha (Brasil e Latam têm popup), com seção "Avançado" mostrando os campos VBA abertos reconhecidos.
- Latam ainda não reconcilia VBA.

### 9.5. Funcionalidades disponíveis hoje
- Listagem e filtros por `datasul_code`, `sku` e `volume`
- CRUD (inserir/editar) respeitando unicidade por `sku` e `volume`
- Importação de planilha em lote, com reconciliação VBA e log de auditoria
- Auditoria via `created_at/updated_at` + `activity_log` em ações de importação

## 10. Execução Local

Pré-requisitos:
- Node.js 18+
- Yarn 1.x

Rodar o frontend:
```bash
cd frontend
yarn install
yarn dev
```

Acesso:
- `http://localhost:5174`

## 11. Migrações e evolução do schema

Fonte principal:
- `supabase/migrations/` contém o histórico versionado do schema atual, permissões e RLS.

Legado preservado:
- `supabase/migrations/legacy/` contém os scripts manuais históricos `update_schema_v2.sql` até `update_schema_v6_safe_no_data_loss.sql`.
- Esses arquivos foram aplicados de forma inconsistente entre ambientes e hoje servem apenas como referência histórica. **Não devem ser executados como parte do fluxo atual.**

Scripts auxiliares (NÃO são migrações):
- `frontend/scripts/` contém apenas scripts operacionais e de inspeção locais, sem fazer parte da cadeia oficial de migrações. **Não versionar novos schemas por aqui.** Use `supabase/migrations/`.

### 11.1. Avisos de "fora das migrações" (2026-08)
As seguintes colunas/tabelas foram aplicadas direto no banco e **ainda não estão refletidas em migration versionada**. Refletir em migrations futuras antes de um `supabase db reset` em ambientes limpos:
- Colunas VBA abertos + `id_versao_vba`, `data_versao_vba` em `catalog_br_prices`.
- Mesmo conjunto em `simulation_minimum_price_rules`.
- Coluna `frete numeric default 0` em `simulations_history`.
- Tabela, triggers e RPCs de `activity_log` (script SQL foi aplicado em PRD, não consta em `supabase/migrations/`).
