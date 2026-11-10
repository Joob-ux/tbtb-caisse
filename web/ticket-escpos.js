/* Ticket thermique 58 mm en image (384 points) : même mise en page que l'aperçu écran,
   logo compris. Le canvas est converti en noir et blanc (logo tramé) puis en commandes
   ESC/POS raster (GS v 0), envoyées à RawBT sous la forme « base64,… ».
   Deux modèles : le reçu (ticketCanvas) et le relevé groupé d'un client (releveCanvas). */
(function () {
  const W = 384;             // largeur de la tête d'impression (58 mm à 203 dpi)
  const M = 8;               // marge gauche/droite en points
  const CW = W - 2 * M;      // largeur utile
  const K = CW / 232;        // échelle aperçu (232 px de contenu) → points imprimante
  const px = v => Math.round(v * K);

  const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  const DISP = '"Barlow Condensed", "Arial Narrow", sans-serif';

  function loadImg(src) {
    return new Promise(res => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  }

  /* Coupe un texte en lignes qui tiennent dans maxW (coupe aussi les mots trop longs). */
  function wrap(ctx, text, maxW) {
    const out = []; let line = '';
    for (const word of String(text).split(/\s+/).filter(Boolean)) {
      const t = line ? line + ' ' + word : word;
      if (ctx.measureText(t).width <= maxW) { line = t; continue; }
      if (line) out.push(line);
      let w = word;
      while (ctx.measureText(w).width > maxW && w.length > 1) {
        let n = w.length; while (n > 1 && ctx.measureText(w.slice(0, n)).width > maxW) n--;
        out.push(w.slice(0, n)); w = w.slice(n);
      }
      line = w;
    }
    if (line) out.push(line);
    return out.length ? out : [''];
  }

  /* Tramage Floyd–Steinberg (pour le logo) : résultat en noir/blanc pur. */
  function dither(ctx, w, h) {
    const img = ctx.getImageData(0, 0, w, h), d = img.data, g = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    for (let yy = 0; yy < h; yy++) for (let x = 0; x < w; x++) {
      const i = yy * w + x, o = g[i], n = o < 128 ? 0 : 255, e = o - n; g[i] = n;
      if (x + 1 < w) g[i + 1] += e * 7 / 16;
      if (yy + 1 < h) { if (x > 0) g[i + w - 1] += e * 3 / 16; g[i + w] += e * 5 / 16; if (x + 1 < w) g[i + w + 1] += e / 16; }
    }
    for (let i = 0; i < w * h; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g[i]; d[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
  }

  /* Dessine en-tête + corps (body) + pied, et renvoie le canvas recadré à la hauteur utile. */
  async function draw(title, body) {
    const { ENTREPRISE: E } = window.TBTB;
    try { if (document.fonts) { await Promise.race([document.fonts.ready, new Promise(ok => setTimeout(ok, 1500))]); } } catch (e) {}
    const logo = await loadImg(window.TBTB_LOGO);

    const c = document.createElement('canvas'); c.width = W; c.height = 12000;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, c.height); ctx.fillStyle = '#000'; ctx.textBaseline = 'alphabetic';
    const t = { ctx, y: px(4) };
    const font = (size, weight, fam, style) => { ctx.font = `${style || ''} ${weight} ${px(size)}px ${fam}`; };
    const spacing = em => { if ('letterSpacing' in ctx) ctx.letterSpacing = em ? Math.round(em * parseFloat(ctx.font.match(/(\d+)px/)[1])) + 'px' : '0px'; };
    t.center = (text, size, weight, fam, lh, em) => {
      font(size, weight, fam || MONO); spacing(em || 0); ctx.textAlign = 'center';
      for (const l of wrap(ctx, text, CW)) { const h = px(size * (lh || 1.4)); t.y += h; ctx.fillText(l, W / 2, t.y - (h - px(size)) / 2 - px(size) * 0.18); }
      spacing(0);
    };
    t.hr = () => { t.y += px(8); for (let x = M; x < W - M; x += 10) ctx.fillRect(x, t.y, 6, 2); t.y += 2 + px(8); };
    t.gap = v => { t.y += px(v); };
    /* Libellé à gauche, valeur à droite (en gras par défaut), valeur coupée sur plusieurs lignes si besoin. */
    t.pair = (label, value, size, weight, vWeight) => {
      const sz = size || 11.5, h = px(sz * 1.4);
      font(sz, weight || 400, MONO); ctx.textAlign = 'left';
      const lw = ctx.measureText(label).width;
      font(sz, vWeight || 600, MONO);
      const lines = wrap(ctx, value || '—', CW - lw - px(8));
      font(sz, weight || 400, MONO); ctx.fillText(label, M, t.y + h - px(sz) * 0.4);
      font(sz, vWeight || 600, MONO); ctx.textAlign = 'right';
      lines.forEach((l, i) => ctx.fillText(l, W - M, t.y + h * (i + 1) - px(sz) * 0.4));
      t.y += h * lines.length;
    };
    t.para = (text, size, weight, style) => {
      font(size, weight || 400, MONO, style); ctx.textAlign = 'left';
      const h = px(size * 1.4);
      for (const l of wrap(ctx, text, CW)) { t.y += h; ctx.fillText(l, M, t.y - px(size) * 0.4); }
    };

    // En-tête
    if (logo) {
      const d = px(84), x0 = (W - d) / 2;
      const lc = document.createElement('canvas'); lc.width = d; lc.height = d;
      const l = lc.getContext('2d');
      l.fillStyle = '#fff'; l.fillRect(0, 0, d, d);
      l.save(); l.beginPath(); l.arc(d / 2, d / 2, d / 2, 0, Math.PI * 2); l.clip();
      const sw = Math.min(logo.width, logo.height);
      l.drawImage(logo, (logo.width - sw) / 2, (logo.height - sw) / 2, sw, sw, 0, 0, d, d); l.restore();
      dither(l, d, d);
      ctx.drawImage(lc, x0, t.y); t.y += d + px(2);
    }
    t.center(E.sigle, 26, 800, DISP, 1.05, 0.12);
    t.center(E.nom, 10, 400, MONO, 1.4, 0.02);
    t.gap(2); t.center(E.gerant, 16, 800, DISP, 1.15, 0.08);
    t.center(E.tel, 10, 400, MONO, 1.4, 0.02);
    t.center(E.lignes, 10, 400, MONO, 1.4, 0.02);
    t.center(E.info, 10, 400, MONO, 1.4, 0.02);
    t.center(E.adresse, 10, 400, MONO, 1.4, 0.02);
    t.hr();
    t.center(title, 17, 800, DISP, 1.25, 0.1);

    body(t);

    t.gap(10);
    t.center(E.slogan, 9.5, 600, MONO, 1.4);
    t.center('Merci de votre confiance.', 9.5, 400, MONO, 1.4);
    t.center('Conservez ce reçu pour retirer vos colis.', 9.5, 400, MONO, 1.4);
    t.gap(6);

    const out = document.createElement('canvas'); out.width = W; out.height = Math.ceil(t.y);
    out.getContext('2d').drawImage(c, 0, 0);
    return out;
  }

  function ticketCanvas(r) {
    const { fmt, showDate, lettres } = window.TBTB, s = Number(r.somme) || 0;
    return draw('REÇU DE TRANSPORT', t => {
      const d = showDate(r.date);
      t.pair('N°', r.num);
      if (d) t.pair('Date', d);
      t.hr();
      t.pair('Nom', r.nom);
      if (r.dest) t.pair('Destination', r.dest);
      if (r.tel) t.pair('Tél. dest.', r.tel);
      t.gap(4); t.pair('Colis', r.colis, 15, 600, 700);   // colis plus gros, comme la somme
      if (s) {
        t.hr();
        t.gap(4); t.pair('Somme', fmt(s) + ' F CFA', 15, 600);
        t.gap(4); t.para(`Arrêté à la somme de ${lettres(s)} francs CFA.`, 10, 400, 'italic');
      }
    });
  }

  /* Relevé groupé : g = { nom, periode, items: [reçus], colis, somme } */
  function releveCanvas(g) {
    const { fmt, showDate, lettres } = window.TBTB;
    return draw(g.titre || 'RELEVÉ CLIENT', t => {
      (g.entete || [['Nom', g.nom]]).forEach(([a, b]) => t.pair(a, b));
      t.pair('Période', g.periode);
      t.pair('Reçus', String(g.items.length));
      t.hr();
      g.items.forEach((r, i) => {
        if (i) t.gap(5);
        t.pair(r.num, fmt(r.somme) + ' F', 11.5, 600, 600);
        t.para([showDate(r.date), g.liste ? r.nom : '', r.dest, r.colis].filter(Boolean).join(' · '), 10);
      });
      t.hr();
      t.pair('Total colis', String(g.colis));
      t.gap(4); t.pair('Total', fmt(g.somme) + ' F CFA', 15, 600);
      if (g.somme) { t.gap(4); t.para(`Arrêté à la somme de ${lettres(g.somme)} francs CFA.`, 10, 400, 'italic'); }
    });
  }

  /* Canvas → ESC/POS raster, par bandes de 128 lignes (évite de saturer le tampon). */
  function canvasToEscPos(cv) {
    const w = cv.width, h = cv.height, bpr = w >> 3;
    const d = cv.getContext('2d').getImageData(0, 0, w, h).data;
    const bytes = [0x1B, 0x40, 0x1B, 0x61, 0x00];
    for (let y0 = 0; y0 < h; y0 += 128) {
      const bh = Math.min(128, h - y0);
      bytes.push(0x1D, 0x76, 0x30, 0x00, bpr & 255, bpr >> 8, bh & 255, bh >> 8);
      for (let y = y0; y < y0 + bh; y++) for (let xb = 0; xb < bpr; xb++) {
        let b = 0;
        for (let k = 0; k < 8; k++) { const i = (y * w + xb * 8 + k) * 4; if (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 < 150) b |= 0x80 >> k; }
        bytes.push(b);
      }
    }
    bytes.push(0x1B, 0x64, 0x04);  // avance de 4 lignes pour détacher le ticket
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.slice(i, i + 0x8000));
    return btoa(bin);
  }

  window.TBTB.ticketCanvas = ticketCanvas;
  window.TBTB.releveCanvas = releveCanvas;
  window.TBTB.ticketEscPos = async r => canvasToEscPos(await ticketCanvas(r));
  window.TBTB.releveEscPos = async g => canvasToEscPos(await releveCanvas(g));
})();
