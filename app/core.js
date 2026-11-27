// الأساسيات المشتركة: الاتصال، اللغة، القوالب الآمنة، الجلسة
const cfg = window.JAHEER_CFG || {};
export const bootHash = location.hash + location.search;           // يُلتقط قبل أن يزيله supabase-js
export const configured = !!(cfg.url && cfg.anonKey && window.supabase);
export const sb = configured ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;
export const authEvents = [];
sb?.auth.onAuthStateChange(ev => authEvents.push(ev));

/* ---------- قوالب HTML آمنة: كل قيمة تُهرَّب تلقائيًا ---------- */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = s => new Safe(String(s));
const val = v => v instanceof Safe ? v.s : Array.isArray(v) ? v.map(val).join('') : v == null || v === false ? '' : esc(v);
export const html = (st, ...v) => new Safe(st.reduce((a, s, i) => a + s + (i < v.length ? val(v[i]) : ''), ''));
export const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '#';

/* ---------- اللغة ---------- */
export let lang = (() => { try { return localStorage.getItem('jl') || 'ar'; } catch { return 'ar'; } })();
export const setLang = l => { lang = l; try { localStorage.setItem('jl', l); } catch {} };
export const t = (a, e) => lang === 'ar' ? a : e;
export const pick = (o, k) => o ? (o[`${k}_${lang}`] || o[`${k}_ar`] || '') : '';
export const fmtDate = (d, time) => {
  if (!d) return '';
  try { return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(d)); } catch { return ''; }
};
export const num = n => lang === 'ar' ? String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]) : String(n);

/* ---------- الشعار الكتابي الرسمي (لا يُعدَّل) ---------- */
export const SLOGAN = [['صوتُ الخطيب إذا اعتلى بشجاعةٍ', 'ذاع المعاني هيبة وحضورًا'], ['ما دامَ للصوتِ الجهيرِ مهابةُ', 'ما كانَ للخطباءِ غيرَ جهيرًا']];
export const sloganHtml = () => html`<div class="sgn" lang="ar">${SLOGAN.map(b => html`<div class="bt"><span>${b[0]}</span><span>${b[1]}</span></div>`)}</div>`;

/* ---------- الجلسة والأدوار ---------- */
export const state = { me: null };
export const dash = { admin: '/admin/dashboard', judge: '/judge/dashboard', participant: '/participant/dashboard' };
export async function loadMe() {
  if (!sb) return state.me = null;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return state.me = null;
  const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  return state.me = data || null;
}
export const nav = p => { history.pushState({}, '', p); window.dispatchEvent(new Event('route')); };

/* ---------- بيانات ---------- */
export const rows = async p => { if (!sb) return []; const { data, error } = await p; if (error) throw error; return data || []; };
export const one = async p => { if (!sb) return null; const { data, error } = await p; if (error) throw error; return data; };
export const setting = async k => (await one(sb?.from('settings').select('value').eq('key', k).maybeSingle()))?.value;
export const page = async k => (await one(sb?.from('pages_content').select('*').eq('key', k).maybeSingle())) || {};

export function toast(m, ok = true) {
  let e = document.querySelector('#toast');
  if (!e) { e = document.createElement('div'); e.id = 'toast'; e.setAttribute('role', 'status'); document.body.append(e); }
  e.textContent = m; e.className = (ok ? 'ok' : 'err') + ' show';
  clearTimeout(e._t); e._t = setTimeout(() => e.className = '', 3500);
}
export const failMsg = e => /invalid login/i.test(e?.message || '') ? t('البريد أو كلمة المرور غير صحيحة.', 'Incorrect email or password.') : t('تعذر تنفيذ الطلب. تحقق من البيانات وحاول مرة أخرى.', 'Request failed. Please check your input and try again.');
export const statusLabel = s => ({ draft: t('مسودة', 'Draft'), upcoming: t('قادمة', 'Upcoming'), open: t('التسجيل مفتوح', 'Registration open'), closed: t('التسجيل مغلق', 'Registration closed'), completed: t('منتهية', 'Completed'),
  pending: t('قيد المراجعة', 'Pending'), approved: t('مقبول', 'Approved'), rejected: t('مرفوض', 'Rejected'), withdrawn: t('مسحوب', 'Withdrawn'), assigned: t('بانتظار التقييم', 'To evaluate'), submitted: t('مُسلَّم', 'Submitted') }[s] || s);
export const badge = s => html`<span class="badge b-${s}">${statusLabel(s)}</span>`;
export function regState(e) {
  const n = Date.now();
  if (e.status !== 'open') return e.status === 'completed' ? 'completed' : e.status === 'upcoming' ? 'upcoming' : 'closed';
  if (e.apply_open && n < new Date(e.apply_open)) return 'upcoming';
  if (e.apply_close && n > new Date(e.apply_close)) return 'closed';
  return 'open';
}
