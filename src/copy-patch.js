import express from 'express';

const originalSend = express.response.send;

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

const compactCss = `
<style id="compact-dashboard-fix">
  .grid{align-items:start!important}
  .grid>section.card{align-self:start!important}
  .grid>section.card:nth-child(2){max-height:680px;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
  .grid>section.card:nth-child(2)>.stack{gap:9px!important}
  .grid>section.card:nth-child(2) .invite{padding:11px 12px!important;border-radius:14px!important;gap:8px!important}
  .grid>section.card:nth-child(2) .invite .tiny{font-size:11px!important}
  .grid>section.card:nth-child(2) .invite strong{font-size:13px;line-height:1.25}
  .grid>section.card:nth-child(2) .invite a.link{font-size:11px;line-height:1.25;display:block}
  .grid>section.card:nth-child(2) .invite .btn{padding:7px 10px;font-size:11px;border-radius:10px}
  #copy-links-panel{margin-top:14px!important;padding:16px!important}
  #all-invite-links{min-height:105px!important;max-height:170px!important}
  @media(max-width:780px){
    .grid>section.card:nth-child(2){max-height:560px}
  }
</style>`;

express.response.send = function patchedSend(body) {
  if (typeof body === 'string' && body.includes('Convites capturados')) {
    if (!body.includes('id="compact-dashboard-fix"')) {
      body = body.replace('</head>', `${compactCss}</head>`);
    }

    const matches = [...body.matchAll(/<a class="link" href="([^"]+)"/g)];
    const links = [...new Set(matches.map(match => decodeHtml(match[1])))];

    if (links.length > 0 && !body.includes('id="all-invite-links"')) {
      const list = escapeHtml(links.join('\n'));
      const panel = `
<div id="copy-links-panel" class="card stack">
  <div class="row">
    <div>
      <h2 style="margin:0">Copiar links</h2>
      <p class="tiny muted" style="margin-bottom:0">${links.length} link(s) · um por linha</p>
    </div>
    <button class="btn secondary" type="button" onclick="copyAllInviteLinks(this)">Copiar todos os links</button>
  </div>
  <textarea id="all-invite-links" readonly spellcheck="false" style="width:100%;resize:vertical;border:1px solid #ead5de;border-radius:14px;padding:10px 12px;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#fff;color:#243047;white-space:pre;overflow:auto">${list}</textarea>
</div>
<script>
function copyAllInviteLinks(button){
  var box=document.getElementById('all-invite-links');
  if(!box)return;
  var done=function(){var old=button.textContent;button.textContent='Copiado!';setTimeout(function(){button.textContent=old},1400)};
  if(navigator.clipboard&&window.isSecureContext){
    navigator.clipboard.writeText(box.value).then(done).catch(function(){box.focus();box.select();try{document.execCommand('copy');done()}catch(e){}});
  }else{
    box.focus();box.select();try{document.execCommand('copy');done()}catch(e){}
  }
}
</script>`;
      body = body.replace('</div></body></html>', `${panel}</div></body></html>`);
    }
  }
  return originalSend.call(this, body);
};
