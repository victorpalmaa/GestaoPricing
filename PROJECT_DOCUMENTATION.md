# Documentação do Projeto - Gestão Pricing 2.0

## 1. Visão Geral
O **Gestão Pricing 2.0** é uma aplicação web voltada para a gestão estratégica de preços, análise de margens, controle de leads (pré-vendas) e sucesso do cliente (CS). O sistema utiliza uma arquitetura moderna baseada em React e Supabase, oferecendo dashboards interativos, gráficos de evolução e ferramentas de administração de dados.

## 2. Tech Stack & Frameworks

### Core Frontend
- **React 18**: Biblioteca principal para construção da interface.
- **Vite**: Build tool e servidor de desenvolvimento (substituindo Create React App).
- **React Router v6**: Gerenciamento de rotas e navegação.

### Estilização e UI
- **Tailwind CSS**: Framework de utilitários CSS para estilização rápida e responsiva.
- **Radix UI**: Primitivos de componentes acessíveis (Dialog, Popover, Dropdown, etc.).
- **Lucide React**: Biblioteca de ícones.
- **Sonner**: Sistema de notificações (Toasts).
- **Shadcn/UI (Padrão)**: A estrutura de componentes em `src/components/ui` segue o padrão shadcn/ui.

### Visualização de Dados
- **Recharts**: Biblioteca para construção de gráficos (Barras, Linhas, Pizza, Composto).

### Utilitários e Integrações
- **Supabase JS**: Cliente para autenticação e banco de dados em tempo real.
- **Date-fns**: Manipulação e formatação de datas.
- **XLSX**: Importação e exportação de planilhas Excel.
- **Axios**: Requisições HTTP (embora o Supabase Client seja o principal).
- **Zod + React Hook Form**: Validação e gerenciamento de formulários.

## 3. Arquitetura do Projeto

A estrutura de pastas segue um padrão modular dentro de `frontend/src`:

```
src/
├── components/          # Componentes React
│   ├── ui/              # Componentes de UI Reutilizáveis (Button, Input, Card...)
│   ├── CS.jsx           # Módulo de Client Success
│   ├── Pricing.jsx      # Módulo de Pricing
│   ├── Dashboard.jsx    # Dashboard Geral
│   ├── Header.jsx       # Cabeçalho Global
│   └── ...              # Outros módulos (Login, Cadastro, etc.)
├── hooks/               # Custom Hooks (ex: use-toast.js)
├── lib/                 # Configurações de bibliotecas (utils.js, supabase.js)
├── utils/               # Funções utilitárias gerais
├── App.jsx              # Configuração de Rotas e Autenticação Global
└── main.jsx             # Ponto de entrada da aplicação
```

## 4. Fluxo de Navegação e Módulos

O fluxo principal da aplicação é gerenciado pelo `App.jsx`, que verifica a sessão do usuário (Supabase Auth).

### Rotas Principais:
1.  **Autenticação**:
    - `/login`: Tela de acesso.
    - `/cadastro`: Registro de novos usuários.
    - `/forgot-password` / `/update-password`: Recuperação de conta.

2.  **Seleção de Módulo**:
    - `/select`: Tela intermediária após login para escolher a área de trabalho.

3.  **Pricing (Precificação)**:
    - `/pricing`: Interface de gestão de preços base.
    - `/pricing/dashboard`: Visão gerencial com KPIs e tabelas.
    - `/pricing/analytics`: Análises avançadas de margem e benchmarking.

4.  **Pré-Vendas (Leads)**:
    - `/pre-vendas/new-leads`: Gestão de novos leads e oportunidades.

5.  **Client Success (CS)**:
    - `/cs`: Dashboard de retenção, gates de clientes e histórico de contratos.
        - *Feature Recente*: Visualização detalhada de histórico de SKU com gráfico composto (Preço x Margem).

## 5. Fluxo de Dados e Backend

### Supabase
O projeto utiliza o **Supabase** como Backend-as-a-Service (BaaS).
- **Autenticação**: Gerenciamento de usuários, sessões e persistência de login.
- **Banco de Dados (PostgreSQL)**:
    - `pricing_history`: Tabela central com histórico de preços, SKUs e margens.
    - `clients`: Cadastro de clientes.
    - `aliases` (Depara): Mapeamento de nomes de clientes.

### Integração
A conexão é feita através do cliente instanciado em `src/lib/utils.js`. As chamadas são feitas diretamente nos componentes (ex: `CS.jsx`, `PricingDashboard.jsx`) utilizando `useEffect` para carregar dados e `subscriptions` para atualizações em tempo real (quando aplicável).

## 6. Como Executar o Projeto

### Pré-requisitos
- Node.js (v16+)
- NPM ou Yarn

### Passos
1.  Acesse a pasta do frontend:
    ```bash
    cd frontend
    ```
2.  Instale as dependências:
    ```bash
    npm install
    # ou
    yarn
    ```
3.  Inicie o servidor de desenvolvimento:
    ```bash
    npm run dev
    ```
4.  Acesse `http://localhost:5173` (porta padrão do Vite).

## 7. Scripts Disponíveis
- `npm run dev`: Inicia o servidor local (Vite).
- `npm run build`: Gera o build de produção.
- `npm run start`: Inicia o servidor com Craco (legado/compatibilidade).
