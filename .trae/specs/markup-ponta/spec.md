# Markup de Ponta - Product Requirements Document

## Overview
- **Summary**: Implementar a métrica "markup de ponta" (retail_price / gross_price) no Gestão Pricing 2.0, com cálculo sempre derivado em tempo de leitura (nunca persistido), recálculo automático via subscriptions realtime, exibição em popup por SKU (Visão A) e agregado por categoria no Pricing Analytics (Visão B).
- **Purpose**: Medir quanto o cliente marca em cima do preço que compra da Pronutrition, diferenciando da métrica de markup derivada da margem. A métrica revela o posicionamento de preço praticado no canal de varejo.
- **Target Users**: Equipe de Pricing, analistas de produto, gestores comerciais.

## Goals
- Disponibilizar markup de ponta por SKU no popup de detalhe da tabela principal
- Disponibilizar agregado por categoria (médio, mediano, cobertura) no Pricing Analytics com gráfico horizontal
- Garantir recálculo automático sem refresh manual quando dados mudam em pricing_history ou client_retail_prices
- Garantir formatação estrita: 1 casa decimal com vírgula, sem símbolo de percentual, sem "x"
- Cobertura Vitest completa da lógica pura em markupPonta.js

## Non-Goals
- Não alterar schema de banco de dados
- Não persistir markup calculado em coluna, cache ou state
- Não remover a métrica de markup derivada da margem existente em utils/markup.js
- Não criar drill-down por subcategoria
- Não alterar RLS policies
- Não usar volume, ROB ou MB absoluta

## Background & Context
- Base atual: 178 SKUs vigentes em pricing_history, 102 coletas em client_retail_prices (101 site próprio, 1 marketplace)
- Casos de referência:
  - AJINOMOTO Baunilha (4030.0014.0119): retail 140,00 / gross 20,88 → markup 6,7
  - AJINOMOTO Frutas Citricas (4030.0014.0134): retail 140,00 / gross 21,59 → markup 6,5
  - DOBRO HIDROGEL sache 40g: retail 150,00 / gross 3,35 → markup 44,8 (válido, apenas sinalizar)
- utils/markup.js já existe com calculateMarkup (tier/status), é outra métrica e deve coexistir
- PricingAnalytics.jsx já tem subscription para pricing_history, precisa adicionar client_retail_prices
- PTAX fixa: 4,63
- Canal de referência: source = 'Site próprio'; marketplace entra apenas como referência no popup

## Functional Requirements
- **FR-1**: Lógica pura em frontend/src/lib/pricing/markupPonta.js:
  - calcularMarkupPonta(precoPonta, precoBruto, moedaPonta, moedaBruto) → null se qualquer valor null/<=0; converte moeda por PTAX 4,63 se divergente
  - selecionarColetaReferencia(coletas) → retorna coleta 'Site próprio' mais recente por (client_id, datasul_code); null se não houver
  - agregarMarkupPontaPorCategoria(linhas) → por categoria normalizada (trim/case-insensitive): { categoria, skusComPonta, skusTotal, markupMedio, markupMediano }
  - formatarMarkupPonta(valor) → string "6,7" (1 casa decimal, vírgula); null → "-"
- **FR-2**: Popup Visão A (PricingDashboard.jsx, modal retailDetailOpen) exibe:
  - Markup de ponta do SKU: retail_price (canal referência) / gross_price vigente
  - Sem gross_price vigente → "-"
  - Coleta usada: preço, canal, data
  - Outros canais listados como referência (rotulados com canal, fora do cálculo)
  - Sinalização visual para markup fora de [1,5 ; 15]: "verificar unidade de embalagem"
  - Sinalização quando moedas divergem (conversão PTAX aplicada)
- **FR-3**: PricingAnalytics.jsx (Visão B) adiciona seção de Markup de Ponta por Categoria:
  - Categoria normalizada (trim + case-insensitive); vazia → "Sem categoria"
  - Por categoria: markup médio (média simples), markup mediano, cobertura "X de Y SKUs com preço de ponta"
  - Categorias com <5 SKUs com ponta → badge "Baixa amostragem"
  - Gráfico de barras horizontal (Recharts), ordenado desc por markup médio
  - Respeita filtros de cliente e período existentes
- **FR-4**: Recálculo automático via subscriptions realtime em:
  - pricing_history (já existe em PricingAnalytics, adicionar em PricingDashboard se necessário)
  - client_retail_prices (adicionar em PricingDashboard e PricingAnalytics)
  - Agregados derivados exclusivamente por useMemo (nenhum state/cache persistindo markup)
- **FR-5**: Guard de dados:
  - Excluir gross_price null ou <= 0 do cálculo (retorna null)
  - Não excluir markup alto (>15) automaticamente; sinalizar visualmente

## Non-Functional Requirements
- **NFR-1**: Nomenclatura estrita: label sempre "markup de ponta" (nunca "markup" sozinho)
- **NFR-2**: Formato estrito: 1 casa decimal, vírgula como separador; sem "%", sem "x", sem "5,50"
- **NFR-3**: Nenhuma coluna, state intermediário ou cache persistindo markup calculado
- **NFR-4**: Pasta lib/pricing/markupPonta.js é fonte única da lógica; UI só consome funções
- **NFR-5**: Design sem sombras, degradês ou blur; touch targets mínimos 44x44px
- **NFR-6**: Grafia "Pronutrition" respeitada

## Constraints
- **Technical**: Stack React 18/Vite, Supabase, Tailwind, shadcn/ui, Recharts, Vitest, XLSX
- **Business**:
  - Canal de referência obrigatório 'Site próprio'; marketplace fora do agregado
  - Sem fallback silencioso para outro canal
  - Moeda divergente converte por PTAX 4,63; sinalizar na UI
  - Markups [1,5 ; 15] sinalizados, não excluídos
- **Dependencies**:
  - pricing_history.is_current como fonte de vigência
  - client_retail_prices: client_id + datasul_code (junção com pricing_history.code e client_id)
  - Supabase realtime habilitado nas tabelas

## Assumptions
- PTAX fixa em 4,63 (hardcoded, sem consulta externa)
- source = 'Site próprio' é string exata; comparação case-sensitive
- Categoria vazia/whitespace vira "Sem categoria"
- Media e mediana são calculadas apenas sobre SKUs com markup válido (não null)
- Cobertura = skusComPonta / skusTotal para SKUs is_current=true no conjunto filtrado

## Acceptance Criteria

### AC-1: cálculo básico 140 / 20.88 = 6,7
- **Type**: `rule`
- **Given**: precoPonta=140, precoBruto=20.88, ambas BRL
- **When**: calcularMarkupPonta() é chamada
- **Then**: retorna número próximo de 6.70019...
- **Pass Condition**: formatarMarkupPonta(resultado) === "6,7"
- **Evidence**: Vitest passing em markupPonta.test.js

### AC-2: cálculo 150 / 3.35 = 44,8 (alto, não excluído)
- **Type**: `rule`
- **Given**: precoPonta=150, precoBruto=3.35
- **When**: calcularMarkupPonta() + agregarMarkupPontaPorCategoria()
- **Then**: markup é ~44.776; mantido no agregado; sinalização UI disparada
- **Pass Condition**: resultado != null e formatarMarkupPonta(retorno) === "44,8"; função de agregado não filtra a linha
- **Evidence**: Vitest passing + UI sinaliza "verificar unidade de embalagem"

### AC-3: guard denominador zero ou null
- **Type**: `rule`
- **Given**: precoBruto=0 ou precoBruto=null
- **When**: calcularMarkupPonta()
- **Then**: retorna null estrito
- **Pass Condition**: resultado === null
- **Evidence**: Vitest passing

### AC-4: conversão PTAX 4,63 para moedas divergentes
- **Type**: `rule`
- **Given**: precoPonta BRL 140, precoBruto USD 4.51 (≈20.88 em BRL)
- **When**: calcularMarkupPonta(140, 4.51, 'BRL', 'USD')
- **Then**: (140) / (4.51 * 4.63) ≈ 6,7
- **Pass Condition**: formatarMarkupPonta(resultado) === "6,7"
- **Evidence**: Vitest passing

### AC-5: seleção de canal e coleta
- **Type**: `rule`
- **Given**: lista com coletas 'Site próprio' (2 datas) e 'Marketplace'
- **When**: selecionarColetaReferencia()
- **Then**: retorna 'Site próprio' com collected_at mais recente (e created_at tiebreak)
- **Pass Condition**: objeto retornado tem source === 'Site próprio' e é a mais recente; SKU só com marketplace retorna null
- **Evidence**: Vitest passing

### AC-6: agregado por categoria e cobertura
- **Type**: `rule`
- **Given**: 3 linhas de categoria "Gel" (2 com ponta válida, 1 sem) + 1 "Sem categoria"
- **When**: agregarMarkupPontaPorCategoria()
- **Then**: {categoria:"Gel", skusComPonta:2, skusTotal:3, markupMedio, markupMediano}; vazia → "Sem categoria"
- **Pass Condition**: chaves exatas e valores batem; "Gel" === "gel" após normalização
- **Evidence**: Vitest passing

### AC-7: formatação estrita
- **Type**: `rule`
- **Given**: 6.7, 44.776, null
- **When**: formatarMarkupPonta()
- **Then**: "6,7", "44,8", "-"
- **Pass Condition**: 1 casa decimal exata; vírgula; sem "x" sem "%"; null → "-"
- **Evidence**: Vitest passing + inspeção UI

### AC-8: recálculo realtime sem state persistente
- **Type**: `rubric`
- **Dimension**: arquitetura de recálculo automático
- **Scale**: 1-3
- **Anchors**: 1 = markup guardado em useState/cache; 2 = subscription existe mas markup é memoizado externamente; 3 = subscriptions em pricing_history + client_retail_prices, markup derivado exclusivamente por useMemo sobre dados brutos, nenhum state guarda valor calculado
- **Pass Threshold**: 3
- **Evidence**: Inspeção de PricingDashboard.jsx e PricingAnalytics.jsx: grep por "markup" em useState retorna 0; apenas useMemo derivam valores

### AC-9: Visão A popup exibe referência e outros canais
- **Type**: `rule`
- **Given**: SKU com coleta 'Site próprio' e coleta marketplace
- **When**: abrir popup
- **Then**: markup de ponta usa site próprio; outra coleta listada com label de canal distinto
- **Pass Condition**: elemento do cálculo principal exibe canal "Site próprio"; seção separada lista marketplace
- **Evidence**: inspeção do DOM do modal

### AC-10: Visão B gráfico + cobertura + baixa amostragem
- **Type**: `rule`
- **Given**: categorias com diversos tamanhos de amostra
- **When**: renderizar PricingAnalytics
- **Then**: gráfico Recharts barras horizontal ordenado desc; cobertura "X de Y"; <5 → badge baixa amostragem
- **Pass Condition**: DOM contém texto cobertura e badge para amostras pequenas; gráfico com orientação horizontal
- **Evidence**: inspeção da seção no PricingAnalytics

## Open Questions
- Nenhuma. Requisitos fechados na especificação.
