// دالة خادم (Vercel). تُنشئ دعوة محكّم. لا تعمل إلا لمشرف موثّق.
// المتغيرات (في إعدادات Vercel فقط، وليست NEXT_PUBLIC): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !KEY) return res.status(500).json({ error: 'server_not_configured' });
  const svc = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!token) return res.status(401).json({ error: 'unauthorized' });
    const who = await fetch(URL_ + '/auth/v1/user', { headers: { apikey: KEY, Authorization: 'Bearer ' + token } });
    if (!who.ok) return res.status(401).json({ error: 'unauthorized' });
    const caller = await who.json();
    const pr = await fetch(`${URL_}/rest/v1/profiles?id=eq.${encodeURIComponent(caller.id)}&select=role`, { headers: svc });
    const role = (await pr.json())[0]?.role;
    if (role !== 'admin') return res.status(403).json({ error: 'forbidden' });

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(b.email || '').trim().toLowerCase(), name = String(b.full_name || '').trim().slice(0, 100);
    if (!/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email) || email.length > 254) return res.status(400).json({ error: 'invalid_email' });

    const redirect = encodeURIComponent(`https://${req.headers.host}/reset-password`);
    const inv = await fetch(`${URL_}/auth/v1/invite?redirect_to=${redirect}`, { method: 'POST', headers: svc,
      body: JSON.stringify({ email, data: { full_name: name, invited: true } }) });
    if (!inv.ok) return res.status(400).json({ error: 'invite_failed' });
    const user = await inv.json();
    const up = await fetch(`${URL_}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, { method: 'PATCH',
      headers: { ...svc, Prefer: 'return=minimal' }, body: JSON.stringify({ role: 'judge', full_name: name }) });
    if (!up.ok) return res.status(500).json({ error: 'role_failed' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
