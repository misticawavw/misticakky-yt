# misticakky yt

Painel privado para conectar múltiplas contas Gmail via OAuth 2.0 e capturar **somente convites de grupo familiar do Google**.

## Regras implementadas

- Não pede nem armazena senha do Gmail.
- Usa somente o escopo OAuth `gmail.readonly`.
- Aceita múltiplas contas Gmail.
- Só considera mensagens de `families-noreply@google.com` que contenham link `https://families.google.com/join/promo/...`.
- Primeira verificação: salva apenas mensagens cujo `internalDate` esteja nos 7 dias anteriores ao início da verificação.
- Verificações posteriores: salva apenas mensagens com `internalDate` posterior ao `last_checked_at` da conta.
- `last_checked_at` recebe o instante de **início** da verificação, evitando perder mensagens que cheguem enquanto a busca está rodando.
- Refresh tokens OAuth são criptografados com AES-256-GCM antes de serem persistidos no Postgres.

## Google Cloud (uma vez)

1. Crie/abra um projeto no Google Cloud.
2. Ative a Gmail API.
3. Configure a tela de consentimento OAuth.
4. Crie credencial OAuth 2.0 do tipo **Web application**.
5. No Render, depois que a URL existir, cadastre exatamente:
   `https://SEU-SERVICO.onrender.com/oauth2/callback`
6. Copie Client ID e Client Secret para as variáveis do Render.

## Render

O `render.yaml` provisiona o web service e um Render Postgres. Os segredos `ADMIN_PASSWORD`, `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` ficam como `sync: false`, portanto não são gravados no repositório.

Depois do deploy, abra `/login`, entre no painel e clique em **Adicionar Gmail** para autorizar cada conta.
