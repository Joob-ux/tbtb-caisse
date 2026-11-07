/* Suivi à distance : envoie les reçus de cette caisse au serveur de suivi (tbtb-suivi sur Render).
   Les reçus restent d'abord sur l'appareil ; ils partent dès qu'il y a internet (réessai automatique).
   Le gérant les consulte sur son téléphone à l'adresse SUIVI_URL. */
(function () {
  const K_RECUS = 'tbtb_recus_v1', K_JETON = 'tbtb_suivi_jeton', K_OK = 'tbtb_suivi_envoyes', K_APP = 'tbtb_appareil';
  const $ = id => document.getElementById(id);
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  const SUIVI_URL = get('tbtb_suivi_url') || 'https://tbtb-suivi.onrender.com';   // tbtb_suivi_url : seulement pour les essais

  /* Identifiant de cet appareil (chaque caisse a sa propre numérotation) */
  let appareil = get(K_APP);
  if (!appareil) { appareil = 'caisse-' + Math.random().toString(36).slice(2, 10); set(K_APP, appareil); }

  const recus = () => { try { const v = JSON.parse(get(K_RECUS)); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const envoyes = () => { try { return new Set(JSON.parse(get(K_OK)) || []); } catch (e) { return new Set(); } };
  const attente = () => { const ok = envoyes(); return recus().filter(r => r && r.num && !ok.has(r.num)); };

  let busy = false, lastErr = '', lastOk = null;

  async function call(path, body) {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 70000);  // le serveur gratuit peut mettre ~1 min à se réveiller
    try {
      const jeton = get(K_JETON);
      const r = await fetch(SUIVI_URL + path, { method: 'POST', signal: ctl.signal,
        headers: Object.assign({ 'Content-Type': 'application/json' }, jeton ? { Authorization: 'Bearer ' + jeton } : {}),
        body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401 && path !== '/api/login') { set(K_JETON, null); }
      if (!r.ok) throw new Error(d.erreur || 'Erreur ' + r.status);
      return d;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('le serveur ne répond pas');
      if (e instanceof TypeError) throw new Error('pas de connexion internet');
      throw e;
    } finally { clearTimeout(tm); }
  }

  async function push() {
    if (busy || !get(K_JETON)) { ui(); return; }
    const list = attente(); if (!list.length) { lastErr = ''; ui(); return; }
    busy = true; ui();
    try {
      for (let i = 0; i < list.length; i += 100) {
        const d = await call('/api/recus', { appareil, recus: list.slice(i, i + 100) });
        const ok = envoyes(); (d.ok || []).forEach(n => ok.add(n)); set(K_OK, JSON.stringify([...ok]));
      }
      lastErr = ''; lastOk = new Date();
    } catch (e) { lastErr = e.message; }
    busy = false; ui();
  }

  function ui() {
    if (!$('sy-etat')) return;
    const on = !!get(K_JETON), n = attente().length, e = $('sy-etat');
    $('sy-form').hidden = on; $('sy-actions').hidden = !on;
    if (!on) { e.className = 'msg'; e.textContent = 'Caisse non connectée au suivi. Entrez l\'email et le mot de passe du gérant pour envoyer les reçus sur internet.'; return; }
    if (busy) { e.className = 'msg'; e.textContent = `Envoi de ${n} reçu${n > 1 ? 's' : ''} en cours…`; return; }
    if (lastErr) { e.className = 'msg err'; e.textContent = `${n} reçu${n > 1 ? 's' : ''} en attente d'envoi (${lastErr}). Nouvel essai automatique dans 1 minute.`; return; }
    e.className = 'msg ok';
    e.textContent = n ? `${n} reçu${n > 1 ? 's' : ''} en attente d'envoi.` : 'Suivi à distance actif : tous les reçus sont envoyés' + (lastOk ? ' (dernier envoi à ' + lastOk.toTimeString().slice(0, 5) + ').' : '.');
  }

  $('sy-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const email = $('sy-email').value.trim(), mdp = $('sy-mdp').value, e = $('sy-etat');
    if (!email || !mdp) { e.className = 'msg err'; e.textContent = 'Entrez l\'email et le mot de passe.'; return; }
    $('sy-btn').disabled = true; e.className = 'msg'; e.textContent = 'Connexion… (jusqu\'à une minute la première fois)';
    try {
      const d = await call('/api/login', { email, mdp, appareil });
      set(K_JETON, d.jeton); $('sy-mdp').value = ''; lastErr = '';
      push();
    } catch (err) { e.className = 'msg err'; e.textContent = 'Connexion impossible : ' + err.message; }
    finally { $('sy-btn').disabled = false; }
  });
  $('sy-push').onclick = () => { lastErr = ''; push(); };
  $('sy-out').onclick = () => { set(K_JETON, null); ui(); };

  /* Envoi après chaque reçu validé, toutes les minutes, et au retour d'internet */
  $('form').addEventListener('submit', () => setTimeout(push, 800));
  window.addEventListener('online', push);
  setInterval(push, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) push(); });
  ui(); setTimeout(push, 2000);
})();
