/* Suivi à distance : envoie les reçus de cette caisse au serveur de suivi (tbtb-suivi sur Render), en temps réel.
   Aucun mot de passe sur la caisse : au premier lancement, la caisse crée sa propre clé secrète et demande
   l'autorisation ; le gérant touche « Autoriser » une seule fois sur sa page de suivi.
   Ensuite chaque reçu part quelques secondes après sa validation (s'il n'y a pas internet, il attend et
   part dès que la connexion revient). Les caisses déjà connectées avec email + mot de passe continuent de marcher. */
(function () {
  const K_RECUS = 'tbtb_recus_v1', K_JETON = 'tbtb_suivi_jeton', K_OK = 'tbtb_suivi_envoyes', K_APP = 'tbtb_appareil',
    K_DEL = 'tbtb_suivi_supprimes', K_CLE = 'tbtb_caisse_cle', K_STATUT = 'tbtb_caisse_statut', K_ACTIF = 'tbtb_suivi_actif';
  const $ = id => document.getElementById(id);
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  const SUIVI_URL = get('tbtb_suivi_url') || 'https://tbtb-suivi-g2vd.onrender.com';   // tbtb_suivi_url : seulement pour les essais

  /* Identifiant et clé secrète de cet appareil (créés une seule fois, gardés sur l'appareil) */
  const alea = n => { const b = new Uint8Array(n); crypto.getRandomValues(b); return Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); };
  let appareil = get(K_APP);
  if (!appareil) { appareil = 'caisse-' + alea(4); set(K_APP, appareil); }
  let cle = get(K_CLE);
  if (!cle) { cle = alea(32); set(K_CLE, cle); }
  const modele = (navigator.userAgent.match(/;\s*([^;()]+?)\s+Build\//) || [])[1];
  const nomAppareil = (modele ? modele + ' ' : 'Caisse ') + appareil.slice(-4);

  const statut = () => get(K_STATUT) || '';            // '', 'attente', 'autorisee', 'refusee'
  const autorisee = () => statut() === 'autorisee';
  const actif = () => autorisee() || !!get(K_JETON);   // la caisse peut envoyer
  const majActif = () => set(K_ACTIF, actif() ? '1' : null);

  const recus = () => { try { const v = JSON.parse(get(K_RECUS)); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const envoyes = () => { try { return new Set(JSON.parse(get(K_OK)) || []); } catch (e) { return new Set(); } };
  const attente = () => { const ok = envoyes(); return recus().filter(r => r && r.num && !ok.has(r.num)); };
  /* Reçus supprimés de la caisse, à retirer aussi du suivi */
  const aSupprimer = () => { try { const v = JSON.parse(get(K_DEL)); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  window.TBTB_SUIVI = {
    supprimer(nums) {
      const ok = envoyes(), l = new Set(aSupprimer());
      nums.forEach(n => { if (ok.has(n)) l.add(n); });
      set(K_DEL, JSON.stringify([...l])); setTimeout(push, 300);
    }
  };

  let busy = false, lastErr = '', lastOk = null, lastTry = 0;

  async function call(path, body) {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 70000);  // le serveur gratuit peut mettre ~1 min à se réveiller
    try {
      const jeton = get(K_JETON);
      const h = { 'Content-Type': 'application/json' };
      if (autorisee()) h.Authorization = 'Caisse ' + appareil + ':' + cle;
      else if (jeton) h.Authorization = 'Bearer ' + jeton;
      const r = await fetch(SUIVI_URL + path, { method: 'POST', signal: ctl.signal, headers: h, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (path !== '/api/caisses/demande') {
        if (r.status === 401) { if (autorisee()) set(K_STATUT, null); else set(K_JETON, null); majActif(); }
        if (r.status === 403 && d.statut) { set(K_STATUT, d.statut); majActif(); }
      }
      if (!r.ok) throw new Error(d.erreur || 'Erreur ' + r.status);
      return d;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('le serveur ne répond pas');
      if (e instanceof TypeError) throw new Error('pas de connexion internet');
      throw e;
    } finally { clearTimeout(tm); }
  }

  /* Demande (ou vérifie) l'autorisation de cette caisse auprès du suivi */
  async function demander() {
    const d = await call('/api/caisses/demande', { appareil, cle, nom: nomAppareil });
    set(K_STATUT, d.statut); majActif();
  }

  async function push() {
    if (busy) return;
    busy = true; lastTry = Date.now(); ui();
    try {
      if (!autorisee() && !get(K_JETON)) await demander();
      if (actif()) {
        const list = attente(), dels = aSupprimer();
        for (let i = 0; i < list.length; i += 100) {
          const d = await call('/api/recus', { appareil, recus: list.slice(i, i + 100) });
          const ok = envoyes(); (d.ok || []).forEach(n => ok.add(n)); set(K_OK, JSON.stringify([...ok]));
        }
        for (let i = 0; i < dels.length; i += 200) {
          const part = dels.slice(i, i + 200);
          await call('/api/recus/supprimer', { appareil, nums: part });
          const reste = new Set(aSupprimer()); part.forEach(n => reste.delete(n)); set(K_DEL, JSON.stringify([...reste]));
        }
        if (list.length || dels.length) lastOk = new Date();
      }
      lastErr = '';
    } catch (e) { lastErr = e.message; }
    busy = false; ui();
  }

  /* Toutes les 10 s : envoie ce qui attend ; en attente d'autorisation, vérifie si le gérant a autorisé.
     Après une erreur (pas d'internet…), nouvel essai au bout d'une minute. */
  function tick() {
    if (lastErr && Date.now() - lastTry < 60000) return;
    if (!actif() || attente().length || aSupprimer().length) push();
  }

  function ui() {
    const e = $('sy-etat'); if (!e) return;
    if ($('sy-form')) $('sy-form').hidden = true;
    if ($('sy-out')) $('sy-out').hidden = true;
    if ($('sy-actions')) $('sy-actions').hidden = !actif();
    const n = attente().length, nd = aSupprimer().length;
    if (!actif()) {
      const st = statut();
      e.className = 'msg' + (st === 'refusee' || lastErr ? ' err' : '');
      e.textContent = st === 'refusee' ? 'Cette caisse a été retirée du suivi par le gérant. Elle peut être autorisée de nouveau depuis la page de suivi (Compte → Caisses).'
        : st === 'attente' ? `Caisse « ${nomAppareil} » en attente d'autorisation. Sur le téléphone du gérant, ouvrez le suivi et touchez « Autoriser ». Les reçus partiront tout seuls ensuite.`
        : lastErr ? `Connexion au suivi impossible (${lastErr}). Nouvel essai automatique.` : 'Connexion au suivi…';
      return;
    }
    if (busy && (n || nd)) { e.className = 'msg'; e.textContent = `Envoi de ${n} reçu${n > 1 ? 's' : ''} en cours…`; return; }
    if (lastErr) { e.className = 'msg err'; e.textContent = `${n || !nd ? n + ' reçu' + (n > 1 ? 's' : '') : nd + ' suppression' + (nd > 1 ? 's' : '')} en attente d'envoi (${lastErr}). Nouvel essai automatique dans 1 minute.`; return; }
    if (!n && nd) { e.className = 'msg'; e.textContent = `${nd} suppression${nd > 1 ? 's' : ''} en attente d'envoi au suivi.`; return; }
    e.className = 'msg ok';
    e.textContent = n ? `${n} reçu${n > 1 ? 's' : ''} en attente d'envoi.` : 'Suivi en temps réel actif : chaque reçu est envoyé automatiquement' + (lastOk ? ' (dernier envoi à ' + lastOk.toTimeString().slice(0, 5) + ').' : '.');
  }

  if ($('sy-push')) $('sy-push').onclick = () => { lastErr = ''; push(); };

  /* Envoi juste après chaque reçu validé, au retour d'internet, à l'ouverture de l'appli, et toutes les 10 s */
  $('form').addEventListener('submit', () => setTimeout(push, 800));
  window.addEventListener('online', () => { lastErr = ''; push(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) push(); });
  setInterval(tick, 10000);
  majActif(); ui(); setTimeout(push, 1500);
})();
