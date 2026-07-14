<img src="https://readme-typing-svg.demolab.com/?font=Fira+Code&size=22&pause=900&center=true&vCenter=true&width=900&lines=Gest%C3%A3o+Pricing;Pre+Sales;Customer+Success" />

# Gestão Pricing

Aplicação para gestão de preços e leads com sessões de Pre Sales, Pricing e CS. Após login, o usuário escolhe a sessão e navega com permissões específicas: `Pricing` edita tudo (admin), `Pre Sales` edita apenas New Leads, `CS` edita apenas a tela de CS.

## Contexto e Objetivo
- Centralizar visualização e edição de preços/leads, mantendo identidade visual.
- Oferecer fluxo pós-login com seleção de sessão e botões de voltar.
- Preparar backend para autenticação e persistência futura via Supabase.

## Arquitetura
- Frontend: React (CRA + CRACO), Tailwind, componentes UI.
- Backend: FastAPI com JWT, CORS, dotenv, estrutura pronta para Supabase.
- Comunicação: durante o MVP, o frontend usa mocks; backend expõe endpoints `HTTP` para futura integração.

## Pré‑requisitos
- `Node.js >= 18` (recomendado `20/22`).
- `Python 3.10+` (recomendado `3.11/3.12`).
- `pip` e `virtualenv`.

## Instalação
1) Frontend
   - Entre em `frontend/`
   - Instale dependências:
     - `yarn` ou `npm install`

2) Backend
   - Entre em `backend/`
   - Crie e ative o ambiente virtual:
     - macOS/Linux: `python3 -m venv .venv && source .venv/bin/activate`
     - Windows: `py -m venv .venv && .venv\\Scripts\\activate`
   - Instale dependências: `pip install -r requirements.txt`

## Variáveis de Ambiente
Crie o arquivo `.env` (veja `.env.example`) na pasta `backend/` com:
- `SECRET_KEY`
- `JWT_ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGINS`

Opcional no frontend: `REACT_APP_API_URL` (ex.: `http://localhost:8000/api`).

## Como Rodar
1) Backend
   - Em `backend/` com o venv ativo: `./.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000`
   - Healthcheck: `GET http://localhost:8000/healthz`

2) Frontend
   - Em `frontend/`: `yarn start` ou `npm start`
   - Abre em `http://localhost:3000`
   - Se precisar do fluxo antigo com CRA/CRACO: `npm run start:cra`

## Fluxo de Uso
- Login → Seleção de Sessão (`/select`) → Página da sessão (`/pricing`, `/pre-vendas/new-leads`, `/cs`).
- Botão “Voltar” leva à seleção de sessões e tem animação inspirada em “Mais métricas”.
- Alertas de sucesso aparecem no canto inferior em operações de edição/exclusão.

## Scripts Úteis
- Frontend: `yarn start`, `yarn build`, `yarn test`, `yarn start:cra`.
- Backend: `uvicorn server:app --reload` para desenvolvimento.

## Notas
- O projeto ignora `.env` e caches via `.gitignore` em raiz e `frontend/`.
- Para usar Supabase, defina `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `.env` do backend.
