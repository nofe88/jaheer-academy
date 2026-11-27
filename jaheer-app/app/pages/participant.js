// بوابة المشارك: كل صفحة تعرض بيانات صاحب الحساب فقط (تفرضها قاعدة البيانات)
import { sb, html, t, pick, rows, one, fmtDate, badge, regState, state, toast, failMsg, num } from '../core.js';
const top = (ctx, ar, en) => { ctx.title = [ar, en]; ctx.crumbs = [['بوابة المشارك', 'Participant portal', '/participant/dashboard'], [ar, en]]; };
const H = (ar, en, lead) => html`<div class="ph-head"><h1>${t(ar, en)}</h1>${lead ? html`<p class="muted">${lead}</p>` : ''}</div>`;
const evMap = async () => Object.fromEntries((await rows(sb?.from('events').select('*'))).map(e => [e.id, e]));
const empty = (a, e) => html`<p class="muted box">${t(a, e)}</p>`;

export async function dashboard(ctx, main) {
  top(ctx, 'لوحة التحكم', 'Dashboard'); ctx.crumbs = [['لوحة التحكم', 'Dashboard']];
  const [E, R, S, RS] = await Promise.all([evMap(),
    rows(sb.from('registrations').select('*').eq('participant_id', state.me.id).order('created_at', { ascending: false })),
    rows(sb.from('schedules').select('*').eq('participant_id', state.me.id).eq('published', true).order('starts_at')),
    rows(sb.from('results').select('*').eq('participant_id', state.me.id).eq('published', true))]);
  const open = Object.values(E).filter(e => regState(e) === 'open' && !R.some(r => r.event_id === e.id));
  const next = S.filter(s => new Date(s.starts_at) > new Date())[0];
  const notes = [...R.filter(r => r.status === 'approved' || r.status === 'rejected').map(r => [statusMsg(r, E)]), ...RS.map(r => [t('نُشرت نتيجتك في: ', 'Your result was published for: ') + pick(E[r.event_id], 'title')])];
  main.innerHTML = html`${H('أهلًا، ' + (state.me.full_name || ''), 'Welcome, ' + (state.me.full_name || ''))}
  <div class="kpis"><a class="kpi" href="/participant/registrations"><b>${num(R.length)}</b><span>${t('تسجيلاتي', 'My registrations')}</span></a><a class="kpi" href="/participant/events"><b>${num(open.length)}</b><span>${t('فعاليات مفتوحة', 'Open events')}</span></a><a class="kpi" href="/participant/results"><b>${num(RS.length)}</b><span>${t('نتائج منشورة', 'Published results')}</span></a></div>
  <div class="cols2"><section class="panel"><h2>${t('الموعد القادم', 'Next presentation')}</h2>${next ? html`<p><b>${pick(E[next.event_id], 'title')}</b><br>${fmtDate(next.starts_at, true)} ${next.location ? '— ' + next.location : ''}</p>` : empty('لا توجد مواعيد قادمة.', 'No upcoming presentations.')}</section>
  <section class="panel"><h2>${t('الإشعارات', 'Notifications')}</h2>${notes.length ? html`<ul class="list">${notes.map(n => html`<li>${n[0]}</li>`)}</ul>` : empty('لا توجد إشعارات.', 'No notifications.')}</section></div>
  <section class="panel"><h2>${t('فعاليات يمكنك التسجيل فيها', 'Events you can apply to')}</h2>${open.length ? html`<ul class="list">${open.map(e => html`<li><a href="/events/${e.slug}">${pick(e, 'title')}</a></li>`)}</ul>` : empty('لا توجد فعاليات مفتوحة حاليًا.', 'No open events right now.')}</section>`.toString();
}
const statusMsg = (r, E) => (r.status === 'approved' ? t('تم قبول تسجيلك في: ', 'Your registration was approved: ') : t('لم يُقبل تسجيلك في: ', 'Your registration was not accepted: ')) + pick(E[r.event_id], 'title');

export async function profile(ctx, main) {
  top(ctx, 'ملفي', 'Profile');
  const m = state.me;
  main.innerHTML = html`${H('ملفي الشخصي', 'My profile')}<form id="f" class="panel form" novalidate>
    <label>${t('البريد الإلكتروني', 'Email')}<input value="${m.email}" disabled dir="ltr"></label>
    <label>${t('الاسم الكامل', 'Full name')}<input name="full_name" required minlength="2" maxlength="100" value="${m.full_name}"></label>
    <label>${t('نبذة عنك', 'About you')}<textarea name="bio" maxlength="1000">${m.bio || ''}</textarea></label>
    <button class="btn" type="submit">${t('حفظ', 'Save')}</button></form>`.toString();
  const f = main.querySelector('#f');
  f.onsubmit = async e => {
    e.preventDefault(); const name = f.full_name.value.trim(); if (name.length < 2) return toast(t('الاسم قصير.', 'Name too short.'), false);
    const { error } = await sb.from('profiles').update({ full_name: name, bio: f.bio.value.trim() || null }).eq('id', m.id);
    if (error) return toast(failMsg(error), false);
    state.me.full_name = name; state.me.bio = f.bio.value.trim(); toast(t('تم الحفظ.', 'Saved.'));
  };
}

export async function events(ctx, main) {
  top(ctx, 'الفعاليات', 'Events');
  const [E, R] = await Promise.all([rows(sb.from('events').select('*').eq('published', true).order('event_date')), rows(sb.from('registrations').select('event_id,status').eq('participant_id', state.me.id))]);
  const mine = Object.fromEntries(R.map(r => [r.event_id, r.status]));
  main.innerHTML = html`${H('الفعاليات المتاحة', 'Available events', t('سجّل في الفعاليات المفتوحة. التسجيل يخضع لمراجعة الإدارة.', 'Apply to open events. Applications are reviewed by the administration.'))}
  ${E.length ? html`<div class="grid2">${E.map(e => { const st = regState(e); return html`<article class="panel"><div class="row">${badge(st)}<small>${fmtDate(e.event_date)}</small></div><h3><a href="/events/${e.slug}">${pick(e, 'title')}</a></h3>
    <p class="muted">${t('التقديم: ', 'Applications: ')}${fmtDate(e.apply_open) || '—'} → ${fmtDate(e.apply_close) || '—'}</p>
    ${mine[e.id] ? html`<p>${t('حالة تسجيلك: ', 'Your status: ')}${badge(mine[e.id])}</p>` : st === 'open' ? html`<button class="btn" data-reg="${e.id}" type="button">${t('سجّل الآن', 'Apply now')}</button>` : ''}</article>`; })}</div>` : empty('لا توجد فعاليات.', 'No events.')}`.toString();
  main.querySelectorAll('[data-reg]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    const { error } = await sb.from('registrations').insert({ event_id: b.dataset.reg, participant_id: state.me.id });
    if (error) { b.disabled = false; return toast(failMsg(error), false); }
    toast(t('تم إرسال طلبك.', 'Application submitted.')); events(ctx, main);
  });
}

export async function registrations(ctx, main) {
  top(ctx, 'تسجيلاتي', 'Registrations');
  const [E, R] = await Promise.all([evMap(), rows(sb.from('registrations').select('*').eq('participant_id', state.me.id).order('created_at', { ascending: false }))]);
  main.innerHTML = html`${H('تسجيلاتي', 'My registrations')}${R.length ? html`<div class="tbl"><table><thead><tr><th>${t('الفعالية', 'Event')}</th><th>${t('تاريخ الطلب', 'Applied on')}</th><th>${t('الحالة', 'Status')}</th><th></th></tr></thead><tbody>
    ${R.map(r => html`<tr><td><a href="/events/${E[r.event_id]?.slug}">${pick(E[r.event_id], 'title')}</a></td><td>${fmtDate(r.created_at)}</td><td>${badge(r.status)}</td><td>${['pending', 'approved'].includes(r.status) ? html`<button class="btn o sm" data-w="${r.id}" type="button">${t('سحب الطلب', 'Withdraw')}</button>` : ''}</td></tr>`)}</tbody></table></div>` : empty('لم تقدّم على أي فعالية بعد.', 'You have not applied to any event yet.')}`.toString();
  main.querySelectorAll('[data-w]').forEach(b => b.onclick = async () => {
    if (!confirm(t('سحب الطلب؟', 'Withdraw this application?'))) return;
    const { error } = await sb.from('registrations').update({ status: 'withdrawn' }).eq('id', b.dataset.w);
    if (error) return toast(failMsg(error), false); registrations(ctx, main);
  });
}

export async function schedule(ctx, main) {
  top(ctx, 'الجدول', 'Schedule');
  const [E, S] = await Promise.all([evMap(), rows(sb.from('schedules').select('*').eq('participant_id', state.me.id).eq('published', true).order('starts_at'))]);
  main.innerHTML = html`${H('جدول العروض', 'Presentation schedule')}${S.length ? html`<div class="tbl"><table><thead><tr><th>${t('الفعالية', 'Event')}</th><th>${t('البداية', 'Starts')}</th><th>${t('النهاية', 'Ends')}</th><th>${t('المكان', 'Location')}</th></tr></thead><tbody>${S.map(s => html`<tr><td>${pick(E[s.event_id], 'title')}</td><td>${fmtDate(s.starts_at, true)}</td><td>${fmtDate(s.ends_at, true) || '—'}</td><td>${s.location || '—'}</td></tr>`)}</tbody></table></div>` : empty('لم يُنشر لك موعد بعد.', 'No schedule has been published for you yet.')}`.toString();
}

export async function evaluations(ctx, main) {
  top(ctx, 'التقييمات', 'Evaluations');
  const [E, C, L] = await Promise.all([evMap(), rows(sb.from('criteria').select('*')), rows(sb.rpc('my_evaluations'))]);
  const cm = Object.fromEntries(C.map(c => [c.id, c])), by = {};
  L.forEach(x => (by[x.event_id] ||= []).push(x));
  main.innerHTML = html`${H('التقييمات', 'Evaluations', t('الدرجات وملاحظات لجنة التحكيم (دون ذكر أسماء المحكّمين). تظهر بعد نشر نتائج الفعالية.', 'Scores and judging-panel feedback (judges are anonymous). Shown after the event results are published.'))}
  ${Object.keys(by).length ? Object.entries(by).map(([eid, list]) => html`<section class="panel"><h2>${pick(E[eid], 'title')}</h2>${list.map((x, i) => { const tot = Object.values(x.scores).reduce((a, b) => a + Number(b), 0);
    return html`<article class="note"><h4>${t('تقييم ', 'Evaluation ')}${num(i + 1)} <small>${fmtDate(x.on_date)}</small></h4><ul class="scores">${Object.entries(x.scores).map(([k, v]) => html`<li><span>${pick(cm[k], 'name')}</span><b>${num(v)} / ${num(cm[k]?.max_score ?? '')}</b></li>`)}</ul><p><b>${t('المجموع: ', 'Total: ')}${num(tot)}</b></p>${x.comment ? html`<p class="fb">${x.comment}</p>` : ''}</article>`; })}</section>`) : empty('لا توجد تقييمات منشورة بعد.', 'No published evaluations yet.')}`.toString();
}

export async function results(ctx, main) {
  top(ctx, 'النتائج', 'Results');
  const [E, R] = await Promise.all([evMap(), rows(sb.from('results').select('*').eq('participant_id', state.me.id).eq('published', true))]);
  main.innerHTML = html`${H('النتائج وسجل الأداء', 'Results & performance history')}${R.length ? html`<div class="tbl"><table><thead><tr><th>${t('الفعالية', 'Event')}</th><th>${t('التاريخ', 'Date')}</th><th>${t('المجموع', 'Total')}</th><th>${t('الترتيب', 'Rank')}</th></tr></thead><tbody>${R.map(r => html`<tr><td>${pick(E[r.event_id], 'title')}</td><td>${fmtDate(E[r.event_id]?.event_date)}</td><td>${num(r.total ?? '—')}</td><td>${num(r.rank ?? '—')}</td></tr>`)}</tbody></table></div>` : empty('لم تُنشر نتائج بعد.', 'No results published yet.')}`.toString();
}
