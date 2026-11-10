# Nova Madeira — Sistema de contratos

Aplicação inicial full-stack para contratos de marcenaria.

## Estrutura
- `frontend`: React + Vite + TypeScript
- `backend`: Node.js + Express + PostgreSQL
- `frontend/public/logo.png`: logo enviada

## Requisitos
- Node.js 20+
- PostgreSQL
- Conta/provedor SMS (opcional até configurar Twilio)

## Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
Configure `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
`FRONTEND_URL` e, se usar SMS, as credenciais Twilio.

Na primeira execução, o backend cria as tabelas automaticamente e cria o
administrador inicial a partir de `ADMIN_EMAIL` e `ADMIN_PASSWORD`.

## Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Defina `VITE_API_URL=http://localhost:3001`.

## Publicação
- Frontend: Vercel, diretório `frontend`, variável `VITE_API_URL`.
- Backend: Render, diretório `backend`, comando `npm start`.
- Banco: PostgreSQL gerenciado; copie a URL para `DATABASE_URL`.
- No backend, `FRONTEND_URL` deve ser o domínio publicado do frontend.

## Observações importantes
Este projeto é uma base funcional que precisa ser configurada com credenciais
reais e testada no ambiente de produção antes de receber dados de clientes.
O SMS depende de credenciais e saldo/serviço ativo no provedor.
O registro eletrônico de aceite não substitui avaliação jurídica do contrato.
