/* T.B.T.L — génération du ticket 58 mm en PDF (navigateur et Node) */
(function (root) {
  const ENTREPRISE = {
    sigle: 'T.B.T.L',
    nom: 'Touba Bakhdaté Transport Logistique',
    gerant: 'DJILY THIANE',
    tel: 'Tel. 78 161 18 18 - 78 161 17 17',
    lignes: 'Dakar - Touba - Ourossogui - Bakel',
    info: 'Chargement tous les jours',
    adresse: 'Rond-point Pompier, immeuble 4C',
    slogan: 'Votre partenaire de confiance !'
  };

  const pad = n => String(n).padStart(2, '0');
  const fmt = n => String(Math.floor(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const showDate = s => { const d = new Date(s); return isNaN(d) ? '' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  /* Montant en lettres */
  const U = ['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize'];
  const T = ['','dix','vingt','trente','quarante','cinquante','soixante'];
  function b100(n) {
    if (n < 17) return U[n];
    if (n < 20) return 'dix-' + U[n - 10];
    const t = Math.floor(n / 10), r = n % 10;
    if (t === 7 || t === 9) { const base = t === 7 ? 'soixante' : 'quatre-vingt'; return base + (t === 7 && r === 1 ? ' et ' : '-') + b100(10 + r); }
    if (t === 8) return r === 0 ? 'quatre-vingts' : 'quatre-vingt-' + U[r];
    return T[t] + (r === 0 ? '' : r === 1 ? ' et un' : '-' + U[r]);
  }
  function b1000(n, inv) {
    const h = Math.floor(n / 100), r = n % 100; let s = '';
    if (h) s = h === 1 ? 'cent' : U[h] + ' cent' + (r === 0 && !inv ? 's' : '');
    if (r) { let w = b100(r); if (inv && w === 'quatre-vingts') w = 'quatre-vingt'; s += (s ? ' ' : '') + w; }
    return s;
  }
  function lettres(n) {
    n = Math.floor(n); if (!n) return 'zéro';
    const p = [], m = Math.floor(n / 1e6), k = Math.floor((n % 1e6) / 1000), r = n % 1000;
    if (m) p.push(b1000(m) + ' million' + (m > 1 ? 's' : ''));
    if (k) p.push(k === 1 ? 'mille' : b1000(k, true) + ' mille');
    if (r) p.push(b1000(r));
    return p.join(' ');
  }

  /* Mise en page : draw=false sert à mesurer la hauteur */
  function layout(doc, r, draw) {
    const W = 58, M = 3, CW = W - 2 * M; let y = 4;
    const lh = size => size * 0.3528 * 1.3;
    const font = (size, style) => { doc.setFont('helvetica', style || 'normal'); doc.setFontSize(size); };
    const center = (txt, size, style) => {
      font(size, style);
      doc.splitTextToSize(txt, CW).forEach(l => { if (draw) doc.text(l, W / 2, y + lh(size) * 0.75, { align: 'center' }); y += lh(size); });
    };
    const dash = () => { y += 1.2; if (draw) { doc.setLineDashPattern([0.8, 0.8], 0); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); doc.setLineDashPattern([], 0); } y += 1.8; };
    const pair = (label, value, size, style) => {
      font(size, 'normal'); const lw = 19;
      font(size, style || 'bold');
      const lines = doc.splitTextToSize(String(value || '-'), CW - lw);
      lines.forEach((l, i) => {
        if (draw) {
          if (i === 0) { font(size, 'normal'); doc.text(label, M, y + lh(size) * 0.75); font(size, style || 'bold'); }
          doc.text(l, W - M, y + lh(size) * 0.75, { align: 'right' });
        }
        y += lh(size);
      });
    };

    // Logo de l'entreprise (image ronde), sinon camion dessiné
    const logo = root.TBTB_LOGO;
    if (logo) {
      if (draw) { try { doc.addImage(logo, 'JPEG', W / 2 - 10, y, 20, 20, undefined, 'FAST'); } catch (e) {} }
      y += 22;
    } else if (draw) {
      doc.setFillColor(0, 0, 0);
      const x = W / 2 - 9, t = y;
      doc.rect(x, t, 11, 6.5, 'F');
      doc.lines([[3.5, 0], [2.6, 2.6], [0, 3.9], [-6.1, 0]], x + 11.6, t + 1.6, [1, 1], 'F', true);
      doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.5);
      doc.circle(x + 3, t + 7, 1.6, 'FD'); doc.circle(x + 14.5, t + 7, 1.6, 'FD');
      doc.setDrawColor(0, 0, 0);
    }
    if (!logo) y += 10;
    center(ENTREPRISE.sigle, 18, 'bold');
    center(ENTREPRISE.nom, 7.5);
    center(ENTREPRISE.gerant, 10, 'bold');
    center(ENTREPRISE.tel, 7);
    center(ENTREPRISE.lignes, 7);
    center(ENTREPRISE.info, 7);
    center(ENTREPRISE.adresse, 7);
    dash();
    center('REÇU DE TRANSPORT', 11, 'bold');
    y += 1;
    pair('N°', r.num, 8);
    pair('Date', showDate(r.date), 8);
    dash();
    pair('Nom', r.nom, 9);
    pair('Destination', r.dest, 9);
    pair('Tél. dest.', r.tel, 9);
    pair('Colis', r.colis, 9);
    dash();
    pair('Somme', fmt(r.somme) + ' F CFA', 11, 'bold');
    if (r.somme) { y += 0.8; font(7, 'italic'); doc.splitTextToSize('Arrêté à la somme de ' + lettres(r.somme) + ' francs CFA.', CW).forEach(l => { if (draw) doc.text(l, M, y + lh(7) * 0.75); y += lh(7); }); }
    dash();
    y += 1;
    center(ENTREPRISE.slogan, 7, 'bold');
    center('Merci de votre confiance.', 7);
    center('Conservez ce reçu pour retirer vos colis.', 7);
    return y + 4;
  }

  function ticketPDF(jsPDF, r) {
    const tmp = new jsPDF({ unit: 'mm', format: [58, 400], orientation: 'portrait' });
    const h = Math.max(90, layout(tmp, r, false));
    const doc = new jsPDF({ unit: 'mm', format: [58, h], orientation: 'portrait' });
    doc.setProperties({ title: 'Reçu ' + r.num, author: ENTREPRISE.nom });
    layout(doc, r, true);
    return doc;
  }

  const api = { ENTREPRISE, ticketPDF, lettres, fmt, showDate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TBTB = api;
})(typeof window !== 'undefined' ? window : globalThis);
