import express from 'express';

const originalSend = express.response.send;
const originalGet = express.application.get;
const legalRoutesInstalled = Symbol.for('misticakky.legalRoutesInstalled');
const verificationMeta = '<meta name="google-site-verification" content="iF8VyHZXCVgadNhUSMb7U8ekFrLWKHYAHlTSkwtDQXg" />';

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

function publicPage(title, body) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · misticakky yt</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#243047;background:linear-gradient(155deg,#fff6fa 0%,#ffe7ef 48%,#d8f4f8 100%);min-height:100vh}.wrap{max-width:860px;margin:0 auto;padding:34px 20px 60px}.top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:22px}.brand{font-weight:900;font-size:24px}.brand span{color:#e75086}.card{background:rgba(255,255,255,.93);border:1px solid rgba(255,255,255,.95);box-shadow:0 18px 50px rgba(65,79,104,.12);border-radius:24px;padding:28px}.btn{display:inline-flex;padding:10px 14px;border-radius:12px;text-decoration:none;background:#ff8fb7;color:white;font-weight:800}.muted{color:#67738c;line-height:1.6}h1{font-size:34px;letter-spacing:-.04em;margin:0 0 12px}h2{margin-top:26px;font-size:20px}p,li{line-height:1.65}ul{padding-left:22px}a{color:#2b78a6}.footer{margin-top:18px;font-size:13px;color:#67738c;display:flex;gap:14px;flex-wrap:wrap}
</style>
</head>
<body><div class="wrap"><div class="top"><div class="brand">misticakky <span>yt</span></div><a class="btn" href="/login">Acessar painel</a></div><main class="card">${body}</main><div class="footer"><a href="/about">Página inicial</a><a href="/privacy">Privacidade</a><a href="/terms">Termos</a></div></div></body></html>`;
}

express.application.get = function patchedGet(path, ...handlers) {
  if (!this[legalRoutesInstalled]) {
    this[legalRoutesInstalled] = true;

    originalGet.call(this, '/about', (_req, res) => {
      res.send(publicPage('Página inicial', `
        <h1>misticakky yt</h1>
        <p class="muted">Painel privado para conectar contas Google com OAuth e localizar convites recentes de grupos familiares do Google no Gmail.</p>
        <h2>Como funciona</h2>
        <ul>
          <li>O acesso ao Gmail é feito pela tela oficial de autorização do Google.</li>
          <li>A senha da conta Google não é solicitada nem armazenada pelo site.</li>
          <li>O aplicativo usa acesso de leitura ao Gmail para identificar mensagens de convite de grupo familiar.</li>
          <li>Na primeira verificação, o sistema considera somente o período recente configurado; as verificações seguintes são incrementais.</li>
        </ul>
        <p>Contato do desenvolvedor: <a href="mailto:manubontempo1977@gmail.com">manubontempo1977@gmail.com</a></p>
      `));
    });

    originalGet.call(this, '/privacy', (_req, res) => {
      res.send(publicPage('Política de Privacidade', `
        <h1>Política de Privacidade</h1>
        <p class="muted">Última atualização: 9 de setembro de 2026.</p>
        <h2>Dados acessados</h2>
        <p>O misticakky yt usa OAuth 2.0 do Google e solicita acesso somente de leitura ao Gmail para localizar mensagens relacionadas a convites de grupo familiar do Google. O aplicativo pode processar endereço de e-mail da conta, metadados das mensagens, remetente, assunto, trecho da mensagem, data de recebimento e o link do convite quando encontrado.</p>
        <h2>Senhas e credenciais</h2>
        <p>O aplicativo não solicita nem armazena a senha da conta Google. Tokens de autorização necessários para manter a conexão podem ser armazenados de forma criptografada no servidor.</p>
        <h2>Finalidade</h2>
        <p>Os dados do Gmail são usados exclusivamente para fornecer a função solicitada pelo usuário: localizar e exibir convites de grupo familiar do Google. Os dados não são vendidos e não são usados para publicidade.</p>
        <h2>Compartilhamento</h2>
        <p>Não compartilhamos dados do Gmail com terceiros, exceto quando tecnicamente necessário para operar a infraestrutura do serviço ou quando exigido por lei. O uso das informações recebidas das APIs do Google segue a Google API Services User Data Policy, incluindo os requisitos de Limited Use.</p>
        <h2>Retenção e exclusão</h2>
        <p>Contas conectadas podem ser removidas pelo próprio painel. Ao remover uma conta, o aplicativo tenta revogar o token correspondente e exclui do banco os dados associados àquela conexão. O usuário também pode revogar o acesso a qualquer momento nas configurações da própria Conta Google.</p>
        <h2>Segurança</h2>
        <p>Aplicamos controles técnicos para reduzir o acesso não autorizado, incluindo autenticação administrativa, conexão HTTPS e criptografia de tokens armazenados.</p>
        <h2>Contato</h2>
        <p>Dúvidas sobre privacidade podem ser enviadas para <a href="mailto:manubontempo1977@gmail.com">manubontempo1977@gmail.com</a>.</p>
      `));
    });

    originalGet.call(this, '/terms', (_req, res) => {
      res.send(publicPage('Termos de Serviço', `
        <h1>Termos de Serviço</h1>
        <p class="muted">Última atualização: 9 de setembro de 2026.</p>
        <p>Ao usar o misticakky yt, você concorda em utilizar o serviço somente com contas Google que esteja autorizado a conectar e de acordo com as regras aplicáveis do Google.</p>
        <h2>Uso do serviço</h2>
        <p>O serviço fornece uma interface para localizar e organizar convites de grupo familiar recebidos no Gmail. Você é responsável pelas contas que autoriza e pelas ações realizadas com os links encontrados.</p>
        <h2>Disponibilidade</h2>
        <p>O serviço pode sofrer alterações, indisponibilidades temporárias ou limitações decorrentes das APIs e serviços de terceiros utilizados na operação.</p>
        <h2>Privacidade</h2>
        <p>O tratamento de dados é descrito na nossa <a href="/privacy">Política de Privacidade</a>.</p>
        <h2>Revogação de acesso</h2>
        <p>Você pode remover uma conta pelo painel ou revogar a autorização diretamente nas configurações da Conta Google.</p>
        <h2>Contato</h2>
        <p>Para suporte ou dúvidas: <a href="mailto:manubontempo1977@gmail.com">manubontempo1977@gmail.com</a>.</p>
      `));
    });
  }
  return originalGet.call(this, path, ...handlers);
};

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
  if (typeof body === 'string' && body.includes('</head>') && !body.includes('google-site-verification')) {
    body = body.replace('</head>', `${verificationMeta}\n</head>`);
  }

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
