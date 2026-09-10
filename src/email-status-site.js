import express from 'express';
import dns from 'node:dns/promises';

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '200kb' }));

function extractEmails(text = '') {
  const found = String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(found.map(e => e.trim().toLowerCase()))].slice(0, 500);
}

async function inspectDomain(domain) {
  try {
    const mx = await dns.resolveMx(domain);
    const exchanges = mx
      .sort((a, b) => a.priority - b.priority)
      .map(x => String(x.exchange || '').toLowerCase())
      .filter(Boolean);

    const googleHosted = domain === 'gmail.com' || domain === 'googlemail.com' || exchanges.some(x =>
      x.endsWith('.google.com') ||
      x.endsWith('.googlemail.com') ||
      x.includes('aspmx.l.google.com') ||
      x.includes('googlemail-smtp')
    );

    return {
      domainExists: true,
      mxExists: exchanges.length > 0,
      googleHosted,
      provider: googleHosted ? (domain === 'gmail.com' || domain === 'googlemail.com' ? 'Google Gmail' : 'Google Workspace') : 'Outro provedor de e-mail',
      mx: exchanges
    };
  } catch (err) {
    let domainExists = false;
    try {
      await dns.resolveAny(domain);
      domainExists = true;
    } catch {}
    return {
      domainExists,
      mxExists: false,
      googleHosted: false,
      provider: domainExists ? 'Domínio existe, mas nenhum MX foi confirmado' : 'Domínio não encontrado no DNS',
      mx: []
    };
  }
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/check', async (req, res) => {
  const emails = extractEmails(req.body?.text || '');
  const domainCache = new Map();

  const results = await Promise.all(emails.map(async email => {
    const domain = email.split('@')[1];
    if (!domainCache.has(domain)) domainCache.set(domain, inspectDomain(domain));
    const info = await domainCache.get(domain);

    let automaticStatus = 'domain_not_found';
    if (info.domainExists && info.mxExists && info.googleHosted) automaticStatus = 'google_mail_ready';
    else if (info.domainExists && info.mxExists) automaticStatus = 'mail_ready_other';
    else if (info.domainExists) automaticStatus = 'domain_without_mx';

    return {
      email,
      domain,
      syntaxValid: true,
      domainExists: info.domainExists,
      mxExists: info.mxExists,
      googleHosted: info.googleHosted,
      provider: info.provider,
      mx: info.mx.slice(0, 4),
      automaticStatus,
      accountStatus: 'unknown_without_authorization'
    };
  }));

  res.json({ count: results.length, checkedAt: new Date().toISOString(), results });
});

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verificador de E-mails · misticakky</title>
<style>
:root{--pink:#e56f9c;--ink:#29363a;--muted:#718086;--line:#eadfe3;--ok:#23785a;--warn:#a36b24;--bad:#ad3f5b;--blue:#2c6f8d;--shadow:0 18px 50px rgba(87,52,67,.12)}
*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:var(--ink);background:linear-gradient(145deg,#fff5f8,#ffeaf1 50%,#eef8f8);min-height:100vh}.wrap{max-width:1180px;margin:0 auto;padding:28px 18px 60px}.hero,.panel,.stat{background:rgba(255,255,255,.94);border:1px solid #fff;box-shadow:var(--shadow)}.hero{border-radius:26px;padding:28px;margin-bottom:16px}.hero h1{margin:0 0 8px;font-size:clamp(32px,5vw,52px);letter-spacing:-.055em;line-height:1}.hero h1 span{color:var(--pink)}.hero p{margin:0;color:var(--muted);line-height:1.55;max-width:880px}.panel{border-radius:22px;padding:18px;margin-bottom:16px}textarea{width:100%;min-height:170px;border:1px solid var(--line);border-radius:15px;padding:13px 14px;font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;resize:vertical;outline:none}textarea:focus{border-color:#e690ae;box-shadow:0 0 0 4px rgba(229,111,156,.10)}.row{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:10px}button{border:0;border-radius:12px;padding:10px 14px;background:var(--pink);color:#fff;font-weight:850;cursor:pointer}.secondary{background:#fff;color:var(--ink);border:1px solid var(--line)}button:disabled{opacity:.55;cursor:wait}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}.stat{border-radius:18px;padding:15px}.stat .n{font-size:26px;font-weight:950}.stat .l{font-size:11px;color:var(--muted)}.list{display:grid;gap:9px}.item{border:1px solid var(--line);border-radius:15px;padding:12px;background:#fff}.item-top{display:grid;grid-template-columns:minmax(230px,1fr) repeat(3,150px);gap:9px;align-items:center}.email{font:12px ui-monospace,SFMono-Regular,Consolas,monospace;overflow:hidden;text-overflow:ellipsis}.badge{display:inline-flex;justify-content:center;padding:6px 8px;border-radius:999px;font-size:9px;font-weight:950;letter-spacing:.03em;text-align:center}.ok{background:#e8f6ef;color:var(--ok)}.warn{background:#fff2dc;color:var(--warn)}.bad{background:#fde9ee;color:var(--bad)}.blue{background:#e7f2f7;color:var(--blue)}.detail-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px}.detail{font-size:10px;color:var(--muted);line-height:1.45;background:#fafcfc;border:1px solid #edf1f0;border-radius:10px;padding:8px}.manual-wrap{display:grid;grid-template-columns:190px 1fr;gap:9px;align-items:center;margin-top:10px}.manual{appearance:none;width:100%;border:1px solid var(--line);border-radius:10px;padding:8px 9px;background:#fff;color:var(--ink);font-weight:750}.empty{padding:28px;text-align:center;color:var(--muted)}.note{font-size:11px;line-height:1.55;color:var(--muted);background:#fff9ec;border:1px solid #f3e1bc;border-radius:14px;padding:12px}.toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}.toolbar h2{margin:0}.tiny{font-size:11px;color:var(--muted)}@media(max-width:900px){.stats{grid-template-columns:repeat(2,1fr)}.item-top,.detail-grid,.manual-wrap{grid-template-columns:1fr}}@media(max-width:560px){.stats{grid-template-columns:1fr}.wrap{padding:18px 12px 50px}}
</style>
</head>
<body><div class="wrap">
<section class="hero"><div class="tiny">misticakky · verificador separado</div><h1>Verificador de <span>E-mails</span></h1><p>Cole os e-mails e o site verifica automaticamente o formato, o domínio, os servidores de e-mail (MX) e se o provedor é Gmail/Google Workspace. O estado individual da Conta Google só pode ser confirmado com autorização da própria conta.</p></section>
<section class="panel"><textarea id="input" placeholder="email1@gmail.com\nemail2@gmail.com\nemail@empresa.com"></textarea><div class="row"><button id="checkBtn" onclick="checkEmails()">Verificar e-mails</button><button class="secondary" onclick="document.getElementById('input').value=''">Limpar campo</button><button class="secondary" onclick="clearSaved()">Limpar status salvos</button></div><div id="lastCheck" class="tiny" style="margin-top:9px"></div></section>
<div class="stats"><div class="stat"><div class="n" id="total">0</div><div class="l">e-mails verificados</div></div><div class="stat"><div class="n" id="domainOk">0</div><div class="l">domínio existente</div></div><div class="stat"><div class="n" id="googleCount">0</div><div class="l">Gmail / Google Workspace</div></div><div class="stat"><div class="n" id="manualCount">0</div><div class="l">status manuais</div></div></div>
<section class="panel"><div class="toolbar"><div><h2>Resultado automático</h2><div class="tiny">Cada linha mostra exatamente o que foi confirmado pelo servidor.</div></div><button class="secondary" onclick="copyResults()">Copiar resultado</button></div><div id="results" class="list"><div class="empty">Cole os e-mails acima e clique em “Verificar e-mails”.</div></div></section>
<div class="note"><strong>Sobre “pede senha / pede robô”:</strong> não existe uma API pública do Google que permita descobrir isso informando apenas um endereço. Automatizar tentativas na tela de login para descobrir se cada conta existe ou qual desafio aparece seria testar contas no sistema de autenticação. Por isso, esses status ficam disponíveis apenas como anotação manual após você conferir a conta diretamente no Google.</div>
</div>
<script>
const KEY='misticakky_email_manual_status_v2';
let manual=JSON.parse(localStorage.getItem(KEY)||'{}');
let current=[];
const options=[['','NÃO MARCADO'],['asks_password','PEDE SENHA'],['robot_check','VERIFICAÇÃO DE ROBÔ'],['disabled','DESATIVADA'],['recovery','PEDE RECUPERAÇÃO'],['ok','OK'],['other','OUTRO']];
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function save(){localStorage.setItem(KEY,JSON.stringify(manual));render();}
function setManual(email,value){if(value)manual[email]=value;else delete manual[email];save();}
function label(v){return (options.find(x=>x[0]===v)||['','NÃO MARCADO'])[1];}
async function checkEmails(){const btn=document.getElementById('checkBtn');btn.disabled=true;btn.textContent='Consultando DNS…';try{const text=document.getElementById('input').value;const r=await fetch('/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});const data=await r.json();if(!r.ok)throw new Error('Falha');current=data.results||[];document.getElementById('lastCheck').textContent=current.length?'Última verificação: '+new Date(data.checkedAt).toLocaleString('pt-BR'):'Nenhum e-mail válido encontrado.';render();}catch{document.getElementById('results').innerHTML='<div class="empty">Não foi possível consultar os domínios agora.</div>';}finally{btn.disabled=false;btn.textContent='Verificar e-mails';}}
function statusText(x){if(x.automaticStatus==='google_mail_ready')return 'GOOGLE CONFIRMADO';if(x.automaticStatus==='mail_ready_other')return 'E-MAIL ATIVO NO DOMÍNIO';if(x.automaticStatus==='domain_without_mx')return 'SEM MX CONFIRMADO';return 'DOMÍNIO NÃO ENCONTRADO';}
function statusClass(x){if(x.automaticStatus==='google_mail_ready')return 'ok';if(x.automaticStatus==='mail_ready_other')return 'blue';if(x.automaticStatus==='domain_without_mx')return 'warn';return 'bad';}
function render(){document.getElementById('total').textContent=current.length;document.getElementById('domainOk').textContent=current.filter(x=>x.domainExists).length;document.getElementById('googleCount').textContent=current.filter(x=>x.googleHosted).length;document.getElementById('manualCount').textContent=current.filter(x=>manual[x.email]).length;const el=document.getElementById('results');if(!current.length){el.innerHTML='<div class="empty">Cole os e-mails acima e clique em “Verificar e-mails”.</div>';return;}el.innerHTML=current.map(x=>{const opts=options.map(([v,t])=>'<option value="'+esc(v)+'" '+((manual[x.email]||'')===v?'selected':'')+'>'+esc(t)+'</option>').join('');const mx=x.mx&&x.mx.length?x.mx.join(', '):'nenhum servidor MX retornado';return '<div class="item"><div class="item-top"><div class="email">'+esc(x.email)+'</div><span class="badge ok">FORMATO OK</span><span class="badge '+(x.domainExists?'ok':'bad')+'">'+(x.domainExists?'DOMÍNIO OK':'DOMÍNIO FALHOU')+'</span><span class="badge '+statusClass(x)+'">'+statusText(x)+'</span></div><div class="detail-grid"><div class="detail"><strong>Provedor:</strong><br>'+esc(x.provider)+'</div><div class="detail"><strong>MX:</strong><br>'+esc(mx)+'</div><div class="detail"><strong>Conta individual:</strong><br>não confirmável somente pelo endereço</div></div><div class="manual-wrap"><div class="tiny"><strong>Status observado por você</strong></div><select class="manual" onchange="setManual(\''+x.email.replace(/'/g,"\\'")+'\',this.value)">'+opts+'</select></div></div>';}).join('');}
async function copyResults(){if(!current.length)return;const text=current.map(x=>x.email+' | '+statusText(x)+' | '+x.provider+' | conta individual: não confirmada | '+label(manual[x.email]||'')).join('\n');await navigator.clipboard.writeText(text);}
function clearSaved(){if(confirm('Apagar todos os status manuais salvos?')){manual={};save();}}
render();
</script></body></html>`);
});

app.listen(PORT, '0.0.0.0', () => console.log(`email status site listening on ${PORT}`));
