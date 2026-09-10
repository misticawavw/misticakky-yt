import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const originalSend = express.response.send;
const originalPost = express.application.post;
const deleteRouteInstalled = Symbol.for('misticakky.inviteDeleteRouteInstalled');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

function decodeHtml(value = '') {
  return String(value)
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function groupedEntries(pairs) {
  const byEmail = new Map();
  for (const item of pairs) {
    if (!byEmail.has(item.email)) byEmail.set(item.email, []);
    const links = byEmail.get(item.email);
    if (!links.includes(item.url)) links.push(item.url);
  }
  return [...byEmail.entries()].map(([email, links]) => ({ email, links }));
}

function groupedLinksText(links, groupSize = 5) {
  const groups = [];
  for (let i = 0; i < links.length; i += groupSize) {
    groups.push(links.slice(i, i + groupSize).join('\n'));
  }
  return groups.join('\n\n');
}

function blockText(block) {
  return `E-mail: ${block.email}\n${groupedLinksText(block.links, 5)}`;
}

function collectInvitePairs(body) {
  const pairs = [];
  const re = /<span class="pill">([^<]+)<\/span>[\s\S]*?<a class="link" href="([^"]+)"[^>]*>/g;
  let match;
  while ((match = re.exec(body))) {
    const email = decodeHtml(match[1]).trim();
    const url = decodeHtml(match[2]).trim();
    if (email && url && !pairs.some(x => x.email === email && x.url === url)) {
      pairs.push({ email, url });
    }
  }
  return pairs;
}

function deleteButtonHtml(email, url, csrf) {
  return `<form class="inline delete-invite-form" method="post" action="/invites/delete" onsubmit="return confirm('Apagar este link do painel?')">
    <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
    <input type="hidden" name="email" value="${escapeHtml(email)}">
    <input type="hidden" name="invite_url" value="${escapeHtml(url)}">
    <button class="btn danger delete-link-btn" type="submit">Apagar link</button>
  </form>`;
}

function injectDeleteButtons(body, csrf) {
  return body.replace(
    /(<span class="pill">([^<]+)<\/span>[\s\S]*?<a class="link" href="([^"]+)"[^>]*>[^<]*<\/a><div>)(<a class="btn" href="[^"]+"[^>]*>Abrir convite<\/a>)(<\/div>)/g,
    (whole, before, emailEsc, urlEsc, openButton, after) => {
      if (whole.includes('delete-invite-form')) return whole;
      const email = decodeHtml(emailEsc).trim();
      const url = decodeHtml(urlEsc).trim();
      return `${before}${openButton}${deleteButtonHtml(email, url, csrf)}${after}`;
    }
  );
}

function copyPanelHtml(pairs) {
  const blocks = groupedEntries(pairs);
  if (!blocks.length) return '';

  const allText = blocks.map(blockText).join('\n\n--------------------\n\n');
  const cards = blocks.map((block, index) => {
    const text = blockText(block);
    const rows = Math.min(Math.max(block.links.length + Math.floor((block.links.length - 1) / 5) + 2, 7), 20);
    return `<div class="copy-email-block">
      <div class="copy-email-head">
        <div>
          <div class="copy-email-label">E-mail</div>
          <strong class="copy-email-address">${escapeHtml(block.email)}</strong>
        </div>
        <span class="copy-count">${block.links.length} link${block.links.length === 1 ? '' : 's'}</span>
      </div>
      <textarea id="copy-block-${index}" class="copy-block-text" rows="${rows}" readonly spellcheck="false">${escapeHtml(text)}</textarea>
      <button class="btn secondary copy-one-btn" type="button" onclick="copyInviteBlock('copy-block-${index}', this)">Copiar bloco</button>
    </div>`;
  }).join('');

  return `<div id="copy-links-panel" class="card stack">
    <div class="copy-panel-head">
      <div>
        <h2 style="margin:0">Copiar links</h2>
        <p class="tiny muted" style="margin:4px 0 0">Um bloco por e-mail. Todos os links da conta ficam juntos, separados de 5 em 5.</p>
      </div>
      <button class="btn secondary" type="button" onclick="copyAllInviteLinks(this)">Copiar tudo</button>
    </div>
    <div class="copy-email-grid">${cards}</div>
    <textarea id="all-invite-links" readonly spellcheck="false" aria-hidden="true" tabindex="-1">${escapeHtml(allText)}</textarea>
  </div>
  <script>
  function copyTextValue(value, button){
    var done=function(){var old=button.textContent;button.textContent='Copiado!';setTimeout(function(){button.textContent=old},1400)};
    if(navigator.clipboard&&window.isSecureContext){
      navigator.clipboard.writeText(value).then(done).catch(function(){fallbackCopy(value,done)});
    }else{fallbackCopy(value,done)}
  }
  function fallbackCopy(value,done){
    var temp=document.createElement('textarea');temp.value=value;temp.setAttribute('readonly','');temp.style.position='fixed';temp.style.opacity='0';document.body.appendChild(temp);temp.select();
    try{document.execCommand('copy');done()}catch(e){}
    document.body.removeChild(temp);
  }
  function copyInviteBlock(id,button){var box=document.getElementById(id);if(box)copyTextValue(box.value,button)}
  function copyAllInviteLinks(button){var box=document.getElementById('all-invite-links');if(box)copyTextValue(box.value,button)}
  </script>`;
}

const controlsCss = `
<style id="invite-controls-css">
  .invite>div:last-child{display:flex!important;gap:8px!important;align-items:center!important;flex-wrap:wrap!important}
  .delete-invite-form{display:inline-flex!important;margin:0!important}
  .delete-link-btn{padding:7px 10px!important;font-size:11px!important;border-radius:10px!important}
  #copy-links-panel{margin-top:14px!important;padding:18px!important}
  .copy-panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
  .copy-email-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}
  .copy-email-block{border:1px solid rgba(70,45,38,.16);background:rgba(255,252,247,.6);padding:14px;display:grid;gap:10px}
  .copy-email-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .copy-email-label{font-size:10px;letter-spacing:.13em;text-transform:uppercase;opacity:.58;margin-bottom:3px}
  .copy-email-address{font-size:13px;word-break:break-all}
  .copy-count{font-size:10px;white-space:nowrap;border:1px solid currentColor;padding:4px 7px;border-radius:999px;opacity:.7}
  .copy-block-text{width:100%;min-height:145px;max-height:360px;resize:vertical;border:1px solid rgba(70,45,38,.18);border-radius:0;padding:10px 11px;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:rgba(255,255,255,.62);color:inherit;white-space:pre;overflow:auto}
  #all-invite-links{position:fixed!important;left:-9999px!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
  .copy-one-btn{justify-self:start}
  @media(max-width:700px){.copy-email-grid{grid-template-columns:1fr}.copy-panel-head{align-items:flex-start}}
</style>`;

express.application.post = function patchedPost(path, ...handlers) {
  if (!this[deleteRouteInstalled]) {
    this[deleteRouteInstalled] = true;
    originalPost.call(this, '/invites/delete', async (req, res) => {
      if (!req.session?.admin) return res.redirect('/login');
      if (!req.session?.csrf || req.body?.csrf !== req.session.csrf) {
        return res.status(403).send('CSRF inválido.');
      }

      const email = String(req.body?.email || '').trim().toLowerCase();
      const inviteUrl = String(req.body?.invite_url || '').trim();
      if (!email || !inviteUrl) {
        req.session.flash = { type: 'error', text: 'Não foi possível identificar o link para apagar.' };
        return res.redirect('/');
      }

      try {
        const result = await pool.query(`
          DELETE FROM invites i
          USING gmail_accounts a
          WHERE i.account_id = a.id
            AND LOWER(a.email) = $1
            AND i.invite_url = $2
        `, [email, inviteUrl]);

        req.session.flash = {
          type: 'ok',
          text: result.rowCount ? 'Link apagado do painel.' : 'Esse link já não estava mais no painel.'
        };
      } catch (err) {
        req.session.flash = { type: 'error', text: `Erro ao apagar link: ${err.message}` };
      }
      res.redirect('/');
    });
  }
  return originalPost.call(this, path, ...handlers);
};

express.response.send = function patchedSend(body) {
  if (typeof body === 'string' && body.includes('Convites capturados')) {
    const pairs = collectInvitePairs(body);
    const csrf = this.req?.session?.csrf || '';

    body = injectDeleteButtons(body, csrf);

    if (!body.includes('id="invite-controls-css"')) {
      body = body.replace('</head>', `${controlsCss}</head>`);
    }

    const newPanel = copyPanelHtml(pairs);
    if (newPanel) {
      body = body.replace(/<div id="copy-links-panel"[\s\S]*?<\/script>/, newPanel);
    }
  }

  return originalSend.call(this, body);
};
