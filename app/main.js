// الموجّه: مسارات حقيقية (History API) + حراسة الأدوار + تخطيط مستقل لكل بوابة
import { state, loadMe, dash, html, t, lang } from './core.js';
import { publicLayout, participantLayout, judgeLayout, adminLayout, renderCrumbs } from './layouts.js';

const LAYOUT = { public: publicLayout, participant: participantLayout, judge: judgeLayout, admin: adminLayout };
const MOD = { pub: () => import('./pages/public.js'), auth: () => import('./pages/auth.js'), par: () => import('./pages/participant.js'), jud: () => import('./pages/judge.js'), adm: () => import('./pages/admin.js'), err: () => import('./pages/errors.js') };
const P = 'participant', J = 'judge', A = 'admin';
// [المسار, التخطيط, الأدوار المسموحة (null = عام), الوحدة, الدالة, العنوان, guest = للزائر فقط]
const ROUTES = [
  ['/', 'public', null, 'pub', 'home', ['الرئيسية', 'Home']],
  ['/about', 'public', null, 'pub', 'about', ['عن جهير', 'About Jaheer']],
  ['/programs', 'public', null, 'pub', 'programs', ['البرامج', 'Programs']],
  ['/programs/:slug', 'public', null, 'pub', 'program', ['البرنامج', 'Program']],
  ['/marathon', 'public', null, 'pub', 'marathon', ['ماراثون جَهير', 'Jaheer Marathon']],
  ['/events', 'public', null, 'pub', 'events', ['الفعاليات', 'Events']],
  ['/events/:slug', 'public', null, 'pub', 'event', ['تفاصيل الفعالية', 'Event details']],
  ['/gallery', 'public', null, 'pub', 'gallery', ['المعرض', 'Gallery']],
  ['/contact', 'public', null, 'pub', 'contact', ['تواصل معنا', 'Contact']],
  ['/login', 'public', null, 'auth', 'login', ['تسجيل الدخول', 'Sign in'], true],
  ['/register', 'public', null, 'auth', 'register', ['تسجيل المشاركين', 'Register'], true],
  ['/forgot-password', 'public', null, 'auth', 'forgot', ['استعادة كلمة المرور', 'Forgot password']],
  ['/reset-password', 'public', null, 'auth', 'reset', ['تعيين كلمة المرور', 'Reset password']],
  ['/verify-email', 'public', null, 'auth', 'verify', ['تأكيد البريد', 'Verify email']],
  ...['dashboard', 'profile', 'events', 'registrations', 'schedule', 'evaluations', 'results'].map(n => [`/participant/${n}`, 'participant', [P], 'par', n, [n, n]]),
  ...['dashboard', 'assignments', 'submissions', 'profile'].map(n => [`/judge/${n}`, 'judge', [J], 'jud', n, [n, n]]),
  ['/judge/evaluate/:id', 'judge', [J], 'jud', 'evaluate', ['تقييم', 'Evaluate']],
  ...['dashboard', 'participants', 'judges', 'events', 'assignments', 'evaluations', 'results', 'schedules', 'gallery', 'reports', 'settings', 'content'].map(n => [`/admin/${n}`, 'admin', [A], 'adm', n, [n, n]]),
  ['/admin/events/create', 'admin', [A], 'adm', 'eventCreate', ['فعالية جديدة', 'New event']],
  ['/admin/events/:id', 'admin', [A], 'adm', 'eventEdit', ['تعديل فعالية', 'Edit event']],
];
const compile = p => { const k = []; const re = new RegExp('^' + p.replace(/:([a-z]+)/g, (_, n) => { k.push(n); return '([^/]+)'; }) + '$'); return s => { const m = re.exec(s); return m ? Object.fromEntries(k.map((n, i) => [n, decodeURIComponent(m[i + 1])])) : null; }; };
const RT = ROUTES.map(r => ({ path: r[0], layout: r[1], roles: r[2], mod: r[3], fn: r[4], title: r[5], guest: r[6], m: compile(r[0]) }));
const root = document.querySelector('#root');
let seq = 0;
const go = p => { history.replaceState({}, '', p); return route(); };

async function route() {
  const my = ++seq;
  document.body.classList.remove('menu-open');
  const path = location.pathname.replace(/\/+$/, '') || '/';
  await loadMe();
  if (my !== seq) return;
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  let hit = null; for (const r of RT) { const p = r.m(path); if (p) { hit = { r, p }; break; } }
  let layout = 'public', mod = 'err', fn = 'notFound', params = {}, title = ['الصفحة غير موجودة', 'Not found'];
  if (hit) {
    const { r } = hit;
    if (r.guest && state.me) return go(dash[state.me.role]);
    if (r.roles && !state.me) return go('/login?next=' + encodeURIComponent(path));
    if (r.roles && !r.roles.includes(state.me.role)) { mod = 'err'; fn = 'forbidden'; title = ['غير مصرّح', 'Access denied']; }
    else { layout = r.layout; mod = r.mod; fn = r.fn; params = hit.p; title = r.title; }
  }
  const main = LAYOUT[layout](root);
  main.classList.add('fade');
  const ctx = { params, query: Object.fromEntries(new URLSearchParams(location.search)), path, crumbs: null, title: null };
  try { const m = await MOD[mod](); await m[fn](ctx, main); }
  catch (e) { console.error(e); main.innerHTML = html`<div class="in sec"><p class="msg err">${t('حدث خطأ أثناء تحميل الصفحة.', 'Something went wrong while loading this page.')}</p></div>`.toString(); }
  if (my !== seq) return;
  document.title = (ctx.title ? t(...ctx.title) : t(...title)) + ' — ' + t('أكاديمية جَهير', 'Jaheer Academy');
  renderCrumbs(ctx.crumbs);
}

document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || a.target || a.hasAttribute('download')) return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || /\.[a-z0-9]+$/i.test(u.pathname)) return;
  e.preventDefault();
  if (u.pathname + u.search !== location.pathname + location.search) history.pushState({}, '', u.pathname + u.search + u.hash);
  route(); window.scrollTo(0, 0);
});
window.addEventListener('popstate', route);
window.addEventListener('route', route);
window.addEventListener('pageshow', e => { if (e.persisted) route(); });   // يمنع ظهور صفحة محمية من ذاكرة المتصفح بعد الخروج
route();
