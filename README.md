# Gestão Pricing 2.0

Aplicação interna da Pronutrition para pricing, pré-vendas e customer success.

## Stack

- React 18
- Vite
- Tailwind CSS
- shadcn/ui + Radix UI
- Supabase (Auth + Postgres consumidos direto pelo frontend)

## Estrutura

- `frontend/`: aplicação web
- `frontend/src/components/`: telas e componentes visuais
- `frontend/src/components/ui/`: biblioteca base de UI
- `frontend/src/contexts/`: contexto de autenticação
- `frontend/src/lib/`: utilitários de configuração e permissões
- `frontend/src/utils/`: regras auxiliares e cálculos
- `supabase/migrations/`: histórico versionado do schema e permissões do banco
- `supabase/migrations/legacy/`: scripts SQL históricos preservados apenas como referência; não fazem parte do fluxo atual

## Desenvolvimento local

Pré-requisitos:

- Node.js 18+
- Yarn 1.x

Instalação:

```bash
cd frontend
yarn install
```

Rodar em desenvolvimento:

```bash
yarn dev
```

O app sobe em `http://localhost:5174`.

## Build e preview

Build de produção:

```bash
cd frontend
yarn build
```

Preview local do build:

```bash
cd frontend
yarn preview
```

Saída de build: `frontend/dist/`

## Testes

Executar a suíte de testes:

```bash
cd frontend
yarn test --run
```

Os testes numéricos de precificação ficam em `frontend/src/utils/simulationPricing.test.js`.

## Variáveis de ambiente

O projeto usa estas variáveis no frontend:

- `VITE_SUPABASE_URL`: URL do projeto Supabase usada pelo cliente web
- `VITE_SUPABASE_ANON_KEY`: chave pública anônima usada para autenticação e acesso ao banco via Supabase
- `VITE_SUPABASE_REDIRECT_URL`: URL de retorno usada no fluxo de redefinição de senha

## Áreas e permissões

Áreas suportadas:

- `Pricing`
- `Pré-vendas`
- `CS`

A autorização real vive em `public.users.area` no Supabase e é aplicada por RLS no banco. O frontend usa guards e ajustes de interface apenas para experiência de uso.

Resumo funcional:

- `Pricing`: acesso administrativo e escrita completa onde permitido
- `Pré-vendas`: acesso aos módulos liberados para operação comercial
- `CS`: acesso aos módulos liberados para customer success

Usuários recém-criados podem ficar com `area` nula até a liberação manual pela área de Pricing.

## Deploy na Vercel

Configuração esperada:

- Framework Preset: `Vite`
- Root Directory: `frontend`
- Build Command: `yarn build`
- Output Directory: `dist`

O fallback de SPA está em `frontend/vercel.json`, para manter rotas do React Router funcionando por URL direta.
