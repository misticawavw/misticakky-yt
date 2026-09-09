import crypto from 'node:crypto';
import express from 'express';
import cookieSession from 'cookie-session';
import helmet from 'helmet';
import pg from 'pg';
import { google } from 'googleapis';
import {
  getHeader,
  initialCutoff,
  isAfterCutoff,
  isGoogleFamilyInviteMessage,
  invitationFromMessage,
  gmailListQuery
} from './gmail-utils.js';

const { Pool } = pg;
const app = express();
const PORT = Number(process.env.PORT || 3000);
const REQUIRED = ['DATABASE_URL', 'SESSION_SECRET', 'TOKEN_ENCRYPTION_KEY'];
for (const key of REQUIRED) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieSession({
  name: 'gmax_session',
  keys: [process.env.SESSION_SECRET],
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 12 * 60 * 60 * 1000
}));

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function layout(title, content, req) {
  const authed = Boolean(req.session?.admin);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · misticakky yt</title>
<style>
:root{--pink:#ff8fb7;--pink2:#ffd6e5;--ink:#243047;--muted:#67738c;--card:rgba(255,255,255,.9);--sea:#bfe9f4;--ok:#1f9d68;--danger:#c73b5d}
*{box-sizing:border-box} body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:var(--ink);background:linear-gradient(155deg,#fff6fa 0%,#ffe7ef 48%,#d8f4f8 100%);min-height:100vh}
body:before,body:after{content:"";position:fixed;border-radius:999px;filter:blur(2px);opacity:.45;z-index:-1}body:before{width:360px;height:360px;background:#ffc0d5;right:-90px;top:-110px}body:after{width:430px;height:430px;background:#b7edf6;left:-140px;bottom:-160px}
.wrap{max-width:1080px;margin:0 auto;padding:28px 20px 60px}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px}.brand{font-weight:900;letter-spacing:-.04em;font-size:25px}.brand span{color:#e75086}.nav{display:flex;gap:10px;align-items:center}.card{background:var(--card);border:1px solid rgba(255,255,255,.9);box-shadow:0 18px 50px rgba(65,79,104,.12);border-radius:24px;padding:22px;backdrop-filter:blur(12px)}.hero{padding:30px}.grid{display:grid;grid-template-columns:1.1fr .9fr;gap:18px}.stack{display:grid;gap:14px}.row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.btn{appearance:none;border:0;border-radius:14px;padding:11px 15px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--pink);color:white;box-shadow:0 8px 22px rgba(231,80,134,.22)}.btn.secondary{background:white;color:var(--ink);border:1px solid #ebd8e1;box-shadow:none}.btn.danger{background:#fff0f4;color:var(--danger);box-shadow:none;border:1px solid #ffd4de}.btn:disabled{opacity:.55;cursor:not-allowed}.muted{color:var(--muted)}.tiny{font-size:12px}.title{font-size:34px;line-height:1.04;letter-spacing:-.045em;margin:0 0 10px}.sub{font-size:16px;line-height:1.55;margin:0;color:var(--muted)}.pill{display:inline-flex;padding:6px 10px;border-radius:999px;background:#fff1f6;color:#be3f70;font-size:12px;font-weight:800}.account,.invite{padding:16px;border-radius:18px;border:1px solid #f1e2e8;background:rgba(255,255,255,.72)}.invite a.link{word-break:break-all;color:#2b78a6}.notice{padding:12px 14px;border-radius:14px;background:#effbf7;color:#176d4d;border:1px solid #cbefe0}.error{padding:12px 14px;border-radius:14px;background:#fff0f3;color:#9e294a;border:1px solid #ffd0dc}.empty{text-align:center;padding:32px 12px;color:var(--muted)}label{display:grid;gap:7px;font-weight:800}input{width:100%;border:1px solid #ead5de;border-radius:14px;padding:12px 13px;font:inherit;outline:none;background:white}input:focus{border-color:#f084ad;box-shadow:0 0 0 3px rgba(240,132,173,.15)}form.inline{display:inline}.login{max-width:460px;margin:8vh auto 0}.login .card{padding:30px}.fish{font-size:38px;filter:drop-shadow(0 8px 12px rgba(41,132,160,.15))}
@media(max-width:780px){.grid{grid-template-columns:1fr}.title{font-size:29px}.top{align-items:flex-start}.nav{flex-wrap:wrap;justify-content:flex-end}}
</style>
</head>
<body><div class="wrap"><div class="top"><div class="brand">GMAX <span>Convites</span></div>${authed ? `<div class="nav"><a class="btn secondary" href="/">Painel</a><form class="inline" method="post" action="/logout"><input type="hidden" name="csrf" value="${esc(req.session.csrf || '')}"><button class="btn secondary">Sair</button></form></div>` : ''}</div>${content}</div></body></html>`;
}

function requireAdmin(req, res, next) {
  if (!req.session?.admin) return res.redirect('/login');
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  next();
}

function checkCsrf(req, res, next) {
  if (!req.session?.csrf || req.body?.csrf !== req.session.csrf) return res.status(403).send('CSRF inválido.');
  next();
}

function safePasswordEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function encryptionKey() {
  return crypto.createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY).digest();
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map(x => x.toString('base64url')).join('.');
}

function decryptSecret(value) {
  const [ivB64, tagB64, cipherB64] = String(value).split('.');
  if (!ivB64 || !tagB64 || !cipherB64) throw new Error('Encrypted token is malformed');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(cipherB64, 'base64url')), decipher.final()]).toString('utf8');
}

function baseUrl(req) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');
  if (process.env.RENDER_EXTERNAL_HOSTNAME) return `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
  return `${req.protocol}://${req.get('host')}`;
}

function oauthClient(req) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return null;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${baseUrl(req)}/oauth2/callback`
  );
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gmail_accounts (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      refresh_token_enc TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_checked_at TIMESTAMPTZ NULL
    );
    CREATE TABLE IF NOT EXISTS invites (
      id BIGSERIAL PRIMARY KEY,
      account_id BIGINT NOT NULL REFERENCES gmail_accounts(id) ON DELETE CASCADE,
      gmail_message_id TEXT NOT NULL,
      thread_id TEXT NULL,
      received_at TIMESTAMPTZ NOT NULL,
      from_header TEXT NOT NULL,
      subject TEXT NOT NULL,
      snippet TEXT NOT NULL DEFAULT '',
      invite_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(account_id, gmail_message_id)
    );
    CREATE INDEX IF NOT EXISTS idx_invites_received_at ON invites(received_at DESC);
  `);
}

async function listAllMessageIds(gmail, q) {
  const ids = [];
  let pageToken;
  do {
    const resp = await gmail.users.messages.list({ userId: 'me', q, maxResults: 100, pageToken });
    ids.push(...(resp.data.messages || []).map(x => x.id));
    pageToken = resp.data.nextPageToken || undefined;
  } while (pageToken);
  return ids;
}

async function scanAccount(account, req) {
  const scanStartedAt = new Date();
  const lastChecked = account.last_checked_at ? new Date(account.last_checked_at) : null;
  const cutoff = lastChecked || initialCutoff(scanStartedAt);
  const initialScan = !lastChecked;

  const auth = oauthClient(req);
  if (!auth) throw new Error('Google OAuth ainda não foi configurado no servidor.');
  auth.setCredentials({ refresh_token: decryptSecret(account.refresh_token_enc) });
  const gmail = google.gmail({ version: 'v1', auth });

  const ids = await listAllMessageIds(gmail, gmailListQuery(lastChecked));
  let found = 0;
  for (const id of ids) {
    const resp = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const message = resp.data;
    if (!isAfterCutoff(message.internalDate, cutoff, initialScan)) continue;
    if (!isGoogleFamilyInviteMessage(message)) continue;
    const invite = invitationFromMessage(message);
    if (!invite) continue;
    const result = await pool.query(`
      INSERT INTO invites(account_id,gmail_message_id,thread_id,received_at,from_header,subject,snippet,invite_url)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(account_id,gmail_message_id) DO NOTHING
      RETURNING id
    `, [account.id, invite.gmailMessageId, invite.threadId, invite.receivedAt, invite.fromHeader, invite.subject, invite.snippet, invite.inviteUrl]);
    if (result.rowCount) found++;
  }

  await pool.query('UPDATE gmail_accounts SET last_checked_at=$1 WHERE id=$2', [scanStartedAt, account.id]);
  return { found, checked: ids.length, scanStartedAt };
}

app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }
  catch { res.status(503).json({ status: 'db_unavailable' }); }
});

app.get('/login', (req, res) => {
  if (req.session?.admin) return res.redirect('/');
  const msg = req.query.error ? `<div class="error">${esc(req.query.error)}</div>` : '';
  res.send(layout('Login', `<div class="login"><div class="card stack"><div class="row"><div><div class="pill">acesso administrativo</div><h1 class="title" style="margin-top:12px">misticakky yt</h1><p class="sub">Entre para conectar contas Gmail e capturar somente convites recentes de Família Google.</p></div><div class="fish">🐟</div></div>${msg}<form class="stack" method="post" action="/login"><label>Usuário<input name="username" autocomplete="username" required></label><label>Senha<input type="password" name="password" autocomplete="current-password" required></label><button class="btn" type="submit">Entrar</button></form><p class="tiny muted">A senha do Gmail nunca é solicitada nem armazenada. O acesso ao Gmail usa OAuth do Google.</p></div></div>`, req));
});

app.post('/login', (req, res) => {
  const expectedUser = process.env.ADMIN_USER || 'misticakky';
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedPassword) return res.redirect('/login?error=' + encodeURIComponent('Senha administrativa ainda não configurada no servidor.'));
  if (safePasswordEqual(req.body.username, expectedUser) && safePasswordEqual(req.body.password, expectedPassword)) {
    req.session.admin = true;
    req.session.csrf = crypto.randomBytes(24).toString('hex');
    return res.redirect('/');
  }
  res.redirect('/login?error=' + encodeURIComponent('Usuário ou senha inválidos.'));
});

app.post('/logout', requireAdmin, checkCsrf, (req, res) => { req.session = null; res.redirect('/login'); });

app.get('/', requireAdmin, async (req, res) => {
  const accounts = (await pool.query('SELECT id,email,created_at,last_checked_at FROM gmail_accounts ORDER BY created_at DESC')).rows;
  const invites = (await pool.query(`SELECT i.*, a.email FROM invites i JOIN gmail_accounts a ON a.id=i.account_id ORDER BY i.received_at DESC LIMIT 200`)).rows;
  const googleReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const flash = req.session.flash; req.session.flash = null;

  const accountHtml = accounts.length ? accounts.map(a => `<div class="account"><div class="row"><div><strong>${esc(a.email)}</strong><div class="tiny muted">${a.last_checked_at ? `Última verificação: ${new Date(a.last_checked_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}` : 'Primeira verificação ainda não feita'}</div></div><div class="row"><form class="inline" method="post" action="/accounts/${a.id}/scan"><input type="hidden" name="csrf" value="${esc(req.session.csrf)}"><button class="btn secondary">Verificar agora</button></form><form class="inline" method="post" action="/accounts/${a.id}/delete" onsubmit="return confirm('Remover esta conta do painel?')"><input type="hidden" name="csrf" value="${esc(req.session.csrf)}"><button class="btn danger">Remover</button></form></div></div></div>`).join('') : '<div class="empty">Nenhuma conta Gmail conectada ainda.</div>';

  const inviteHtml = invites.length ? invites.map(i => `<div class="invite stack"><div class="row"><span class="pill">${esc(i.email)}</span><span class="tiny muted">${new Date(i.received_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</span></div><div><strong>${esc(i.subject)}</strong><div class="tiny muted" style="margin-top:5px">${esc(i.snippet)}</div></div><a class="link" href="${esc(i.invite_url)}" target="_blank" rel="noopener noreferrer">${esc(i.invite_url)}</a><div><a class="btn" href="${esc(i.invite_url)}" target="_blank" rel="noopener noreferrer">Abrir convite</a></div></div>`).join('') : '<div class="empty">Nenhum convite encontrado ainda.</div>';

  res.send(layout('Painel', `${flash ? `<div class="${flash.type === 'error' ? 'error' : 'notice'}" style="margin-bottom:16px">${esc(flash.text)}</div>` : ''}<div class="card hero" style="margin-bottom:18px"><div class="row"><div style="max-width:680px"><div class="pill">Gmail OAuth · leitura somente</div><h1 class="title" style="margin-top:12px">Convites de Família Google, sem e-mails antigos.</h1><p class="sub">Na primeira busca, o painel guarda somente convites recebidos nos últimos 7 dias. Depois disso, cada conta é verificada apenas a partir da última checagem concluída.</p></div><div class="fish">🌊🐟</div></div></div><div class="grid"><section class="card stack"><div class="row"><div><h2 style="margin:0">Contas Gmail</h2><p class="tiny muted">Tokens OAuth ficam criptografados no banco. Senhas do Gmail não passam pelo site.</p></div>${googleReady ? `<a class="btn" href="/oauth2/start">+ Adicionar Gmail</a>` : `<button class="btn" disabled>OAuth pendente</button>`}</div>${!googleReady ? '<div class="error">Falta cadastrar GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no Render.</div>' : ''}${accounts.length > 1 ? `<form method="post" action="/scan-all"><input type="hidden" name="csrf" value="${esc(req.session.csrf)}"><button class="btn secondary">Verificar todas</button></form>` : ''}<div class="stack">${accountHtml}</div></section><section class="card stack"><div><h2 style="margin:0">Convites capturados</h2><p class="tiny muted">Somente remetente families-noreply@google.com + link /join/promo/.</p></div><div class="stack">${inviteHtml}</div></section></div>`, req));
});

app.get('/oauth2/start', requireAdmin, (req, res) => {
  const auth = oauthClient(req);
  if (!auth) { req.session.flash = { type: 'error', text: 'Google OAuth ainda não configurado.' }; return res.redirect('/'); }
  const state = crypto.randomBytes(24).toString('hex');
  req.session.oauthState = state;
  const url = auth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: true,
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    state
  });
  res.redirect(url);
});

app.get('/oauth2/callback', requireAdmin, async (req, res) => {
  try {
    if (!req.query.state || req.query.state !== req.session.oauthState) throw new Error('Estado OAuth inválido.');
    req.session.oauthState = null;
    if (!req.query.code) throw new Error('Google não retornou código de autorização.');
    const auth = oauthClient(req);
    if (!auth) throw new Error('Google OAuth não configurado.');
    const { tokens } = await auth.getToken(String(req.query.code));
    auth.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const email = profile.data.emailAddress?.toLowerCase();
    if (!email) throw new Error('Não foi possível identificar o e-mail da conta.');

    const existing = await pool.query('SELECT * FROM gmail_accounts WHERE email=$1', [email]);
    const oldToken = existing.rows[0]?.refresh_token_enc;
    const tokenEnc = tokens.refresh_token ? encryptSecret(tokens.refresh_token) : oldToken;
    if (!tokenEnc) throw new Error('O Google não retornou refresh token. Remova o acesso do app e autorize novamente.');
    await pool.query(`INSERT INTO gmail_accounts(email,refresh_token_enc) VALUES($1,$2)
      ON CONFLICT(email) DO UPDATE SET refresh_token_enc=EXCLUDED.refresh_token_enc`, [email, tokenEnc]);
    req.session.flash = { type: 'ok', text: `${email} conectado com sucesso.` };
    res.redirect('/');
  } catch (err) {
    req.session.flash = { type: 'error', text: `Falha no OAuth: ${err.message}` };
    res.redirect('/');
  }
});

app.post('/accounts/:id/scan', requireAdmin, checkCsrf, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM gmail_accounts WHERE id=$1', [req.params.id]);
    if (!result.rowCount) throw new Error('Conta não encontrada.');
    const scan = await scanAccount(result.rows[0], req);
    req.session.flash = { type: 'ok', text: `Verificação concluída: ${scan.found} novo(s) convite(s) salvo(s).` };
  } catch (err) { req.session.flash = { type: 'error', text: `Erro ao verificar: ${err.message}` }; }
  res.redirect('/');
});

app.post('/scan-all', requireAdmin, checkCsrf, async (req, res) => {
  try {
    const accounts = (await pool.query('SELECT * FROM gmail_accounts ORDER BY id')).rows;
    let found = 0;
    for (const account of accounts) found += (await scanAccount(account, req)).found;
    req.session.flash = { type: 'ok', text: `Todas as contas verificadas. ${found} novo(s) convite(s).` };
  } catch (err) { req.session.flash = { type: 'error', text: `Erro na verificação geral: ${err.message}` }; }
  res.redirect('/');
});

app.post('/accounts/:id/delete', requireAdmin, checkCsrf, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM gmail_accounts WHERE id=$1', [req.params.id]);
    if (result.rowCount) {
      try {
        const auth = oauthClient(req);
        if (auth) await auth.revokeToken(decryptSecret(result.rows[0].refresh_token_enc));
      } catch {}
      await pool.query('DELETE FROM gmail_accounts WHERE id=$1', [req.params.id]);
    }
    req.session.flash = { type: 'ok', text: 'Conta removida do painel.' };
  } catch (err) { req.session.flash = { type: 'error', text: `Erro ao remover: ${err.message}` }; }
  res.redirect('/');
});

await initDb();
app.listen(PORT, '0.0.0.0', () => console.log(`misticakky yt listening on ${PORT}`));
