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

express.response.send = function patchedSend(body) {
  if (typeof body === 'string' && body.includes('Convites capturados')) {
    const matches = [...body.matchAll(/<a class="link" href="([^"]+)"/g)];
    const links = [...new Set(matches.map(match => decodeHtml(match[1])))];

    if (links.length > 0 && !body.includes('id="all-invite-links"')) {
      const list = escapeHtml(links.join('\n'));
      const panel = `
<div class="card stack" style="margin-top:18px">
  <div class="row">
    <div>
      <h2 style="margin:0">Copiar links</h2>
      <p class="tiny muted" style="margin-bottom:0">${links.length} link(s) · um por linha</p>
    </div>
    <button class="btn secondary" type="button" onclick="copyAllInviteLinks(this)">Copiar todos os links</button>
  </div>
  <textarea id="all-invite-links" readonly spellcheck="false" style="width:100%;min-height:140px;resize:vertical;border:1px solid #ead5de;border-radius:14px;padding:12px 13px;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#fff;color:#243047;white-space:pre;overflow:auto">${list}</textarea>
  <p class="tiny muted" style="margin:0">Se o navegador bloquear o botão, clique na caixa e use Ctrl+A e Ctrl+C.</p>
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
