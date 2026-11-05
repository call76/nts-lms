// Professional, downloadable certificate (A4 landscape). One standalone HTML page: the person can
// download it as PDF or PNG, or print it. Student photo and real marks are part of the design.
const esc = (v = '') => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dateFmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—');

function renderCertificate(o) {
  const primary = /^#[0-9a-f]{6}$/i.test(o.primary || '') ? o.primary : '#0d4a34';
  const accent = /^#[0-9a-f]{6}$/i.test(o.accent || '') ? o.accent : '#b8892b';
  const rows = (o.rows || []).slice(0, 8);
  const initials = (o.studentName || 'N').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const fileBase = `NTS-Certificate-${o.code}`;
  const sigs = (o.signatures || []).slice(0, 2);
  const kind = o.isInternship ? 'INTERNSHIP' : 'ACHIEVEMENT';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Certificate ${esc(o.code)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;800;900&family=Montserrat:wght@400;500;600;700&family=Great+Vibes&display=swap">
<style>
:root{--p:${primary};--a:${accent};--ink:#1d2b24;--muted:#6b7770}
*{box-sizing:border-box}html,body{margin:0}
body{background:#e9ece8;font-family:'Montserrat',Arial,sans-serif;color:var(--ink);min-height:100vh}
.bar{position:sticky;top:0;z-index:5;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;padding:12px;background:#fff;border-bottom:1px solid #dde3de}
.bar button{font:600 13px 'Montserrat',Arial;border:0;border-radius:10px;padding:10px 18px;cursor:pointer;background:var(--p);color:#fff}
.bar button.alt{background:#fff;color:var(--p);border:1.5px solid var(--p)}
.bar button:disabled{opacity:.5;cursor:wait}
.wrap{display:flex;justify-content:center;padding:18px 8px 40px;overflow:hidden}
#stage{width:1123px;height:794px;transform-origin:top center;flex:none}
#sheet{position:relative;width:1123px;height:794px;background:radial-gradient(circle at 50% 38%,#ffffff 0%,#fffdf6 55%,#f7f2e4 100%);overflow:hidden}
.b1{position:absolute;inset:14px;border:4px solid var(--a)}
.b2{position:absolute;inset:26px;border:1.5px solid var(--a);opacity:.75}
.c{position:absolute;width:46px;height:46px;border:6px solid var(--p)}
.c.tl{left:20px;top:20px;border-right:0;border-bottom:0}.c.tr{right:20px;top:20px;border-left:0;border-bottom:0}
.c.bl{left:20px;bottom:20px;border-right:0;border-top:0}.c.br{right:20px;bottom:20px;border-left:0;border-top:0}
.wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:900 330px 'Playfair Display',Georgia,serif;color:var(--a);opacity:.04;pointer-events:none}
.in{position:absolute;inset:44px 70px 40px;display:flex;flex-direction:column;align-items:center;text-align:center}
.logo{height:54px;max-width:200px;object-fit:contain;margin-bottom:4px}
.org{font:700 15px 'Montserrat';letter-spacing:6px;color:var(--p);text-transform:uppercase}
h1{margin:8px 0 0;font:900 52px/1.05 'Playfair Display',Georgia,serif;color:var(--a);letter-spacing:1px;text-transform:uppercase}
.sub{margin-top:4px;font:italic 500 17px 'Montserrat';color:#1a7a52}
.lead{margin-top:14px;font:500 13px 'Montserrat';letter-spacing:3px;color:#7b867f;text-transform:uppercase}
.photo{margin-top:10px;width:96px;height:96px;border-radius:50%;border:4px solid var(--a);padding:3px;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.12)}
.photo img,.photo div{width:100%;height:100%;border-radius:50%;object-fit:cover;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--p),#1a7a52);color:#fff;font:800 30px 'Montserrat'}
.name{margin-top:8px;font:800 44px/1.1 'Playfair Display',Georgia,serif;color:var(--p)}
.line{width:380px;height:2px;background:var(--a);margin:6px 0 10px}
.for{font:400 15px 'Montserrat';color:#444}
.prog{margin-top:4px;font:800 28px 'Playfair Display',Georgia,serif;color:#8a6414;text-transform:uppercase}
.where{font:500 13px 'Montserrat';color:var(--muted);margin-top:2px}
.pill{margin-top:10px;display:inline-flex;gap:8px;align-items:center;padding:7px 22px;border-radius:999px;border:2px solid var(--a);background:#f8f1dc;font:700 15px 'Montserrat';color:var(--p)}
.marks{margin-top:10px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px 38px;width:640px;text-align:left}
.marks div{display:flex;justify-content:space-between;gap:10px;font:500 12px 'Montserrat';border-bottom:1px dotted #c9c3ae;padding:2px 0;color:#34413a}
.marks b{color:var(--p)}
.bot{position:absolute;left:0;right:0;bottom:44px;display:grid;grid-template-columns:1fr auto 1fr;align-items:end}
.qr{width:150px;text-align:left;font:500 10px 'Montserrat';color:var(--muted)}
.qrbox{width:84px;height:84px;background:#fff;border:1px solid #ddd;border-radius:8px;padding:4px;margin-bottom:5px}
.qrbox svg{width:100%;height:100%}
.seal{width:116px;height:116px;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;background:radial-gradient(circle at 35% 30%,#e7c767,#b8892b 60%,#8a6414);box-shadow:0 0 0 4px #fff,0 0 0 6px var(--a);color:#fff;font:800 11px/1.25 'Montserrat';letter-spacing:1px;overflow:hidden}
.seal img{width:100%;height:100%;object-fit:contain;background:#fff}
.sigs{display:flex;gap:22px;justify-content:flex-end}
.sig{width:170px;text-align:center;font:500 11px 'Montserrat';color:#444}
.sig .im{height:50px;display:flex;align-items:flex-end;justify-content:center}
.sig img{max-height:48px;max-width:160px;object-fit:contain}
.sig .ink{font:400 26px 'Great Vibes',cursive;color:var(--p);line-height:1;white-space:nowrap;max-width:165px;overflow:hidden;text-overflow:ellipsis;display:block}
.sig hr{border:0;border-top:1.5px solid #bbb;margin:4px 0}
.sig b{display:block;font-size:12px;color:var(--ink)}
.foot{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;font:500 10.5px 'Montserrat';color:#6b6b6b;border-top:1px solid #e5dfc9;padding-top:6px}
.foot i{color:#7a7a7a}
@media print{body{background:#fff}.bar{display:none}.wrap{padding:0}#stage{transform:none!important}@page{size:297mm 210mm;margin:0}}
</style></head><body>
<div class="bar"><button id="b-pdf">⬇ Download PDF</button><button id="b-png" class="alt">⬇ Download image (PNG)</button><button id="b-print" class="alt">🖨 Print</button></div>
<div class="wrap"><div id="stage"><div id="sheet">
<div class="b1"></div><div class="b2"></div><span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span><div class="wm">NTS</div>
<div class="in">
${o.logo ? `<img class="logo" src="${esc(o.logo)}" alt="">` : ''}
<div class="org">${esc(o.institution || 'NTS Professional Learning')}</div>
<h1>Certificate of ${kind}</h1>
<div class="sub">${o.isInternship ? 'In recognition of successfully completed practical training' : 'In recognition of outstanding performance and successful completion'}</div>
<div class="lead">This certificate is proudly awarded to</div>
<div class="photo">${o.photo ? `<img src="${esc(o.photo)}" alt="">` : `<div>${esc(initials)}</div>`}</div>
<div class="name">${esc(o.studentName || 'Learner')}</div><div class="line"></div>
<div class="for">${o.isInternship ? 'for successfully completing the internship programme' : 'for successfully completing the course'}</div>
<div class="prog">${esc(o.program)}</div>
<div class="where">${esc(o.subtitle || '')}</div>
${o.finalScore != null ? `<div class="pill">✓ Final result: ${esc(o.finalScore)}%</div>` : ''}
${rows.length ? `<div class="marks">${rows.map((r) => `<div><span>${esc(r.label)}</span><b>${esc(r.score)}/${esc(r.max)}</b></div>`).join('')}</div>` : ''}
<div class="bot">
 <div class="qr"><div class="qrbox" id="qr"></div>Scan to verify<br>No: ${esc(o.code)}</div>
 <div class="seal">${o.stamp ? `<img src="${esc(o.stamp)}" alt="">` : 'OFFICIAL<br>SEAL<br>NTS'}</div>
 <div class="sigs">${sigs.map((s) => `<div class="sig"><div class="im">${s.signatureUrl ? `<img src="${esc(s.signatureUrl)}" alt="">` : `<span class="ink">${esc(s.fullName)}</span>`}</div><hr><b>${esc(s.fullName)}</b>${esc(s.title)}</div>`).join('')}</div>
</div>
<div class="foot"><span><b>Date of issue:</b> ${esc(dateFmt(o.issuedAt))}${o.period ? ` &nbsp;·&nbsp; ${esc(o.period)}` : ''}</span><i>Learn • Practice • Excel</i><span><b>Verification No:</b> ${esc(o.code)}</span></div>
</div></div></div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script>
(function(){
  var stage=document.getElementById('stage');
  function fit(){var s=Math.min(1,(window.innerWidth-16)/1123);stage.style.transform='scale('+s+')';stage.style.marginBottom=(-(1-s)*794)+'px';}
  fit();window.addEventListener('resize',fit);
  try{var q=qrcode(0,'M');q.addData(${JSON.stringify(o.verifyUrl)});q.make();document.getElementById('qr').innerHTML=q.createSvgTag(4,0);}catch(e){document.getElementById('qr').textContent='QR';}
  function snap(){var prev=stage.style.transform,mb=stage.style.marginBottom;stage.style.transform='none';stage.style.marginBottom='0';
    return html2canvas(document.getElementById('sheet'),{scale:2,useCORS:true,backgroundColor:'#fffdf6'}).then(function(c){stage.style.transform=prev;stage.style.marginBottom=mb;return c;});}
  function busy(b,on){b.disabled=on;}
  document.getElementById('b-png').onclick=function(){var b=this;busy(b,true);snap().then(function(c){var a=document.createElement('a');a.href=c.toDataURL('image/png');a.download=${JSON.stringify(fileBase)}+'.png';a.click();}).catch(function(){alert('Could not create the image. Use Print > Save as PDF instead.');}).then(function(){busy(b,false);});};
  document.getElementById('b-pdf').onclick=function(){var b=this;busy(b,true);snap().then(function(c){var J=window.jspdf.jsPDF;var pdf=new J({orientation:'landscape',unit:'px',format:[1123,794]});pdf.addImage(c.toDataURL('image/png'),'PNG',0,0,1123,794);pdf.save(${JSON.stringify(fileBase)}+'.pdf');}).catch(function(){alert('Could not create the PDF. Use Print > Save as PDF instead.');}).then(function(){busy(b,false);});};
  document.getElementById('b-print').onclick=function(){window.print();};
  if(location.search.indexOf('autoprint')>-1)setTimeout(function(){window.print();},700);
})();
</script></body></html>`;
}

module.exports = { renderCertificate };
