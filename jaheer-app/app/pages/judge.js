// بوابة المحكّم: التكليفات الخاصة به فقط. اسمه لا يصل للمشارك أبدًا.
import { sb, html, t, pick, rows, one, fmtDate, badge, state, toast, failMsg, num } from '../core.js';
const top = (ctx, ar, en) => { ctx.title = [ar, en]; ctx.crumbs = [['بوابة المحكّمين', 'Judges portal', '/judge/dashboard'], [ar, en]]; };
const H = (ar, en, lead) => html`<div class="ph-head"><h1>${t(ar, en)}</h1>${lead ? html`<p class="muted">${lead}</p>` : ''}</div>`;
const empty = (a, e) => html`<p class="muted box">${t(a, e)}</p>`;
const evMap = async () => Object.fromEntries((await rows(sb?.from('events').select('id,slug,title_ar,title_en,event_date'))).map(e => [e.id, e]));
const nf = async (ctx, main) => (await import('./errors.js')).notFound(ctx, main);

export async function dashboard(ctx, main) {
  top(ctx, 'الرئيسية', 'Home'); ctx.crumbs = [['بوابة المحكّمين', 'Judges portal']];
  const [A, E] = await Promise.all([rows(sb.rpc('judge_assignments')), evMap()]);
  const c = s => A.filter(a => a.eval_status === s).length, todo = A.filter(a => a.eval_status !== 'submitted').slice(0, 5);
  main.innerHTML = html`${H('أهلًا، ' + (state.me.full_name || ''), 'Welcome, ' + (state.me.full_name || ''))}
  <div class="kpis"><div class="kpi"><b>${num(A.length)}</b><span>${t('إجمالي التكليفات', 'Total assignments')}</span></div><div class="kpi"><b>${num(c('assigned') + c('draft'))}</b><span>${t('بانتظار التسليم', 'Pending')}</span></div><div class="kpi"><b>${num(c('submitted'))}</b><span>${t('مُسلَّمة', 'Submitted')}</span></div></div>
  <section class="panel"><h2>${t('المهام العاجلة', 'Next tasks')}</h2>${todo.length ? html`<ul class="list">${todo.map(a => html`<li><a href="/judge/evaluate/${a.id}">${a.participant_name || t('مشارك', 'Participant')} — ${pick(E[a.event_id], 'title')}</a> ${badge(a.eval_status)}</li>`)}</ul>` : empty('لا توجد مهام معلّقة.', 'No pending tasks.')}</section>`.toString();
}

export async function assignments(ctx, main) {
  top(ctx, 'التكليفات', 'Assignments');
  const [A, E] = await Promise.all([rows(sb.rpc('judge_assignments')), evMap()]);
  main.innerHTML = html`${H('تكليفاتي', 'My assignments')}${A.length ? html`<div class="tbl"><table><thead><tr><th>${t('المشارك', 'Participant')}</th><th>${t('الفعالية', 'Event')}</th><th>${t('الحالة', 'Status')}</th><th></th></tr></thead><tbody>
    ${A.map(a => html`<tr><td>${a.participant_name || '—'}</td><td>${pick(E[a.event_id], 'title')}</td><td>${badge(a.eval_status)}</td><td><a class="btn sm" href="/judge/evaluate/${a.id}">${a.eval_status === 'submitted' ? t('عرض', 'View') : t('تقييم', 'Evaluate')}</a></td></tr>`)}</tbody></table></div>` : empty('لا توجد تكليفات لك حاليًا.', 'You have no assignments yet.')}`.toString();
}

export async function submissions(ctx, main) {
  top(ctx, 'تقييماتي', 'My evaluations');
  const [A, E] = await Promise.all([rows(sb.rpc('judge_assignments')), evMap()]);
  const done = A.filter(a => a.eval_status === 'submitted');
  main.innerHTML = html`${H('التقييمات المُسلَّمة', 'Submitted evaluations')}${done.length ? html`<ul class="list panel">${done.map(a => html`<li><a href="/judge/evaluate/${a.id}">${a.participant_name} — ${pick(E[a.event_id], 'title')}</a></li>`)}</ul>` : empty('لم تُسلِّم أي تقييم بعد.', 'You have not submitted any evaluation yet.')}`.toString();
}

export async function profile(ctx, main) {
  top(ctx, 'ملفي', 'Profile'); const m = state.me;
  main.innerHTML = html`${H('ملفي', 'My profile', t('اسمك لا يظهر للمشاركين في أي مكان.', 'Your name is never shown to participants.'))}<form id="f" class="panel form" novalidate>
    <label>${t('البريد الإلكتروني', 'Email')}<input value="${m.email}" disabled dir="ltr"></label>
    <label>${t('الاسم', 'Name')}<input name="full_name" required minlength="2" maxlength="100" value="${m.full_name}"></label><button class="btn" type="submit">${t('حفظ', 'Save')}</button></form>`.toString();
  const f = main.querySelector('#f');
  f.onsubmit = async e => { e.preventDefault(); const name = f.full_name.value.trim(); if (name.length < 2) return toast(t('الاسم قصير.', 'Name too short.'), false);
    const { error } = await sb.from('profiles').update({ full_name: name }).eq('id', m.id); if (error) return toast(failMsg(error), false); state.me.full_name = name; toast(t('تم الحفظ.', 'Saved.')); };
}

export async function evaluate(ctx, main) {
  const A = (await rows(sb.rpc('judge_assignments'))).find(a => a.id === ctx.params.id);
  if (!A) return nf(ctx, main);                                    // ليس تكليفه = كأنه غير موجود
  const [crit, ev, cur] = await Promise.all([rows(sb.from('criteria').select('*').eq('event_id', A.event_id).order('sort')),
    one(sb.from('events').select('title_ar,title_en').eq('id', A.event_id).maybeSingle()), one(sb.from('evaluations').select('*').eq('assignment_id', A.id).maybeSingle())]);
  const locked = cur?.status === 'submitted', sc = cur?.scores || {};
  top(ctx, 'تقييم', 'Evaluate'); ctx.crumbs = [['بوابة المحكّمين', 'Judges portal', '/judge/dashboard'], ['التكليفات', 'Assignments', '/judge/assignments'], ['تقييم', 'Evaluate']];
  main.innerHTML = html`${H('تقييم: ' + (A.participant_name || ''), 'Evaluate: ' + (A.participant_name || ''), pick(ev, 'title'))}
  <div class="cols2"><aside class="panel"><h2>${t('المشارك', 'Participant')}</h2><p><b>${A.participant_name}</b></p><p class="muted">${A.participant_bio || t('لا توجد نبذة.', 'No bio.')}</p><p>${badge(cur?.status || 'assigned')}</p></aside>
  <form id="f" class="panel form" novalidate><h2>${t('المعايير والدرجات', 'Criteria & scores')}</h2>
    ${crit.length ? crit.map(c => html`<label>${pick(c, 'name')} <small>(0 – ${c.max_score})</small><input name="c_${c.id}" type="number" min="0" max="${c.max_score}" step="0.5" inputmode="decimal" value="${sc[c.id] ?? ''}" ${locked ? 'disabled' : ''}></label>`) : empty('لم تُحدَّد معايير لهذه الفعالية بعد.', 'No criteria were defined for this event yet.')}
    <label>${t('الملاحظات الكتابية (تصل للمشارك دون اسمك)', 'Written feedback (delivered anonymously)')}<textarea name="comment" maxlength="3000" ${locked ? 'disabled' : ''}>${cur?.comment || ''}</textarea></label>
    ${locked ? html`<p class="msg ok">${t('تم تسليم هذا التقييم ولا يمكن تعديله.', 'This evaluation was submitted and is locked.')}</p>` : html`<div class="row"><button class="btn o" data-s="draft" type="button">${t('حفظ كمسودة', 'Save draft')}</button><button class="btn" data-s="submitted" type="button">${t('تسليم نهائي', 'Submit')}</button></div>`}</form></div>`.toString();
  const f = main.querySelector('#f');
  const save = async status => {
    const scores = {}; crit.forEach(c => { const v = f['c_' + c.id].value; if (v !== '') scores[c.id] = Number(v); });
    if (status === 'submitted') {
      if (!crit.length || Object.keys(scores).length !== crit.length) return toast(t('أكمل جميع الدرجات قبل التسليم.', 'Complete all scores before submitting.'), false);
      if (!confirm(t('التسليم نهائي ولا يمكن التعديل بعده. متابعة؟', 'Submission is final. Continue?'))) return;
    }
    const { error } = await sb.from('evaluations').upsert({ assignment_id: A.id, scores, comment: f.comment.value.trim() || null, status }, { onConflict: 'assignment_id' });
    if (error) return toast(failMsg(error), false);
    toast(status === 'draft' ? t('حُفظت المسودة.', 'Draft saved.') : t('تم التسليم.', 'Submitted.')); if (status === 'submitted') evaluate(ctx, main);
  };
  f.querySelectorAll('[data-s]').forEach(b => b.onclick = () => save(b.dataset.s));
}
