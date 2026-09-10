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
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return { googleHosted: true, provider: 'Google Gmail', mx: [] };
  }

  try {
    const mx = await dns.resolveMx(domain);
    const exchanges = mx.map(x => String(x.exchange || '').toLowerCase());
    const googleHosted = exchanges.some(x =>
      x.includes('google.com') ||
      x.includes('googlemail.com') ||
      x.includes('googlemail-smtp') ||
      x.includes('aspmx.l.google.com')
    );
    return { googleHosted, provider: googleHosted ? 'Google Workspace' : 'Outro provedor', mx: exchanges };
  } catch {
    return { googleHosted: false, provider: 'Domínio sem MX confirmado', mx: [] };
  }
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/check', async (req, res) => {
  const emails = extractEmails(req.body?.text || '');
  const domainCache = new Map();
  const results = [];

  for (const email of emails) {
    const domain = email.split('@')[1];
    if (!domainCache.has(domain)) domainCache.set(domain, inspectDomain(domain));
    const info = await domainCache.get(domain);
    results.push({
      email,
      domain,
      syntaxValid: true,
      googleHosted: info.googleHosted,
      provider: info.provider,
      automaticStatus: info.googleHosted ? 'google_email' : 'not_google_hosted'
    });
  }

  res.json({ count: results.length, results });
});

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verificador de E-mails · misticakky</title>
<style>
:root{--bg:#fff4f8;--card:#fff;--pink:#e56f9c;--pink2:#f9d8e4;--ink:#29363a;--muted:#718086;--line:#eadfe3;--ok:#23785a;--warn:#a36b24;--bad:#ad3f5b;--shadow:0 18px 50px rgba(87,52,67,.12)}
*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:var(--ink);background:linear-gradient(145deg,#fff5f8,#ffeaf1 50%,#eef8f8);min-height:100vh}.wrap{max-width:1050px;margin:0 auto;padding:28px 18px 60px}.hero{background:rgba(255,255,255,.92);border:1px solid #fff;border-radius:26px;padding:28px;box-shadow:var(--shadow);margin-bottom:16px}.hero h1{margin:0 0 8px;font-size:clamp(32px,5vw,52px);letter-spacing:-.055em;line-height:1}.hero h1 span{color:var(--pink)}.hero p{margin:0;color:var(--muted);line-height:1.55;max-width:830px}.panel{background:rgba(255,255,255,.95);border:1px solid #fff;border-radius:22px;padding:18px;box-shadow:var(--shadow);margin-bottom:16px}textarea{width:100%;min-height:170px;border:1px solid var(--line);border-radius:15px;padding:13px 14px;font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;resize:vertical;outline:none}textarea:focus{border-color:#e690ae;box-shadow:0 0 0 4px rgba(229,111,156,.10)}.row{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:10px}button{border:0;border-radius:12px;padding:10px 14px;background:var(--pink);color:#fff;font-weight:850;cursor:pointer}.secondary{background:#fff;color:var(--ink);border:1px solid var(--line)}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}.stat{background:#fff;border:1px solid #fff;border-radius:18px;padding:15px;box-shadow:var(--shadow)}.stat .n{font-size:26px;font-weight:950}.stat .l{font-size:11px;color:var(--muted)}.list{display:grid;gap:8px}.item{display:grid;grid-template-columns:minmax(230px,1fr) 150px 180px minmax(190px,.8fr);gap:10px;align-items:center;border:1px solid var(--line);border-radius:14px;padding:11px;background:#fff}.email{font:12px ui-monospace,SFMono-Regular,Consolas,monospace;overflow:hidden;text-overflow:ellipsis}.badge{display:inline-flex;justify-content:center;padding:6px 8px;border-radius:999px;font-size:9px;font-weight:950;letter-spacing:.03em}.google{background:#e8f6ef;color:var(--ok)}.other{background:#eef1f2;color:#69777b}.manual{appearance:none;width:100%;border:1px solid var(--line);border-radius:10px;padding:8px 9px;background:#fff;color:var(--ink);font-weight:750}.detail{font-size:10px;color:var(--muted);line-height:1.4}.empty{padding:28px;text-align:center;color:var(--muted)}.note{font-size:11px;line-height:1.55;color:var(--muted);background:#fff9ec;border:1px solid #f3e1bc;border-radius:14px;padding:12px}.toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}.toolbar h2{margin:0}.tiny{font-size:11px;color:var(--muted)}@media(max-width:800px){.stats{grid-template-columns:1fr}.item{grid-template-columns:1fr}.wrap{padding:18px 12px 50px}}
</style>
</head>
<body><div class="wrap">
<section class="hero"><div class="tiny">misticakky · verificador separado</div><h1>Verificador de <span>E-mails</span></h1><p>Cole uma lista e veja quais endereços têm formato válido e quais domínios usam Google Gmail/Google Workspace. Depois, você pode salvar um status manual como “pede senha”, “verificação de robô” ou “desativada”.</p></section>
<section class="panel"><textarea id="input" placeholder="email1@gmail.com\nemail2@gmail.com\nemail@empresa.com"></textarea><div class="row"><button id="checkBtn" onclick="checkEmails()">Verificar e-mails</button><button class="secondary" onclick="document.getElementById('input').value=''">Limpar campo</button><button class="secondary" onclick="clearSaved()">Limpar status salvos</button></div></section>
<div class="stats"><div class="stat"><div class="n" id="total">0</div><div class="l">e-mails</div></div><div class="stat"><div class="n" id="googleCount">0</div><div class="l">Google / Workspace</div></div><div class="stat"><div class="n" id="manualCount">0</div><div class="l">com status manual</div></div></div>
<section class="panel"><div class="toolbar"><div><h2>Status</h2><div class="tiny">Os status manuais ficam salvos neste navegador.</div></div><button class="secondary" onclick="copyResults()">Copiar resultado</button></div><div id="results" class="list"><div class="empty">Cole os e-mails acima e clique em “Verificar e-mails”.</div></div></section>
<div class="note"><strong>Importante:</strong> este site não tenta descobrir se uma conta Google existe, não automatiza a tela de login e não tenta passar CAPTCHA. O Google não fornece uma API pública para dizer “este e-mail foi direto para a tela de senha”.</div>
</div>
<script>
const KEY='misticakky_email_manual_status_v1';
let manual=JSON.parse(localStorage.getItem(KEY)||'{}');
let current=[];
const options=[['','NÃO MARCADO'],['asks_password','PEDE SENHA'],['robot_check','VERIFICAÇÃO DE ROBÔ'],['disabled','DESATIVADA'],['recovery','PEDE RECUPERAÇÃO'],['ok','OK'],['other','OUTRO']];
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function save(){localStorage.setItem(KEY,JSON.stringify(manual));render();}
function setManual(email,value){if(value)manual[email]=value;else delete manual[email];save();}
function label(v){return (options.find(x=>x[0]===v)||['','NÃO MARCADO'])[1];}
async function checkEmails(){const btn=document.getElementById('checkBtn');btn.disabled=true;btn.textContent='Verificando…';try{const text=document.getElementById('input').value;const r=await fetch('/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});const data=await r.json();current=data.results||[];render();}catch{document.getElementById('results').innerHTML='<div class="empty">Não foi possível verificar agora.</div>';}finally{btn.disabled=false;btn.textContent='Verificar e-mails';}}
function render(){document.getElementById('total').textContent=current.length;document.getElementById('googleCount').textContent=current.filter(x=>x.googleHosted).length;document.getElementById('manualCount').textContent=current.filter(x=>manual[x.email]).length;const el=document.getElementById('results');if(!current.length){el.innerHTML='<div class="empty">Cole os e-mails acima e clique em “Verificar e-mails”.</div>';return;}el.innerHTML=current.map(x=>{const opts=options.map(([v,t])=>'<option value="'+esc(v)+'" '+((manual[x.email]||'')===v?'selected':'')+'>'+esc(t)+'</option>').join('');return '<div class="item"><div class="email">'+esc(x.email)+'</div><span class="badge '+(x.googleHosted?'google':'other')+'">'+(x.googleHosted?'GOOGLE':'OUTRO DOMÍNIO')+'</span><select class="manual" onchange="setManual(\''+x.email.replace(/'/g,"\\'")+'\',this.value)">'+opts+'</select><div class="detail">'+esc(x.provider)+'</div></div>';}).join('');}
async function copyResults(){if(!current.length)return;const text=current.map(x=>x.email+' | '+(x.googleHosted?'Google':'Outro domínio')+' | '+label(manual[x.email]||'')).join('\n');await navigator.clipboard.writeText(text);}
function clearSaved(){if(confirm('Apagar todos os status manuais salvos?')){manual={};save();}}
render();
</script></body></html>`);
});

app.listen(PORT, '0.0.0.0', () => console.log(`email status site listening on ${PORT}`));
