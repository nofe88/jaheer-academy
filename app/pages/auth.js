// صفحات الدخول: بريد إلكتروني + كلمة مرور فقط (لا هاتف ولا رموز SMS)
import { sb, html, t, state, loadMe, dash, nav, failMsg, authEvents, bootHash, configured } from '../core.js';
const card = (ar, en, body) => html`<section class="in auth"><div class="acard"><h1>${t(ar, en)}</h1>${body}<p id="msg" class="msg" role="status" hidden></p></div></section>`;
const say = (m, ok) => { const e = document.querySelector('#msg'); e.textContent = m || ''; e.className = 'msg ' + (ok ? 'ok' : 'err'); e.hidden = !m; };
const busy = (f, b) => f.querySelectorAll('button').forEach(x => x.disabled = b);
const email = () => html`<label>${t('البريد الإلكتروني', 'Email')}<input name="email" type="email" required maxlength="254" autocomplete="email" dir="ltr"></label>`;
const notReady = main => { main.innerHTML = card('غير جاهز', 'Not ready', html`<p class="muted">${t('لم يتم ربط قاعدة البيانات بعد.', 'The database is not connected yet.')}</p>`).toString(); };
const roleNext = (next, role) => next && next.startsWith(`/${role}/`) && !next.startsWith('//') ? next : dash[role];

export async function login(ctx, main) {
  if (!configured) return notReady(main);
  main.innerHTML = card('تسجيل الدخول', 'Sign in', html`<form id="f" novalidate>${email()}
    <label>${t('كلمة المرور', 'Password')}<input name="password" type="password" required maxlength="72" autocomplete="current-password"></label>
    <button class="btn" type="submit">${t('دخول', 'Sign in')}</button></form>
    <p class="alt"><a href="/forgot-password">${t('نسيت كلمة المرور؟', 'Forgot password?')}</a> · <a href="/register">${t('إنشاء حساب مشارك', 'Create participant account')}</a></p>`).toString();
  const f = main.querySelector('#f');
  f.onsubmit = async e => {
    e.preventDefault(); say(''); busy(f, true);
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    if (error) { busy(f, false); return say(failMsg(error)); }
    await loadMe();
    if (!state.me) { await sb.auth.signOut(); busy(f, false); return say(t('الحساب غير مفعّل بعد.', 'This account is not active yet.')); }
    history.replaceState({}, '', roleNext(ctx.query.next, state.me.role)); window.dispatchEvent(new Event('route'));   // التحويل حسب الدور الموثّق
  };
}

export async function register(ctx, main) {
  if (!configured) return notReady(main);
  main.innerHTML = card('تسجيل المشاركين', 'Participant registration', html`<form id="f" novalidate>
    <label>${t('الاسم الكامل', 'Full name')}<input name="full_name" required minlength="2" maxlength="100" autocomplete="name"></label>${email()}
    <label>${t('كلمة المرور (8 أحرف على الأقل)', 'Password (min 8 characters)')}<input name="password" type="password" required minlength="8" maxlength="72" autocomplete="new-password"></label>
    <label>${t('تأكيد كلمة المرور', 'Confirm password')}<input name="confirm" type="password" required maxlength="72" autocomplete="new-password"></label>
    <label class="chk"><input type="checkbox" name="consent" required><span>${t('أوافق على حفظ بياناتي واستخدامها لأغراض التسجيل والتواصل في أكاديمية جَهير فقط.', 'I agree to the storage and use of my data for registration and communication with Jaheer Academy only.')}</span></label>
    <input class="hp" name="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="btn" type="submit">${t('إنشاء الحساب', 'Create account')}</button></form>
    <p class="alt">${t('لديك حساب؟', 'Have an account?')} <a href="/login">${t('دخول', 'Sign in')}</a></p>`).toString();
  const f = main.querySelector('#f');
  f.onsubmit = async e => {
    e.preventDefault(); say(''); if (f.hp.value) return;
    const name = f.full_name.value.trim();
    if (name.length < 2 || !f.email.checkValidity()) return say(t('تحقق من الاسم والبريد.', 'Check your name and email.'));
    if (f.password.value.length < 8) return say(t('كلمة المرور يجب ألا تقل عن 8 أحرف.', 'Password must be at least 8 characters.'));
    if (f.password.value !== f.confirm.value) return say(t('كلمتا المرور غير متطابقتين.', 'Passwords do not match.'));
    if (!f.consent.checked) return say(t('يلزم الموافقة على حفظ البيانات.', 'Consent is required.'));
    busy(f, true);
    // لا يوجد حقل دور: كل حساب جديد مشارك دائمًا (يُفرض في قاعدة البيانات)
    const { error } = await sb.auth.signUp({ email: f.email.value.trim(), password: f.password.value, options: { emailRedirectTo: location.origin + '/verify-email', data: { full_name: name, consent: true } } });
    busy(f, false);
    if (error) return say(failMsg(error));
    nav('/verify-email?sent=1');
  };
}

export async function forgot(ctx, main) {
  if (!configured) return notReady(main);
  main.innerHTML = card('استعادة كلمة المرور', 'Forgot password', html`<p class="sub">${t('أدخل بريدك وسنرسل لك رابط إعادة التعيين.', 'Enter your email and we will send a reset link.')}</p>
    <form id="f" novalidate>${email()}<button class="btn" type="submit">${t('إرسال الرابط', 'Send link')}</button></form><p class="alt"><a href="/login">${t('العودة للدخول', 'Back to sign in')}</a></p>`).toString();
  const f = main.querySelector('#f');
  f.onsubmit = async e => {
    e.preventDefault(); busy(f, true);
    await sb.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: location.origin + '/reset-password' });
    busy(f, false); say(t('إن كان البريد مسجلًا فستصلك رسالة بالرابط.', 'If the email is registered, a link has been sent.'), true);   // رسالة موحّدة لا تكشف وجود الحساب
  };
}

export async function reset(ctx, main) {
  if (!configured) return notReady(main);
  const { data: { session } } = await sb.auth.getSession();
  const fromLink = authEvents.includes('PASSWORD_RECOVERY') || /type=(recovery|invite)/.test(bootHash);
  if (!session || !fromLink) { main.innerHTML = card('رابط غير صالح', 'Invalid link', html`<p class="muted">${t('الرابط غير صالح أو انتهت صلاحيته.', 'This link is invalid or has expired.')}</p><p><a class="btn" href="/forgot-password">${t('اطلب رابطًا جديدًا', 'Request a new link')}</a></p>`).toString(); return; }
  main.innerHTML = card('تعيين كلمة المرور', 'Set your password', html`<form id="f" novalidate>
    <label>${t('كلمة المرور الجديدة (8 أحرف على الأقل)', 'New password (min 8 characters)')}<input name="password" type="password" required minlength="8" maxlength="72" autocomplete="new-password"></label>
    <label>${t('تأكيد كلمة المرور', 'Confirm password')}<input name="confirm" type="password" required maxlength="72" autocomplete="new-password"></label>
    <button class="btn" type="submit">${t('حفظ', 'Save')}</button></form>`).toString();
  const f = main.querySelector('#f');
  f.onsubmit = async e => {
    e.preventDefault(); say('');
    if (f.password.value.length < 8) return say(t('كلمة المرور يجب ألا تقل عن 8 أحرف.', 'Password must be at least 8 characters.'));
    if (f.password.value !== f.confirm.value) return say(t('كلمتا المرور غير متطابقتين.', 'Passwords do not match.'));
    busy(f, true);
    const { error } = await sb.auth.updateUser({ password: f.password.value });
    if (error) { busy(f, false); return say(failMsg(error)); }
    await loadMe(); say(t('تم تحديث كلمة المرور.', 'Password updated.'), true);
    setTimeout(() => { history.replaceState({}, '', state.me ? dash[state.me.role] : '/login'); window.dispatchEvent(new Event('route')); }, 900);
  };
}

export async function verify(ctx, main) {
  let body;
  const bad = /error|expired|invalid/i.test(bootHash);
  const { data: { session } } = sb ? await sb.auth.getSession() : { data: {} };
  if (bad) body = html`<p class="msg err">${t('رابط التأكيد غير صالح أو منتهٍ.', 'The confirmation link is invalid or expired.')}</p><p><a class="btn" href="/login">${t('الدخول', 'Sign in')}</a></p>`;
  else if (session?.user?.email_confirmed_at) { await loadMe(); body = html`<p class="msg ok">${t('تم تأكيد بريدك الإلكتروني.', 'Your email is verified.')}</p><p><a class="btn" href="${state.me ? dash[state.me.role] : '/login'}">${t('متابعة', 'Continue')}</a></p>`; }
  else if (ctx.query.sent) body = html`<p>${t('أرسلنا رسالة تأكيد إلى بريدك. افتحها لتفعيل حسابك، ثم سجّل الدخول.', 'We sent a confirmation email. Open it to activate your account, then sign in.')}</p><p><a class="btn o" href="/login">${t('الدخول', 'Sign in')}</a></p>`;
  else body = html`<p class="muted">${t('لا يوجد طلب تأكيد حالي.', 'There is no pending confirmation.')}</p><p><a class="btn" href="/login">${t('الدخول', 'Sign in')}</a></p>`;
  main.innerHTML = card('تأكيد البريد الإلكتروني', 'Email verification', body).toString();
}
