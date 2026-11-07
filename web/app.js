/* Caisse T.B.T.L — logique de l'application
   Mode téléphone : le reçu est généré en PDF (partage / téléchargement).
   Mode TPE : l'appli Android expose window.Android.printReceipt → RawBT imprime le ticket. */
const $ = id => document.getElementById(id);
const { fmt, showDate, lettres, ticketPDF } = window.TBTB;
const KEY = 'tbtb_recus_v1';
const pad = n => String(n).padStart(2, '0');
const toLocalInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Téléphone sénégalais : 9 chiffres, +221 facultatif → « 77 123 45 67 » */
const telDigits = s => { let d = String(s).replace(/\D/g, ''); if (d.startsWith('221') && d.length > 9) d = d.slice(3); return d.slice(0, 9); };
const telFmt = s => { const d = telDigits(s); return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' '); };

/* Détection du pont Android (RawBT via WebView) */
const ANDROID_PRINT = !!(window.Android && typeof window.Android.printReceipt === 'function');

$('mode').textContent = ANDROID_PRINT ? 'Impression TPE (RawBT)' : 'Reçus en PDF';
$('btn-submit').textContent = ANDROID_PRINT ? 'Valider et imprimer' : 'Valider et créer le PDF';

/* Stockage local (sur l'appareil) */
function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(v)) return v; } catch (e) {} return []; }
let recus = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(recus)); } catch (e) {} }
function nextNum() { const max = recus.reduce((m, r) => Math.max(m, parseInt(r.num.split('-')[1]) || 0), 0); return 'TBTB-' + String(max + 1).padStart(6, '0'); }

/* Aperçu écran */
const truck = `<svg viewBox="0 0 64 36" aria-hidden="true"><rect x="1" y="4" width="38" height="22" fill="#111"/><path d="M41 10h12l9 9v7H41z" fill="#111"/><rect x="45" y="13" width="7" height="6" fill="#fff"/><circle cx="12" cy="29" r="5" fill="#111" stroke="#fff" stroke-width="2"/><circle cx="51" cy="29" r="5" fill="#111" stroke="#fff" stroke-width="2"/></svg>`;
function ticketHTML(r) {
  const E = window.TBTB.ENTREPRISE, s = Number(r.somme) || 0;
  return `<div class="t-c"><div class="t-logo">${window.TBTB_LOGO ? `<img class="t-img" src="${window.TBTB_LOGO}" alt="">` : truck}</div><div class="t-name">${E.sigle}</div>
    <div class="t-sub">${E.nom}</div><div class="t-djily">${E.gerant}</div>
    <div class="t-sub">${E.tel}</div><div class="t-sub">${E.lignes}</div><div class="t-sub">${E.info}</div><div class="t-sub">${E.adresse}</div></div>
  <hr class="t-hr"><div class="t-c t-title">Reçu de transport</div>
  <div class="t-line"><span>N°</span><b>${esc(r.num)}</b></div>
  <div class="t-line"><span>Date</span><b>${esc(showDate(r.date))}</b></div><hr class="t-hr">
  <div class="t-line"><span>Nom</span><b>${esc(r.nom || '—')}</b></div>
  <div class="t-line"><span>Destination</span><b>${esc(r.dest || '—')}</b></div>
  <div class="t-line"><span>Tél. dest.</span><b>${esc(r.tel || '—')}</b></div>
  <div class="t-line"><span>Colis</span><b>${esc(r.colis || '—')}</b></div><hr class="t-hr">
  <div class="t-line t-total"><span>Somme</span><b>${fmt(s)} F CFA</b></div>
  ${s ? `<div class="t-words">Arrêté à la somme de ${lettres(s)} francs CFA.</div>` : ''}
  <div class="t-c t-foot"><b>${E.slogan}</b><br>Merci de votre confiance.<br>Conservez ce reçu pour retirer vos colis.</div>`;
}
function current() {
  return { num: $('f-num').value, date: $('f-date').value, nom: $('f-nom').value.trim(), dest: $('f-dest').value.trim(), tel: telFmt($('f-tel').value), colis: $('f-colis').value.trim(),
    somme: parseInt($('f-somme').value.replace(/\D/g, '')) || 0 };
}
function render() {
  const r = current(); $('ticket').innerHTML = ticketHTML(r);
  $('f-words').textContent = r.somme ? lettres(r.somme) + ' francs CFA' : '';
}

/* === TEXTE BRUT POUR L'IMPRIMANTE THERMIQUE (32 colonnes) === */
function ticketText(r) {
  const E = window.TBTB.ENTREPRISE, s = Number(r.somme) || 0;
  const L = '--------------------------------';
  const line = (label, value) => {
    const left = String(label);
    const right = String(value || '—');
    const spaces = Math.max(1, 32 - left.length - right.length);
    return left + ' '.repeat(spaces) + right + '\n';
  };
  let t = '';
  t += '        ' + E.sigle + '\n';
  t += E.nom + '\n';
  t += E.gerant + '\n';
  t += E.tel + '\n';
  t += E.lignes + '\n';
  t += E.info + '\n';
  t += E.adresse + '\n';
  t += L + '\n';
  t += '     Reçu de transport\n';
  t += L + '\n';
  t += line('N°', r.num);
  t += line('Date', showDate(r.date));
  t += L + '\n';
  t += line('Nom', r.nom);
  t += line('Destination', r.dest);
  t += line('Tél. dest.', r.tel);
  t += line('Colis', r.colis);
  t += L + '\n';
  t += line('Somme', fmt(s) + ' F CFA');
  if (s) t += '\nArrêté à la somme de ' + lettres(s) + ' francs CFA.\n';
  t += L + '\n';
  t += '   ' + E.slogan + '\n';
  t += 'Merci de votre confiance.\n';
  t += 'Conservez ce reçu pour retirer vos colis.\n\n\n';
  return t;
}

/* Sortie : RawBT (TPE) ou PDF (téléphone) */
const payload = r => JSON.stringify(Object.assign({}, r, { entreprise: window.TBTB.ENTREPRISE, dateTxt: showDate(r.date), sommeTxt: fmt(r.somme), lettres: lettres(r.somme) }));
let lastUrl = null, lastFile = null;
function makePDF(r) {
  const doc = ticketPDF(window.jspdf.jsPDF, r);
  const blob = doc.output('blob');
  const name = `Recu-${r.num}.pdf`;
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = URL.createObjectURL(blob);
  lastFile = new File([blob], name, { type: 'application/pdf' });
  $('btn-dl').href = lastUrl; $('btn-dl').download = name;
  const canShare = navigator.canShare && navigator.canShare({ files: [lastFile] });
  $('btn-share').hidden = !canShare;
}

/* Impression via RawBT (pont Android).
   - Android.printRaw (appli récente) : ticket en image ESC/POS, comme l'aperçu, avec logo.
   - Android.printReceipt seul (ancienne appli) : TEXTE uniquement. Ce pont encode l'URL et RawBT
     imprimerait alors le base64 comme du texte (ticket sans fin) : ne jamais lui passer d'image. */
async function printViaRawBT(r) {
  if (typeof window.Android.printRaw === 'function') {
    let img = null;
    try { img = await window.TBTB.ticketEscPos(r); } catch (e) {}
    if (img) { window.Android.printRaw('base64,' + img); return; }
  }
  window.Android.printReceipt(ticketText(r));
}

function output(r) {
  if (ANDROID_PRINT) {
    printViaRawBT(r).catch(e => { const m = $('msg'); m.className = 'msg err'; m.textContent = `Reçu ${r.num} enregistré, mais l'impression a échoué : ${e}`; m.hidden = false; });
    return `Reçu ${r.num} envoyé à l'imprimante.`;
  }
  lastRecu = r; makePDF(r); return `Reçu ${r.num} prêt : imprimez-le ou partagez le PDF.`;
}

function printTicket(r) {
  if (ANDROID_PRINT) {
    printViaRawBT(r);
    return;
  }
  $('print-area').innerHTML = '<div class="ticket">' + ticketHTML(r) + '</div>';
  setTimeout(() => window.print(), 50);
}

let lastRecu = null;
$('btn-print').onclick = () => { if (lastRecu) printTicket(lastRecu); };
$('btn-share').onclick = async () => {
  if (!lastFile) return;
  try { await navigator.share({ files: [lastFile], title: lastFile.name }); } catch (e) {}
};

/* Formulaire */
function resetForm() {
  $('f-num').value = nextNum(); $('f-date').value = toLocalInput(new Date());
  $('f-nom').value = ''; $('f-dest').value = ''; $('f-tel').value = ''; $('f-colis').value = ''; $('f-somme').value = '';
  $('msg').hidden = true; $('done').hidden = true; render(); $('f-nom').focus();
}
['f-date', 'f-nom', 'f-dest', 'f-colis'].forEach(id => $(id).addEventListener('input', render));
$('f-tel').addEventListener('input', e => { e.target.value = telFmt(e.target.value); render(); });
$('f-somme').addEventListener('input', e => { const n = e.target.value.replace(/\D/g, ''); e.target.value = n ? fmt(n) : ''; render(); });
$('reset').onclick = resetForm;
$('form').addEventListener('submit', e => {
  e.preventDefault(); const r = current(), m = $('msg');
  const missing = []; if (!r.nom) missing.push('le nom'); if (!r.dest) missing.push('la destination'); if (telDigits(r.tel).length !== 9) missing.push('le téléphone du destinataire (9 chiffres)'); if (!r.colis) missing.push('les colis'); if (!r.somme) missing.push('la somme');
  if (missing.length) { m.className = 'msg err'; m.textContent = 'Renseignez ' + missing.join(', ') + ' avant de valider.'; m.hidden = false; return; }
  if (recus.some(x => x.num === r.num)) { m.className = 'msg err'; m.textContent = 'Ce reçu est déjà enregistré. Appuyez sur « Nouveau ».'; m.hidden = false; return; }
  m.hidden = true;
  recus.unshift(r); save(); renderHist();
  $('done-text').textContent = output(r);
  $('done').hidden = ANDROID_PRINT;
  if (ANDROID_PRINT) { m.className = 'msg ok'; m.textContent = $('done-text').textContent; m.hidden = false; }
});

/* Historique */
function renderHist() {
  const today = new Date().toDateString();
  const t = recus.filter(r => new Date(r.date).toDateString() === today);
  $('s-count').textContent = t.length;
  $('s-total').textContent = fmt(t.reduce((s, r) => s + r.somme, 0)) + ' F';
  $('s-colis').textContent = t.reduce((s, r) => s + (parseInt(r.colis) || 0), 0);
  $('h-body').innerHTML = recus.length ? recus.map((r, i) => `<tr><td>${esc(r.num)}</td><td>${esc(showDate(r.date))}</td><td>${esc(r.nom)}</td><td>${esc(r.dest || '')}</td><td>${esc(r.tel || '')}</td><td>${esc(r.colis)}</td><td class="num">${fmt(r.somme)} F</td><td style="white-space:nowrap">${ANDROID_PRINT ? `<button class="mini" data-i="${i}" data-a="print">Réimprimer</button>` : `<button class="mini" data-i="${i}" data-a="print">Imprimer</button> <button class="mini" data-i="${i}" data-a="pdf">PDF</button>`}</td></tr>`).join('')
    : '<tr><td colspan="8" style="color:var(--muted)">Aucun reçu pour l\'instant. Les reçus validés apparaîtront ici.</td></tr>';
  renderGroupe();
}
/* Regroupement par client : tous les reçus d'un même nom, imprimés sur un seul relevé.
   Les noms sont comparés sans majuscules, accents ni espaces en trop (« Diop » = « diop »). */
const normNom = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
function groupe() {
  const key = normNom($('g-nom').value); if (!key) return null;
  const today = new Date().toDateString();
  const items = recus.filter(r => normNom(r.nom) === key && ($('g-per').value === 'all' || new Date(r.date).toDateString() === today))
    .slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  if (!items.length) return { items };
  const d = r => showDate(r.date).slice(0, 10), from = d(items[0]), to = d(items[items.length - 1]);
  return { nom: items[items.length - 1].nom, items, periode: from === to ? from : `${from} au ${to}`,
    colis: items.reduce((s, r) => s + (parseInt(r.colis) || 0), 0), somme: items.reduce((s, r) => s + (Number(r.somme) || 0), 0) };
}
function renderGroupe() {
  const names = new Map(); recus.forEach(r => { const k = normNom(r.nom); if (k && !names.has(k)) names.set(k, r.nom); });
  $('clients').innerHTML = [...names.values()].map(n => `<option value="${esc(n)}">`).join('');
  const g = groupe(), s = $('g-sum');
  if (!g) { s.className = 'msg'; s.textContent = 'Choisissez un client pour voir ses reçus.'; }
  else if (!g.items.length) { s.className = 'msg err'; s.textContent = $('g-per').value === 'day' ? 'Aucun reçu à ce nom aujourd\'hui. Essayez « Tout l\'historique ».' : 'Aucun reçu à ce nom.'; }
  else { s.className = 'msg ok'; s.textContent = `${g.items.length} reçu${g.items.length > 1 ? 's' : ''} · ${g.colis} colis · ${fmt(g.somme)} F CFA (${g.items.map(r => r.num).join(', ')})`; }
  $('g-print').disabled = !(g && g.items.length);
}
function releveText(g) {
  const E = window.TBTB.ENTREPRISE, L = '--------------------------------';
  const line = (a, b) => { a = String(a); b = String(b || '—'); return a + ' '.repeat(Math.max(1, 32 - a.length - b.length)) + b + '\n'; };
  let t = `        ${E.sigle}\n${E.nom}\n${E.gerant}\n${E.tel}\n${L}\n      RELEVE CLIENT\n${L}\n`;
  t += line('Nom', g.nom) + line('Période', g.periode) + line('Reçus', g.items.length) + L + '\n';
  g.items.forEach(r => { t += line(r.num, fmt(r.somme) + ' F') + `${showDate(r.date)} ${r.dest || ''} ${r.colis || ''}\n`; });
  t += L + '\n' + line('Total colis', g.colis) + line('Total', fmt(g.somme) + ' F CFA');
  t += `\nArrêté à la somme de ${lettres(g.somme)} francs CFA.\n${L}\n   ${E.slogan}\nMerci de votre confiance.\n\n\n`;
  return t;
}
function releveHTML(g) {
  const E = window.TBTB.ENTREPRISE;
  return `<div class="t-c"><div class="t-logo">${window.TBTB_LOGO ? `<img class="t-img" src="${window.TBTB_LOGO}" alt="">` : truck}</div><div class="t-name">${E.sigle}</div>
    <div class="t-sub">${E.nom}</div><div class="t-djily">${E.gerant}</div><div class="t-sub">${E.tel}</div><div class="t-sub">${E.lignes}</div><div class="t-sub">${E.adresse}</div></div>
  <hr class="t-hr"><div class="t-c t-title">Relevé client</div>
  <div class="t-line"><span>Nom</span><b>${esc(g.nom)}</b></div><div class="t-line"><span>Période</span><b>${esc(g.periode)}</b></div>
  <div class="t-line"><span>Reçus</span><b>${g.items.length}</b></div><hr class="t-hr">
  ${g.items.map(r => `<div class="t-line"><b>${esc(r.num)}</b><b>${fmt(r.somme)} F</b></div><div class="t-sub">${esc(showDate(r.date))} · ${esc(r.dest || '—')} · ${esc(r.colis || '—')}</div>`).join('<div style="height:4px"></div>')}
  <hr class="t-hr"><div class="t-line"><span>Total colis</span><b>${g.colis}</b></div>
  <div class="t-line t-total"><span>Total</span><b>${fmt(g.somme)} F CFA</b></div>
  <div class="t-words">Arrêté à la somme de ${lettres(g.somme)} francs CFA.</div>
  <div class="t-c t-foot"><b>${E.slogan}</b><br>Merci de votre confiance.</div>`;
}
async function printReleve(g) {
  if (ANDROID_PRINT) {
    if (typeof window.Android.printRaw === 'function') {
      let img = null; try { img = await window.TBTB.releveEscPos(g); } catch (e) {}
      if (img) { window.Android.printRaw('base64,' + img); return; }
    }
    window.Android.printReceipt(releveText(g)); return;
  }
  $('print-area').innerHTML = '<div class="ticket">' + releveHTML(g) + '</div>';
  setTimeout(() => window.print(), 50);
}
$('g-nom').addEventListener('input', renderGroupe);
$('g-per').addEventListener('change', renderGroupe);
$('g-print').onclick = () => { const g = groupe(); if (g && g.items.length) printReleve(g); };

$('h-body').addEventListener('click', async e => {
  const b = e.target.closest('button[data-i]'); if (!b) return;
  const r = recus[+b.dataset.i];
  if (ANDROID_PRINT) { printViaRawBT(r); return; }
  if (b.dataset.a === 'print') { printTicket(r); return; }
  makePDF(r);
  if (navigator.canShare && navigator.canShare({ files: [lastFile] })) { try { await navigator.share({ files: [lastFile], title: lastFile.name }); return; } catch (err) { return; } }
  const a = document.createElement('a'); a.href = lastUrl; a.download = lastFile.name; document.body.appendChild(a); a.click(); a.remove();
});

/* Onglets */
function tab(which) {
  const isNew = which === 'new';
  $('tab-new').setAttribute('aria-selected', isNew); $('tab-hist').setAttribute('aria-selected', !isNew);
  $('view-new').hidden = !isNew; $('view-hist').hidden = isNew;
  if (!isNew) renderHist();
}
$('tab-new').onclick = () => tab('new'); $('tab-hist').onclick = () => tab('hist');

/* Installation hors ligne (téléphone) */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

/* Logo en mémoire (data URL) pour l'aperçu, le PDF et l'impression */
fetch('assets/logo-ticket.jpg').then(r => r.ok ? r.blob() : null).then(b => {
  if (!b) return; const fr = new FileReader();
  fr.onload = () => { window.TBTB_LOGO = fr.result; render(); }; fr.readAsDataURL(b);
}).catch(() => {});

resetForm(); renderHist();