import crypto from 'node:crypto';
import express from 'express';
import pg from 'pg';
import { google } from 'googleapis';

const { Pool } = pg;
const originalGet = express.application.get;
const originalPost = express.application.post;
const originalSend = express.response.send;
const installed = Symbol.for('misticakky.separadorStatusInstalled');

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
}) : null;

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function jsonEscape(value = '') {
  return JSON.stringify(String(value));
}

function encryptionKey() {
  return crypto.createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY || '').digest();
}

function decryptSecret(value) {
  const [ivB64, tagB64, cipherB64] = String(value).split('.');
  if (!ivB64 || !tagB64 || !cipherB64) throw new Error('Token criptografado inválido');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherB64, 'base64url')),
    decipher.final()
  ]).toString('utf8');
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

let statusSchemaReady;
function ensureStatusSchema() {
  if (!pool) return Promise.reject(new Error('Banco de dados não configurado'));
  if (!statusSchemaReady) {
    statusSchemaReady = pool.query(`
      ALTER TABLE gmail_accounts ADD COLUMN IF NOT EXISTS google_status TEXT NOT NULL DEFAULT 'not_checked';
      ALTER TABLE gmail_accounts ADD COLUMN IF NOT EXISTS google_status_detail TEXT NULL;
      ALTER TABLE gmail_accounts ADD COLUMN IF NOT EXISTS google_status_checked_at TIMESTAMPTZ NULL;
    `).catch(err => {
      statusSchemaReady = null;
      throw err;
    });
  }
  return statusSchemaReady;
}

function classifyGoogleError(err) {
  const status = Number(err?.response?.status || err?.code || 0);
  const text = [
    err?.message,
    err?.response?.data?.error,
    err?.response?.data?.error_description,
    err?.response?.data?.error?.message
  ].filter(Boolean).map(String).join(' · ').toLowerCase();

  if (status === 400 && text.includes('invalid_grant')) {
    return { status: 'reauth_required', detail: 'A autorização Google expirou, foi revogada ou precisa ser refeita.' };
  }
  if (status === 401 || text.includes('invalid credentials') || text.includes('login required')) {
    return { status: 'reauth_required', detail: 'O Google recusou a autorização atual. Faça a confirmação diretamente no Google.' };
  }
  if (status === 403) {
    return { status: 'google_restricted', detail: 'O Google recusou o acesso pela API. Abra a conta no Google para verificar o motivo.' };
  }
  return { status: 'google_error', detail: 'Não foi possível confirmar o estado agora. Tente novamente mais tarde.' };
}

async function probeAccount(account, req) {
  const auth = oauthClient(req);
  if (!auth) return { status: 'oauth_not_configured', detail: 'OAuth do Google ainda não está configurado.' };

  try {
    auth.setCredentials({ refresh_token: decryptSecret(account.refresh_token_enc) });
    const gmail = google.gmail({ version: 'v1', auth });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const profileEmail = String(profile.data.emailAddress || '').toLowerCase();
    if (!profileEmail || profileEmail !== String(account.email).toLowerCase()) {
      return { status: 'google_error', detail: 'A conta autenticada não corresponde ao e-mail salvo.' };
    }
    return { status: 'ok', detail: 'Conta conectada e autorizada pelo Google.' };
  } catch (err) {
    return classifyGoogleError(err);
  }
}

async function saveProbe(account, req) {
  const result = await probeAccount(account, req);
  await pool.query(
    'UPDATE gmail_accounts SET google_status=$1, google_status_detail=$2, google_status_checked_at=NOW() WHERE id=$3',
    [result.status, result.detail, account.id]
  );
  return result;
}

function statusLabel(status) {
  return ({
    ok: 'OK',
    reauth_required: 'CONFIRMAR NO GOOGLE',
    google_restricted: 'ACESSO RECUSADO',
    google_error: 'ERRO TEMPORÁRIO',
    oauth_not_configured: 'OAUTH PENDENTE',
    not_checked: 'NÃO VERIFICADA'
  })[status] || 'NÃO VERIFICADA';
}

function statusClass(status) {
  if (status === 'ok') return 'ok';
  if (status === 'reauth_required' || status === 'google_restricted') return 'warn';
  if (status === 'google_error' || status === 'oauth_not_configured') return 'bad';
  return 'idle';
}

function page(req) {
  const csrf = esc(req.session?.csrf || '');
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Separador de E-mails · misticakky yt</title>
<style>
:root{--rose:#e884a7;--rose2:#f8d8e4;--sea:#70aeb8;--sea2:#d9f0f1;--ink:#263d43;--muted:#687c80;--paper:#fffdfa;--line:#dbe7e3;--ok:#268461;--warn:#a56a1e;--bad:#b23c5b;--shadow:0 20px 55px rgba(46,89,96,.13)}
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:var(--ink);background:linear-gradient(160deg,#fff5f8,#fce8ef 46%,#dff3f3)}
.wrap{max-width:1180px;margin:0 auto;padding:24px 18px 60px}.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap}.brand{font-size:24px;font-weight:950;letter-spacing:-.04em}.brand span{color:#d65c88}.top-actions,.row{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.hero,.panel,.service,.stat{background:rgba(255,253,250,.93);border:1px solid rgba(255,255,255,.9);box-shadow:var(--shadow)}
.hero{border-radius:28px;padding:26px;margin-bottom:16px;position:relative;overflow:hidden}.hero:after{content:"";position:absolute;width:240px;height:240px;border-radius:50%;right:-95px;top:-105px;background:rgba(112,174,184,.22)}.hero h1{margin:0 0 8px;font-size:clamp(31px,5vw,48px);line-height:1;letter-spacing:-.055em}.hero h1 span{color:#d65c88}.hero p{margin:0;max-width:830px;line-height:1.55;color:var(--muted)}
.panel{border-radius:22px;padding:19px;margin-bottom:16px}.panel h2,.service h3{margin:0}.sub{font-size:12px;color:var(--muted);line-height:1.5;margin:5px 0 12px}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px}.stat{border-radius:18px;padding:15px}.stat .n{font-size:25px;font-weight:950}.stat .l{font-size:11px;color:var(--muted);margin-top:2px}
textarea{width:100%;min-height:115px;resize:vertical;border:1px solid var(--line);border-radius:15px;background:#fff;color:var(--ink);padding:13px 14px;font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;outline:none}textarea:focus{border-color:#91bdc2;box-shadow:0 0 0 4px rgba(112,174,184,.11)}
button,.btn{appearance:none;border:0;border-radius:12px;padding:10px 13px;font-weight:850;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;background:var(--rose);color:#fff}.secondary{background:#fff;color:var(--ink);border:1px solid var(--line)}.danger{background:#fff0f3;color:var(--bad);border:1px solid #f7cfd9}.google{background:#fff;color:#314349;border:1px solid #d9e5e3}.btn:disabled,button:disabled{opacity:.5;cursor:not-allowed}
.services{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.service{border-radius:20px;padding:17px}.service-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.columns{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.mini-panel{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff}.mini-title{padding:9px 11px;border-bottom:1px solid var(--line);font-size:11px;font-weight:900;background:#f8faf8}.list{max-height:235px;overflow:auto}.item{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border-bottom:1px solid #edf2ef;font:11px ui-monospace,SFMono-Regular,Consolas,monospace}.item:last-child{border-bottom:0}.email{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mini{padding:5px 7px;border-radius:8px;font-size:10px}.empty{padding:18px;text-align:center;color:var(--muted);font-size:11px}.pill{display:inline-flex;padding:6px 9px;border-radius:999px;background:#eef5f3;color:#526c71;font-size:10px;font-weight:900}
.status-grid{display:grid;grid-template-columns:1fr;gap:8px;margin-top:12px}.status-row{display:grid;grid-template-columns:minmax(220px,1fr) auto minmax(240px,.8fr);gap:10px;align-items:center;padding:11px 12px;border:1px solid var(--line);border-radius:14px;background:#fff}.status-email{font:12px ui-monospace,SFMono-Regular,Consolas,monospace;overflow:hidden;text-overflow:ellipsis}.status-badge{font-size:9px;font-weight:950;letter-spacing:.04em;padding:6px 8px;border-radius:999px;white-space:nowrap}.status-badge.ok{background:#e8f6ef;color:var(--ok)}.status-badge.warn{background:#fff2d9;color:var(--warn)}.status-badge.bad{background:#fde9ee;color:var(--bad)}.status-badge.idle{background:#eef1f1;color:#667579}.status-detail{font-size:10px;color:var(--muted);line-height:1.35}.note{font-size:11px;line-height:1.55;color:var(--muted);margin-top:10px}.toast{position:fixed;right:18px;bottom:18px;background:#263d43;color:#fff;border-radius:12px;padding:11px 14px;box-shadow:var(--shadow);opacity:0;transform:translateY(8px);pointer-events:none;transition:.2s}.toast.show{opacity:1;transform:none}
@media(max-width:900px){.stats{grid-template-columns:repeat(2,1fr)}.services{grid-template-columns:1fr}.status-row{grid-template-columns:1fr}.columns{grid-template-columns:1fr}}@media(max-width:560px){.stats{grid-template-columns:1fr}.wrap{padding:16px 12px 50px}.hero{padding:21px}}
</style>
</head>
<body><div class="wrap">
<div class="top"><div class="brand">misticakky <span>yt</span></div><div class="top-actions"><a class="btn secondary" href="/">GMAX Convites</a><form method="post" action="/logout"><input type="hidden" name="csrf" value="${csrf}"><button class="secondary">Sair</button></form></div></div>
<section class="hero"><div class="pill">painel de organização + status Google</div><h1>Separador de <span>E-mails</span></h1><p>Organize seu banco de e-mails por serviço e confira o estado das contas Google que você autorizou. O site não testa senhas e não tenta passar a verificação “não sou um robô”.</p></section>
<section class="panel"><div class="service-head"><div><h2>Banco geral de e-mails</h2><p class="sub">Cole os e-mails aqui. Duplicados são removidos automaticamente e os dados do separador ficam neste navegador.</p></div><span class="pill"><span id="masterCount">0</span>&nbsp; e-mails</span></div><textarea id="masterInput" placeholder="email1@gmail.com\nemail2@gmail.com\nemail3@gmail.com"></textarea><div class="row" style="margin-top:10px"><button onclick="addMaster()">Adicionar ao banco</button><button class="secondary" onclick="clearField('masterInput')">Limpar campo</button><button class="secondary" onclick="copyMaster()">Copiar banco</button><button class="danger" onclick="clearMaster()">Apagar banco</button></div></section>
<div class="stats"><div class="stat"><div class="n" id="countAll">0</div><div class="l">banco geral</div></div><div class="stat"><div class="n" id="count-youtube">0</div><div class="l">usados no YouTube</div></div><div class="stat"><div class="n" id="count-gemini">0</div><div class="l">usados no Gemini</div></div><div class="stat"><div class="n" id="count-prime">0</div><div class="l">usados no Prime Video</div></div><div class="stat"><div class="n" id="count-spotify">0</div><div class="l">usados no Spotify</div></div></div>
<section class="panel"><div class="service-head"><div><h2>Status das Contas Google</h2><p class="sub">A verificação usa apenas as contas conectadas via OAuth. E-mails que ainda não foram autorizados aparecem como “não verificada”.</p></div><div class="row"><a class="btn google" href="/oauth2/start">+ Autorizar Gmail</a><button id="checkGoogleBtn" onclick="checkGoogle()">Verificar conectadas</button></div></div><div id="googleStatus" class="status-grid"><div class="empty">Carregando status…</div></div><div class="note"><strong>Importante:</strong> a API do Google não informa se uma conta está vendo especificamente um CAPTCHA/“confirme que você não é um robô”. Quando a autorização deixa de funcionar, o painel marca a conta para confirmação manual no Google.</div></section>
<section class="services" id="services"></section>
</div><div class="toast" id="toast"></div>
<script>
const CSRF=${jsonEscape(req.session?.csrf || '')};
const MASTER_KEY='misticakky_email_master_v4';
const SERVICE_KEY='misticakky_email_services_v4';
const serviceMeta={youtube:{name:'YouTube',icon:'YT'},gemini:{name:'Gemini',icon:'G'},prime:{name:'Prime Video',icon:'P'},spotify:{name:'Spotify',icon:'S'}};
let master=new Set(JSON.parse(localStorage.getItem(MASTER_KEY)||'[]'));
let serviceData=JSON.parse(localStorage.getItem(SERVICE_KEY)||'{}');
for(const k of Object.keys(serviceMeta)){if(!Array.isArray(serviceData[k]))serviceData[k]=[];}
let googleAccounts=[];
function extractEmails(text){const found=String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[];return [...new Set(found.map(e=>e.trim().toLowerCase()))];}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),2100);}
function clearField(id){document.getElementById(id).value='';}
function usedSet(service){return new Set(serviceData[service]);}
function available(service){const u=usedSet(service);return [...master].filter(e=>!u.has(e)).sort();}
function save(){localStorage.setItem(MASTER_KEY,JSON.stringify([...master]));localStorage.setItem(SERVICE_KEY,JSON.stringify(serviceData));render();}
function addMaster(){const input=document.getElementById('masterInput');const emails=extractEmails(input.value);if(!emails.length)return toast('Nenhum e-mail válido encontrado.');let added=0;emails.forEach(e=>{if(!master.has(e)){master.add(e);added++;}});input.value='';save();toast(added+' e-mail(s) adicionado(s).');}
async function copyMaster(){const list=[...master].sort();if(!list.length)return toast('O banco está vazio.');await navigator.clipboard.writeText(list.join('\n'));toast(list.length+' e-mail(s) copiado(s).');}
function clearMaster(){if(confirm('Apagar todo o banco geral?')){master.clear();for(const k of Object.keys(serviceMeta))serviceData[k]=[];save();toast('Banco apagado.');}}
function addUsed(service){const input=document.getElementById('input-'+service);const emails=extractEmails(input.value);if(!emails.length)return toast('Nenhum e-mail válido encontrado.');let added=0;emails.forEach(e=>{master.add(e);if(!serviceData[service].includes(e)){serviceData[service].push(e);added++;}});input.value='';save();toast(added+' e-mail(s) marcado(s) no '+serviceMeta[service].name+'.');}
async function copyAvailable(service){const list=available(service);if(!list.length)return toast('Não há e-mails disponíveis.');await navigator.clipboard.writeText(list.join('\n'));toast(list.length+' disponível(is) copiado(s).');}
function markAll(service){const list=available(service);list.forEach(e=>{if(!serviceData[service].includes(e))serviceData[service].push(e);});save();toast(list.length+' e-mail(s) marcado(s).');}
function removeUsed(service,email){serviceData[service]=serviceData[service].filter(e=>e!==email);save();}
function clearService(service){if(confirm('Limpar os usados de '+serviceMeta[service].name+'?')){serviceData[service]=[];save();}}
function listHTML(items,service,type){if(!items.length)return '<div class="empty">Nenhum e-mail aqui.</div>';return items.map(email=>'<div class="item"><span class="email">'+escapeHtml(email)+'</span>'+(type==='used'?'<button class="mini danger" onclick="removeUsed(\''+jsQ(service)+'\',\''+jsQ(email)+'\')">remover</button>':'')+'</div>').join('');}
function jsQ(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function serviceCard(service){const meta=serviceMeta[service];return '<article class="service"><div class="service-head"><div><h3>'+meta.name+'</h3><p class="sub">Cole os e-mails já usados neste serviço.</p></div><span class="pill" id="pill-'+service+'">0</span></div><textarea id="input-'+service+'" placeholder="cole aqui e-mails já usados"></textarea><div class="row" style="margin-top:9px"><button onclick="addUsed(\''+service+'\')">Adicionar usados</button><button class="secondary" onclick="copyAvailable(\''+service+'\')">Copiar disponíveis</button><button class="secondary" onclick="markAll(\''+service+'\')">Marcar todos</button><button class="danger" onclick="clearService(\''+service+'\')">Limpar</button></div><div class="columns"><div class="mini-panel"><div class="mini-title">disponíveis · <span id="available-count-'+service+'">0</span></div><div class="list" id="available-'+service+'"></div></div><div class="mini-panel"><div class="mini-title">já usados</div><div class="list" id="used-'+service+'"></div></div></div></article>';}
document.getElementById('services').innerHTML=Object.keys(serviceMeta).map(serviceCard).join('');
function render(){document.getElementById('masterCount').textContent=master.size;document.getElementById('countAll').textContent=master.size;for(const service of Object.keys(serviceMeta)){const used=[...new Set(serviceData[service])].sort();serviceData[service]=used;const avail=available(service);document.getElementById('count-'+service).textContent=used.length;document.getElementById('pill-'+service).textContent=used.length;document.getElementById('available-count-'+service).textContent=avail.length;document.getElementById('available-'+service).innerHTML=listHTML(avail,service,'available');document.getElementById('used-'+service).innerHTML=listHTML(used,service,'used');}localStorage.setItem(MASTER_KEY,JSON.stringify([...master]));localStorage.setItem(SERVICE_KEY,JSON.stringify(serviceData));renderGoogle();}
function renderGoogle(){const el=document.getElementById('googleStatus');if(!el)return;const map=new Map(googleAccounts.map(a=>[a.email,a]));const emails=[...new Set([...master,...googleAccounts.map(a=>a.email)])].sort();if(!emails.length){el.innerHTML='<div class="empty">Adicione e-mails ao banco ou autorize uma conta Gmail.</div>';return;}el.innerHTML=emails.map(email=>{const a=map.get(email);const status=a?.status||'not_checked';const labels={ok:'OK',reauth_required:'CONFIRMAR NO GOOGLE',google_restricted:'ACESSO RECUSADO',google_error:'ERRO TEMPORÁRIO',oauth_not_configured:'OAUTH PENDENTE',not_checked:'NÃO VERIFICADA'};const classes={ok:'ok',reauth_required:'warn',google_restricted:'warn',google_error:'bad',oauth_not_configured:'bad',not_checked:'idle'};const detail=a?.detail||(a?'Conta conectada, mas ainda não conferida.':'Este e-mail ainda não foi conectado via OAuth.');return '<div class="status-row"><div class="status-email">'+escapeHtml(email)+'</div><span class="status-badge '+(classes[status]||'idle')+'">'+(labels[status]||'NÃO VERIFICADA')+'</span><div class="status-detail">'+escapeHtml(detail)+'</div></div>';}).join('');}
async function loadGoogle(){try{const r=await fetch('/api/google-status',{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('Falha ao carregar status');const data=await r.json();googleAccounts=data.accounts||[];renderGoogle();}catch(e){document.getElementById('googleStatus').innerHTML='<div class="empty">Não foi possível carregar o status Google.</div>';}}
async function checkGoogle(){const btn=document.getElementById('checkGoogleBtn');btn.disabled=true;btn.textContent='Verificando…';try{const r=await fetch('/api/google-status/check',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({csrf:CSRF})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Falha na verificação');googleAccounts=data.accounts||[];renderGoogle();toast('Contas conectadas verificadas.');}catch(e){toast(e.message);}finally{btn.disabled=false;btn.textContent='Verificar conectadas';}}
render();loadGoogle();
</script></body></html>`;
}

async function accountsPayload() {
  await ensureStatusSchema();
  const rows = (await pool.query(`
    SELECT id,email,google_status,google_status_detail,google_status_checked_at
    FROM gmail_accounts ORDER BY created_at DESC
  `)).rows;
  return rows.map(row => ({
    id: String(row.id),
    email: row.email,
    status: row.google_status || 'not_checked',
    label: statusLabel(row.google_status || 'not_checked'),
    className: statusClass(row.google_status || 'not_checked'),
    detail: row.google_status_detail || '',
    checkedAt: row.google_status_checked_at
  }));
}

function installRoutes(app) {
  originalGet.call(app, '/separador', (req, res) => {
    if (!req.session?.admin) return res.redirect('/login');
    if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
    res.send(page(req));
  });

  originalGet.call(app, '/api/google-status', async (req, res) => {
    if (!req.session?.admin) return res.status(401).json({ error: 'Não autorizado' });
    try {
      res.json({ accounts: await accountsPayload() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  originalPost.call(app, '/api/google-status/check', async (req, res) => {
    if (!req.session?.admin) return res.status(401).json({ error: 'Não autorizado' });
    if (!req.session?.csrf || req.body?.csrf !== req.session.csrf) return res.status(403).json({ error: 'CSRF inválido' });
    try {
      await ensureStatusSchema();
      const accounts = (await pool.query('SELECT * FROM gmail_accounts ORDER BY id')).rows;
      for (const account of accounts) await saveProbe(account, req);
      res.json({ accounts: await accountsPayload() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

express.application.get = function patchedGet(path, ...handlers) {
  if (!this[installed]) {
    this[installed] = true;
    installRoutes(this);
  }
  return originalGet.call(this, path, ...handlers);
};

express.response.send = function patchedSend(body) {
  if (typeof body === 'string' && body.includes('Convites capturados') && !body.includes('href="/separador"')) {
    body = body.replace('<a class="btn secondary" href="/">Painel</a>', '<a class="btn secondary" href="/">Painel</a><a class="btn secondary" href="/separador">Separador</a>');
  }
  return originalSend.call(this, body);
};
