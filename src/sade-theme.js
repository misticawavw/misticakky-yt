import express from 'express';

const originalSend = express.response.send;

const sadeThemeCss = `
<style id="sade-editorial-theme">
:root{
  --sade-ink:#11100f;
  --sade-wine:#5f1724;
  --sade-wine-deep:#3c0d15;
  --sade-cream:#f3eee6;
  --sade-paper:#faf8f4;
  --sade-muted:#746d66;
  --sade-line:#cfc7bd;
  --sade-gold:#a48b62;
}
*{box-sizing:border-box}
html{background:var(--sade-cream)!important}
body{
  background:
    radial-gradient(circle at 85% 12%,rgba(95,23,36,.055),transparent 28%),
    linear-gradient(145deg,#eee9e1 0%,#f7f4ee 55%,#ece6dd 100%)!important;
  color:var(--sade-ink)!important;
  font-family:Arial,Helvetica,sans-serif!important;
  letter-spacing:.005em;
}
body:before,body:after{display:none!important}
.wrap{max-width:1160px!important;padding:34px 28px 70px!important}
.top{
  padding:0 0 18px!important;
  margin-bottom:26px!important;
  border-bottom:1px solid rgba(17,16,15,.34)!important;
  align-items:center!important;
}
.brand{
  color:var(--sade-ink)!important;
  font-family:Arial,Helvetica,sans-serif!important;
  font-size:17px!important;
  font-weight:800!important;
  letter-spacing:.16em!important;
  text-transform:uppercase!important;
}
.brand span{color:var(--sade-wine)!important}
.nav{gap:8px!important}
.card{
  background:rgba(250,248,244,.96)!important;
  border:1px solid rgba(17,16,15,.15)!important;
  border-radius:3px!important;
  box-shadow:0 16px 44px rgba(24,18,16,.055)!important;
  backdrop-filter:none!important;
}
.card.hero{
  position:relative!important;
  overflow:hidden!important;
  padding:42px 44px!important;
  background:linear-gradient(105deg,#0d0d0d 0%,#171311 66%,#321017 100%)!important;
  border:0!important;
  color:#f7f1e7!important;
  box-shadow:0 18px 46px rgba(0,0,0,.13)!important;
}
.card.hero:after{
  content:"";
  position:absolute;
  right:-52px;
  top:-80px;
  width:230px;
  height:230px;
  border:1px solid rgba(244,236,223,.16);
  border-radius:50%;
  box-shadow:0 0 0 36px rgba(244,236,223,.025),0 0 0 72px rgba(244,236,223,.018);
  pointer-events:none;
}
.hero .title{
  color:#fffaf2!important;
  max-width:720px!important;
  font-family:"Bodoni 72","Didot","Baskerville","Times New Roman",serif!important;
  font-size:clamp(38px,5vw,58px)!important;
  font-weight:400!important;
  line-height:.98!important;
  letter-spacing:-.035em!important;
}
.hero .sub{color:rgba(250,244,234,.73)!important;max-width:690px!important}
.hero .pill{
  color:#ead8d9!important;
  background:transparent!important;
  border:1px solid rgba(229,200,204,.38)!important;
}
h1,h2,h3,.title{
  font-family:"Bodoni 72","Didot","Baskerville","Times New Roman",serif!important;
  font-weight:500!important;
}
h2{letter-spacing:-.015em!important}
.sub,.muted{color:var(--sade-muted)!important}
.hero .sub,.hero .muted{color:rgba(250,244,234,.73)!important}
.pill{
  border-radius:2px!important;
  padding:6px 9px!important;
  background:#eee6dc!important;
  color:var(--sade-wine)!important;
  border:1px solid #d8cdc1!important;
  font-size:10px!important;
  font-weight:800!important;
  letter-spacing:.09em!important;
  text-transform:uppercase!important;
}
.btn{
  background:var(--sade-wine)!important;
  color:#fff8ef!important;
  border:1px solid var(--sade-wine)!important;
  border-radius:2px!important;
  box-shadow:none!important;
  font-size:12px!important;
  font-weight:800!important;
  letter-spacing:.045em!important;
  transition:background .18s ease,color .18s ease,border-color .18s ease,transform .18s ease!important;
}
.btn:hover{background:var(--sade-wine-deep)!important;border-color:var(--sade-wine-deep)!important;transform:translateY(-1px)}
.btn.secondary{
  background:transparent!important;
  color:var(--sade-ink)!important;
  border:1px solid rgba(17,16,15,.38)!important;
}
.btn.secondary:hover{background:var(--sade-ink)!important;color:var(--sade-cream)!important}
.btn.danger{background:transparent!important;color:#7b2732!important;border:1px solid #b88f95!important}
.grid{gap:20px!important;align-items:start!important}
.account,.invite{
  background:#f7f3ec!important;
  border:1px solid #d9d0c6!important;
  border-radius:2px!important;
  box-shadow:none!important;
}
.invite a.link{color:var(--sade-wine)!important;text-decoration-color:rgba(95,23,36,.35)!important}
.notice{background:#eef0e9!important;color:#46523c!important;border:1px solid #cbd1c1!important;border-radius:2px!important}
.error{background:#f4e8e8!important;color:#731d2b!important;border:1px solid #d8bfc3!important;border-radius:2px!important}
.empty{color:#8a8279!important}
label{font-size:11px!important;letter-spacing:.08em!important;text-transform:uppercase!important}
input{
  background:#fbf9f5!important;
  color:var(--sade-ink)!important;
  border:0!important;
  border-bottom:1px solid #9e968d!important;
  border-radius:0!important;
  padding:13px 3px!important;
  box-shadow:none!important;
}
input:focus{border-color:var(--sade-wine)!important;box-shadow:0 1px 0 var(--sade-wine)!important}
.login{max-width:500px!important;margin:9vh auto 0!important}
.login .card{padding:38px!important;border-top:4px solid var(--sade-wine)!important}
.login .title{font-size:46px!important;line-height:1!important;letter-spacing:-.035em!important}
.fish{display:none!important}
#copy-links-panel{background:#f9f6f1!important}
#all-invite-links{
  background:#f1ece4!important;
  color:#171513!important;
  border:1px solid #c8beb2!important;
  border-radius:2px!important;
}
a{color:var(--sade-wine)}
.footer{border-top:1px solid rgba(17,16,15,.18);padding-top:16px!important}
@media(max-width:780px){
  .wrap{padding:22px 16px 54px!important}
  .card.hero{padding:30px 24px!important}
  .hero .title{font-size:40px!important}
  .top{align-items:flex-start!important}
}
</style>`;

function stripOceanBanner(body) {
  return body
    .replace(/<style id="misticakky-ocean-banner-css">[\s\S]*?<\/style>\s*/g, '')
    .replace(/<section class="misticakky-ocean-banner" id="misticakky-ocean-banner">[\s\S]*?<\/section>\s*/g, '');
}

express.response.send = function sadePatchedSend(body) {
  if (typeof body === 'string') {
    body = stripOceanBanner(body);
    if (body.includes('</head>') && !body.includes('id="sade-editorial-theme"')) {
      body = body.replace('</head>', `${sadeThemeCss}\n</head>`);
    }
  }
  return originalSend.call(this, body);
};
