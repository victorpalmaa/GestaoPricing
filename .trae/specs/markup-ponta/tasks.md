# Markup de Ponta - Implementation Plan

## Task 1: Criar lib/pricing/markupPonta.js (lógica pura)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Implementar calcularMarkupPonta(precoPonta, precoBruto, moedaPonta, moedaBruto)
  - Implementar selecionarColetaReferencia(coletas) com canal 'Site próprio' + DISTINCT ON (collected_at desc, created_at desc)
  - Implementar agregarMarkupPontaPorCategoria(linhas) com categoria normalizada e "Sem categoria"
  - Implementar formatarMarkupPonta(valor): 1 casa decimal, vírgula; null→"-"
  - PTAX = 4.63 hardcoded; guard gross_price null/<=0 → null
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7
- **Test Requirements**:
  - `rule` TR-1.1: 140/20.88 → "6,7" formatado
  - `rule` TR-1.2: 150/3.35 → ~44.776; não é filtrado por agregado
  - `rule` TR-1.3: precoBruto 0 ou null → retorna null
  - `rule` TR-1.4: BRL 140 vs USD 4.51 (PTAX 4,63) → "6,7"
  - `rule` TR-1.5: site próprio + marketplace → retorna site próprio mais recente; apenas marketplace → null
  - `rule` TR-1.6: agregado com "Gel"/"gel"/"" → categoria normalizada, cobertura e mediana/média batem
  - `rule` TR-1.7: formatarMarkupPonta(6.7)==="6,7"; formatarMarkupPonta(44.776)==="44,8"; formatarMarkupPonta(null)==="-"
- **Notes**: Nome do arquivo exato: frontend/src/lib/pricing/markupPonta.js

## Task 2: Escrever Vitest markupPonta.test.js
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1 (escopo lógico, podem ser criados em paralelo com TDD)
- **Description**:
  - Cobrir todos os casos do TR-1.x
  - Caso adicional: moeda divergente com sinalização (retorna valor mas marca moedaConvertida=true no detalhe)
  - Caso adicional: categoria vazia/whitespace → "Sem categoria"
  - Caso adicional: mediana com array par de valores
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7
- **Test Requirements**:
  - `rule` TR-2.1: `yarn vitest run markupPonta` exit code 0
  - `rubric` TR-2.2: cobertura dos guards de dados; scale 1-3; 1=apenas happy path; 2=guards principais; 3=todos os casos do AC+edge cases (moeda vazia normaliza para BRL, valores string numéricos, etc.); threshold >=3
  - Evidence: `yarn vitest run markupPonta --reporter=verbose` output
- **Notes**: Arquivo em frontend/src/lib/pricing/markupPonta.test.js

## Task 3: PricingDashboard.jsx — Subscription client_retail_prices e remodelar popup Visão A
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
  - Adicionar subscription realtime em client_retail_prices no PricingDashboard (junto da já existente de pricing_history)
  - Carregar TODAS as coletas de client_retail_prices (não apenas a mais recente) por (client_id, datasul_code), incluindo source e collected_at; guardar em Map de arrays
  - Popup retailDetailOpen:
    - Usar calcularMarkupPonta() e selecionarColetaReferencia()
    - Exibir markup de ponta formatado
    - Sinalizar markup fora [1.5,15] com texto "Verificar unidade de embalagem"
    - Sinalizar se PTAX foi usada
    - Listar coletas de outros canais claramente rotulados (fora do cálculo principal)
    - Exibir qual coleta foi usada (canal, data, preço, moeda)
  - Coluna "Markup ponta" da tabela: trocar formatMarkup (antigo 2 casas + "x") por formatarMarkupPonta (1 casa, sem x). Manter tiers/cores apenas se forem reaproveitáveis; caso contrário remover tier do cálculo de ponta pois é outra métrica.
  - Garantir que NENHUM useState guarda markup derivado; tudo useMemo
- **Acceptance Criteria Addressed**: AC-5, AC-7, AC-8, AC-9
- **Test Requirements**:
  - `rule` TR-3.1: grep no PricingDashboard.jsx por `useState.*[Mm]arkup` retorna 0 ocorrências (nenhum estado guardando valor calculado)
  - `rule` TR-3.2: subscription realtime para client_retail_prices existe (verificar `supabase.channel` e `postgres_changes` com tabela='client_retail_prices')
  - `rubric` TR-3.3: completude popup Visão A; scale 1-3; 1=só markup; 2= +coleta usada; 3= +outros canais +sinalizações; threshold=3
  - Evidence: inspeção fonte + screenshot do popup

## Task 4: PricingAnalytics.jsx — Subscription client_retail_prices e seção Visão B
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
  - Adicionar subscription realtime em client_retail_prices (junto da de pricing_history já existente)
  - Carregar client_retail_prices completo e juntar com pricing_history filtrado:
    - ph.is_current=true
    - ph.client_id = crp.client_id AND ph.code = crp.datasul_code
    - Aplicar selecionarColetaReferencia() por (client_id, datasul_code)
  - Agregar por categoria normalizada (trim/CI; vazia→"Sem categoria") usando agregarMarkupPontaPorCategoria()
  - Renderizar nova seção "Markup de ponta por categoria" ANTES ou DEPOIS dos gráficos existentes (escolher posição visualmente lógica, acima dos gráficos de evolução ou em cards separados)
  - Cada categoria mostra:
    - Nome da categoria
    - Markup médio formatado
    - Markup mediano formatado
    - Cobertura "X de Y SKUs com preço de ponta"
    - Badge "Baixa amostragem" se skusComPonta < 5
  - Gráfico Recharts BarChart horizontal, dataKey=markupMedio, ordenado desc; categorias no eixo Y
  - Respeitar filtros existentes de cliente e período
  - Nenhum useState guarda agregados; tudo derivado por useMemo
- **Acceptance Criteria Addressed**: AC-6, AC-7, AC-8, AC-10
- **Test Requirements**:
  - `rule` TR-4.1: grep PricingAnalytics useState+markup = 0; subscriptions para ambas tabelas
  - `rule` TR-4.2: renderização de texto cobertura "X de Y SKUs com preço de ponta" no DOM
  - `rule` TR-4.3: gráfico horizontal BarChart layout="vertical" com dados ordenados desc
  - `rule` TR-4.4: categorias <5 com ponta recebem badge "Baixa amostragem"
  - Evidence: inspeção fonte + screenshot da seção

## Task 5: Rodar lint, typecheck e testes; verificação manual de casos referência
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 1, 2, 3, 4
- **Description**:
  - `yarn test` no frontend (vitest)
  - `yarn build` para detectar erros de compilação
  - `GetDiagnostics` do VSCode
  - Conferir manualmente que a coluna da tabela exibe formato 1 casa decimal
  - `git status --short` para auditoria
- **Acceptance Criteria Addressed**: NFR-2, NFR-5, NFR-6
- **Test Requirements**:
  - `rule` TR-5.1: `yarn vitest run` passa
  - `rule` TR-5.2: `yarn build` exit code 0
  - `rule` TR-5.3: GetDiagnostics sem erros de import/undefined
  - Evidence: saída dos comandos
- **Notes**: Não fazer commit automático
