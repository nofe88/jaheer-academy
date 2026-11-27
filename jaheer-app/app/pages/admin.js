// بوابة المشرف: كل قسم مستقل ويُدار دون تعديل الكود. الصلاحية تفرضها قاعدة البيانات (RLS) لا الواجهة.
import { sb, html, t, pick, rows, one, fmtDate, badge, state, toast, failMsg, num, nav } from '../core.js';
import { crudList, formView } from '../crud.js';
const top = (ctx, ar, en, mid) => { ctx.title = [ar, en]; ctx.crumbs = [['الإدارة', 'Admin', '/admin/dashboard'], ...(mid || []), [ar, en]]; };
const H = (ar, en, lead) => html`<div class="ph-head"><h1>${t(ar, en)}</h1>${lead ? html`<p class="muted">${lead}</p>` : ''}</div>`;
const empty = (a, e) => html`<p class="muted box">${t(a, e)}</p>`;
const nf = async (ctx, main) => (await import('./errors.js')).notFound(ctx, main);
const S = (k, ar, en, o = {}) => ({ k, ar, en, ...o });
const csv = (name, head, data) => {
  const q = v => { v = String(v ?? ''); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const blob = new Blob(['\ufeff' + [head, ...data].map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
};
const profiles = async role => rows(sb.from('profiles').select('*').eq('role', role).order('created_at', { ascending: false }));

/* ---------- الأقسام المُعرَّفة بالإعدادات (محرك CRUD) ---------- */
const STATUS = [['draft', 'مسودة', 'Draft'], ['upcoming', 'قادمة', 'Upcoming'], ['open', 'التسجيل مفتوح', 'Registration open'], ['closed', 'التسجيل مغلق', 'Closed'], ['completed', 'منتهية', 'Completed']];
const EVENT = { table: 'events', ar: 'الفعاليات', en: 'Events', order: ['created_at', false], link: { create: '/admin/events/create', edit: id => `/admin/events/${id}` },
  cols: [{ k: 'title_ar', ar: 'العنوان', en: 'Title' }, { k: 'category', ar: 'النوع', en: 'Type' }, { k: 'status', ar: 'الحالة', en: 'Status', f: r => t(STATUS.find(s => s[0] === r.status)?.[1], STATUS.find(s => s[0] === r.status)?.[2]) }, { k: 'event_date', ar: 'الموعد', en: 'Date' }, { k: 'published', ar: 'منشورة', en: 'Published' }],
  fields: [S('slug', 'المعرّف في الرابط (حروف إنجليزية وأرقام وشرطات)', 'URL slug (a-z, 0-9, -)', { req: true, ltr: true, max: 80 }), S('category', 'النوع', 'Type', { type: 'select', req: true, opts: [['general', 'عامة', 'General'], ['marathon', 'ماراثون', 'Marathon'], ['workshop', 'ورشة', 'Workshop']] }),
    S('title_ar', 'العنوان (عربي)', 'Title (Arabic)', { req: true }), S('title_en', 'العنوان (إنجليزي)', 'Title (English)'), S('description_ar', 'الوصف (عربي)', 'Description (Arabic)', { type: 'textarea' }), S('description_en', 'الوصف (إنجليزي)', 'Description (English)', { type: 'textarea' }),
    S('venue_ar', 'المكان (عربي)', 'Venue (Arabic)'), S('venue_en', 'المكان (إنجليزي)', 'Venue (English)'), S('status', 'الحالة', 'Status', { type: 'select', req: true, opts: STATUS }),
    S('event_date', 'موعد الفعالية', 'Event date', { type: 'datetime' }), S('apply_open', 'فتح التقديم', 'Applications open', { type: 'datetime' }), S('apply_close', 'إغلاق التقديم', 'Applications close', { type: 'datetime' }), S('published', 'منشورة للعامة', 'Published', { type: 'bool' })] };
const evRef = { table: 'events', label: r => r.title_ar };
const ASSIGN = { table: 'assignments', ar: 'التكليفات (محكّم ← مشارك)', en: 'Assignments (judge → participant)', order: ['created_at', false],
  cols: [{ k: 'event_id', ar: 'الفعالية', en: 'Event' }, { k: 'judge_id', ar: 'المحكّم', en: 'Judge' }, { k: 'participant_id', ar: 'المشارك', en: 'Participant' }],
  fields: [S('event_id', 'الفعالية', 'Event', { type: 'ref', req: true, ref: evRef }), S('judge_id', 'المحكّم', 'Judge', { type: 'ref', req: true, ref: { table: 'profiles', eq: ['role', 'judge'] } }), S('participant_id', 'المشارك', 'Participant', { type: 'ref', req: true, ref: { table: 'profiles', eq: ['role', 'participant'] } })] };
const SCHED = { table: 'schedules', ar: 'جدول العروض', en: 'Presentation schedule', order: ['starts_at', true],
  cols: [{ k: 'event_id', ar: 'الفعالية', en: 'Event' }, { k: 'participant_id', ar: 'المشارك', en: 'Participant' }, { k: 'starts_at', ar: 'البداية', en: 'Starts' }, { k: 'location', ar: 'المكان', en: 'Location' }, { k: 'published', ar: 'منشور', en: 'Published' }],
  fields: [S('event_id', 'الفعالية', 'Event', { type: 'ref', req: true, ref: evRef }), S('participant_id', 'المشارك', 'Participant', { type: 'ref', req: true, ref: { table: 'profiles', eq: ['role', 'participant'] } }),
    S('starts_at', 'البداية', 'Starts', { type: 'datetime', req: true }), S('ends_at', 'النهاية', 'Ends', { type: 'datetime' }), S('location', 'المكان', 'Location'), S('published', 'منشور للمشارك', 'Published to participant', { type: 'bool' })] };
const GAL = { table: 'gallery_items', ar: 'عناصر المعرض', en: 'Gallery items', order: ['created_at', false],
  cols: [{ k: 'kind', ar: 'النوع', en: 'Kind' }, { k: 'caption_ar', ar: 'الوصف', en: 'Caption' }, { k: 'section', ar: 'القسم', en: 'Section' }, { k: 'taken_on', ar: 'التاريخ', en: 'Date' }, { k: 'published', ar: 'منشور', en: 'Published' }],
  fields: [S('kind', 'النوع', 'Kind', { type: 'select', req: true, opts: [['image', 'صورة', 'Image'], ['video', 'فيديو (رابط ملف mp4)', 'Video (mp4 link)']] }), S('url', 'رابط الملف (https)', 'File URL (https)', { type: 'url', req: true, max: 1000 }),
    S('section', 'القسم', 'Section', { type: 'select', req: true, opts: [['general', 'عام', 'General'], ['marathon', 'الماراثون', 'Marathon']] }), S('event_id', 'الفعالية', 'Event', { type: 'ref', ref: evRef }),
    S('caption_ar', 'الوصف (عربي)', 'Caption (Arabic)'), S('caption_en', 'الوصف (إنجليزي)', 'Caption (English)'), S('taken_on', 'تاريخ الالتقاط', 'Taken on', { type: 'date' }), S('published', 'منشور', 'Published', { type: 'bool' })] };
const SETT = { table: 'settings', pk: 'key', ar: 'إعدادات الموقع', en: 'Site settings', order: ['key', true],
  cols: [{ k: 'key', ar: 'المفتاح', en: 'Key' }, { k: 'value', ar: 'القيمة', en: 'Value', f: r => JSON.stringify(r.value).slice(0, 90) }],
  fields: [S('key', 'المفتاح', 'Key', { req: true, ltr: true, createOnly: true }), S('value', 'القيمة (JSON)', 'Value (JSON)', { type: 'json', req: true })] };
const TABS = {
  programs: { table: 'programs', pk: 'slug', ar: 'البرامج', en: 'Programs', order: ['sort', true], cols: [{ k: 'name_ar', ar: 'الاسم', en: 'Name' }, { k: 'slug', ar: 'الرابط', en: 'Slug' }],
    fields: [S('slug', 'المعرّف', 'Slug', { req: true, ltr: true, createOnly: true }), S('sort', 'الترتيب', 'Order', { type: 'number' }), S('name_ar', 'الاسم (عربي)', 'Name (Arabic)', { req: true }), S('name_en', 'الاسم (إنجليزي)', 'Name (English)', { req: true }),
      ...['description', 'objectives', 'outcomes'].flatMap(k => [S(k + '_ar', { description: 'الوصف', objectives: 'الأهداف', outcomes: 'مخرجات التعلم' }[k] + ' (عربي)', k + ' (Arabic)', { type: 'textarea' }), S(k + '_en', { description: 'الوصف', objectives: 'الأهداف', outcomes: 'مخرجات التعلم' }[k] + ' (إنجليزي)', k + ' (English)', { type: 'textarea' })])] },
  pages: { table: 'pages_content', pk: 'key', ar: 'نصوص الصفحات (عن جهير ...)', en: 'Page texts (About ...)', cols: [{ k: 'key', ar: 'المفتاح', en: 'Key' }, { k: 'ar', ar: 'العربية', en: 'Arabic' }],
    fields: [S('key', 'المفتاح', 'Key', { req: true, ltr: true, createOnly: true }), S('ar', 'النص العربي', 'Arabic text', { type: 'textarea' }), S('en', 'النص الإنجليزي', 'English text', { type: 'textarea' })] },
  announcements: { table: 'announcements', ar: 'الإعلانات', en: 'Announcements', order: ['created_at', false], cols: [{ k: 'title_ar', ar: 'العنوان', en: 'Title' }, { k: 'created_at', ar: 'التاريخ', en: 'Date' }, { k: 'published', ar: 'منشور', en: 'Published' }],
    fields: [S('title_ar', 'العنوان (عربي)', 'Title (Arabic)', { req: true }), S('title_en', 'العنوان (إنجليزي)', 'Title (English)'), S('body_ar', 'النص (عربي)', 'Body (Arabic)', { type: 'textarea' }), S('body_en', 'النص (إنجليزي)', 'Body (English)', { type: 'textarea' }), S('published', 'منشور', 'Published', { type: 'bool' })] },
  marathon: { table: 'marathon_participants', ar: 'المتحدثون العشرة', en: 'The ten speakers', order: ['position', true], cols: [{ k: 'position', ar: '#', en: '#' }, { k: 'name_ar', ar: 'الاسم', en: 'Name' }, { k: 'published', ar: 'منشور', en: 'Published' }],
    fields: [S('position', 'الترتيب', 'Position', { type: 'number', req: true }), S('name_ar', 'الاسم (عربي)', 'Name (Arabic)', { req: true }), S('name_en', 'الاسم (إنجليزي)', 'Name (English)'), S('degree_ar', 'الدرجة (عربي)', 'Degree (Arabic)'), S('degree_en', 'الدرجة (إنجليزي)', 'Degree (English)'),
      S('bio_ar', 'نبذة (عربي)', 'Bio (Arabic)', { type: 'textarea' }), S('bio_en', 'نبذة (إنجليزي)', 'Bio (English)', { type: 'textarea' }), S('journey_ar', 'الرحلة (عربي)', 'Journey (Arabic)', { type: 'textarea' }), S('journey_en', 'الرحلة (إنجليزي)', 'Journey (English)', { type: 'textarea' }),
      S('achievements_ar', 'الإنجازات (عربي)', 'Achievements (Arabic)', { type: 'textarea' }), S('achievements_en', 'الإنجازات (إنجليزي)', 'Achievements (English)', { type: 'textarea' }), S('published', 'منشور', 'Published', { type: 'bool' })] } };

export async function dashboard(ctx, main) {
  top(ctx, 'لوحة التحكم', 'Dashboard'); ctx.crumbs = [['الإدارة', 'Admin']];
  const cnt = async (tbl, f) => { let q = sb.from(tbl).select('*', { count: 'exact', head: true }); if (f) q = f(q); const { count } = await q; return count ?? 0; };
  const [p, j, e, pend, sub, unpub] = await Promise.all([cnt('profiles', q => q.eq('role', 'participant')), cnt('profiles', q => q.eq('role', 'judge')), cnt('events'), cnt('registrations', q => q.eq('status', 'pending')), cnt('evaluations', q => q.eq('status', 'submitted')), cnt('results', q => q.eq('published', false))]);
  const K = [[p, 'المشاركون', 'Participants', '/admin/participants'], [j, 'المحكّمون', 'Judges', '/admin/judges'], [e, 'الفعاليات', 'Events', '/admin/events'], [pend, 'طلبات بانتظار المراجعة', 'Pending applications', '/admin/events'], [sub, 'تقييمات مُسلَّمة', 'Submitted evaluations', '/admin/evaluations'], [unpub, 'نتائج غير منشورة', 'Unpublished results', '/admin/results']];
  main.innerHTML = html`${H('لوحة التحكم', 'Dashboard')}<div class="kpis">${K.map(k => html`<a class="kpi" href="${k[3]}"><b>${num(k[0])}</b><span>${t(k[1], k[2])}</span></a>`)}</div>`.toString();
}

export async function participants(ctx, main) {
  top(ctx, 'المشاركون', 'Participants');
  const [P, R] = await Promise.all([profiles('participant'), rows(sb.from('registrations').select('participant_id'))]);
  const rc = {}; R.forEach(r => rc[r.participant_id] = (rc[r.participant_id] || 0) + 1);
  main.innerHTML = html`${H('المشاركون', 'Participants', t('الحسابات المسجّلة. التسجيل العام ينشئ مشاركين فقط.', 'Registered accounts. Public registration only creates participants.'))}
  <input id="q" class="search" placeholder="${t('بحث بالاسم أو البريد...', 'Search by name or email...')}">${P.length ? html`<div class="tbl"><table><thead><tr><th>${t('الاسم', 'Name')}</th><th>${t('البريد', 'Email')}</th><th>${t('تسجيلات', 'Applications')}</th><th>${t('تاريخ الانضمام', 'Joined')}</th><th></th></tr></thead><tbody id="tb">
    ${P.map(p => html`<tr data-s="${(p.full_name + ' ' + p.email).toLowerCase()}"><td>${p.full_name || '—'}</td><td dir="ltr">${p.email}</td><td>${num(rc[p.id] || 0)}</td><td>${fmtDate(p.created_at)}</td><td><button class="btn o sm" data-j="${p.id}" type="button">${t('تحويل إلى محكّم', 'Make judge')}</button></td></tr>`)}</tbody></table></div>` : empty('لا يوجد مشاركون بعد.', 'No participants yet.')}`.toString();
  main.querySelector('#q')?.addEventListener('input', e => main.querySelectorAll('#tb tr').forEach(r => r.hidden = !r.dataset.s.includes(e.target.value.toLowerCase())));
  main.querySelectorAll('[data-j]').forEach(b => b.onclick = async () => {
    if (!confirm(t('تحويل هذا الحساب إلى محكّم؟', 'Convert this account to a judge?'))) return;
    const { error } = await sb.rpc('admin_set_role', { uid: b.dataset.j, new_role: 'judge' }); if (error) return toast(failMsg(error), false); participants(ctx, main);
  });
}

export async function judges(ctx, main) {
  top(ctx, 'المحكّمون', 'Judges');
  const J = await profiles('judge');
  main.innerHTML = html`${H('المحكّمون', 'Judges', t('المحكّمون يُدعَون من الإدارة فقط ولا يسجّلون بأنفسهم.', 'Judges are invited by administrators only; they cannot self-register.'))}
  <form id="inv" class="panel form" novalidate><h2>${t('دعوة محكّم', 'Invite a judge')}</h2><label>${t('الاسم', 'Name')}<input name="full_name" maxlength="100"></label><label>${t('البريد الإلكتروني', 'Email')}<input name="email" type="email" required dir="ltr" maxlength="254"></label>
    <button class="btn" type="submit">${t('إرسال الدعوة', 'Send invitation')}</button></form>
  ${J.length ? html`<div class="tbl"><table><thead><tr><th>${t('الاسم', 'Name')}</th><th>${t('البريد', 'Email')}</th><th></th></tr></thead><tbody>${J.map(p => html`<tr><td>${p.full_name || '—'}</td><td dir="ltr">${p.email}</td><td><button class="btn o sm danger" data-r="${p.id}" type="button">${t('سحب صلاحية التحكيم', 'Revoke judge role')}</button></td></tr>`)}</tbody></table></div>` : empty('لا يوجد محكّمون.', 'No judges yet.')}`.toString();
  const f = main.querySelector('#inv');
  f.onsubmit = async e => {
    e.preventDefault(); if (!f.email.checkValidity()) return toast(t('بريد غير صحيح.', 'Invalid email.'), false);
    f.querySelector('button').disabled = true;
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch('/api/invite-judge', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ email: f.email.value.trim(), full_name: f.full_name.value.trim() }) }).catch(() => null);
    f.querySelector('button').disabled = false;
    if (!res?.ok) return toast(t('تعذر إرسال الدعوة (تحقق من إعدادات الخادم).', 'Could not send the invitation (check server settings).'), false);
    toast(t('أُرسلت الدعوة.', 'Invitation sent.')); judges(ctx, main);
  };
  main.querySelectorAll('[data-r]').forEach(b => b.onclick = async () => {
    if (!confirm(t('سحب الصلاحية؟ ستبقى تقييماته المسلّمة.', 'Revoke? Submitted evaluations are kept.'))) return;
    const { error } = await sb.rpc('admin_set_role', { uid: b.dataset.r, new_role: 'participant' }); if (error) return toast(failMsg(error), false); judges(ctx, main);
  });
}

export async function events(ctx, main) { top(ctx, 'الفعاليات', 'Events'); await crudList(main, EVENT); }
export async function eventCreate(ctx, main) {
  top(ctx, 'فعالية جديدة', 'New event', [['الفعاليات', 'Events', '/admin/events']]);
  main.innerHTML = html`${H('فعالية جديدة', 'New event')}<div id="bx"></div>`.toString();
  await formView(main.querySelector('#bx'), { ...EVENT, defaults: {} }, null, ok => nav('/admin/events'));
}
export async function eventEdit(ctx, main) {
  const id = ctx.params.id, ev = await one(sb.from('events').select('*').eq('id', id).maybeSingle());
  if (!ev) return nf(ctx, main);
  top(ctx, 'تعديل فعالية', 'Edit event', [['الفعاليات', 'Events', '/admin/events']]);
  main.innerHTML = html`${H('تعديل: ' + ev.title_ar, 'Edit: ' + (ev.title_en || ev.title_ar))}<div id="bx"></div><div id="cr" class="panel"></div><div id="rg" class="panel"></div>`.toString();
  await formView(main.querySelector('#bx'), EVENT, id, ok => ok ? eventEdit(ctx, main) : nav('/admin/events'));
  await crudList(main.querySelector('#cr'), { table: 'criteria', ar: 'معايير التقييم لهذه الفعالية', en: 'Evaluation criteria for this event', where: [['event_id', id]], defaults: { event_id: id }, order: ['sort', true],
    cols: [{ k: 'name_ar', ar: 'المعيار', en: 'Criterion' }, { k: 'max_score', ar: 'الدرجة العظمى', en: 'Max score' }, { k: 'sort', ar: 'الترتيب', en: 'Order' }],
    fields: [S('name_ar', 'المعيار (عربي)', 'Criterion (Arabic)', { req: true }), S('name_en', 'المعيار (إنجليزي)', 'Criterion (English)'), S('max_score', 'الدرجة العظمى (1-100)', 'Max score (1-100)', { type: 'number', req: true, def: 10 }), S('sort', 'الترتيب', 'Order', { type: 'number', def: 0 })] });
  const [R, P] = await Promise.all([rows(sb.from('registrations').select('*').eq('event_id', id).order('created_at')), rows(sb.from('profiles').select('id,full_name,email'))]);
  const pm = Object.fromEntries(P.map(p => [p.id, p]));
  const box = main.querySelector('#rg');
  box.innerHTML = html`<h2>${t('طلبات التسجيل', 'Applications')}</h2>${R.length ? html`<div class="tbl"><table><thead><tr><th>${t('المشارك', 'Participant')}</th><th>${t('الحالة', 'Status')}</th><th></th></tr></thead><tbody>${R.map(r => html`<tr><td>${pm[r.participant_id]?.full_name || ''} <small dir="ltr">${pm[r.participant_id]?.email || ''}</small></td><td>${badge(r.status)}</td><td class="acts">
    <button class="btn sm" data-s="approved" data-id="${r.id}" type="button">${t('قبول', 'Approve')}</button><button class="btn o sm danger" data-s="rejected" data-id="${r.id}" type="button">${t('رفض', 'Reject')}</button></td></tr>`)}</tbody></table></div>` : empty('لا توجد طلبات.', 'No applications.')}`.toString();
  box.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => { const { error } = await sb.from('registrations').update({ status: b.dataset.s }).eq('id', b.dataset.id); if (error) return toast(failMsg(error), false); eventEdit(ctx, main); });
}

export async function assignments(ctx, main) { top(ctx, 'التكليفات', 'Assignments'); await crudList(main, ASSIGN); }
export async function schedules(ctx, main) { top(ctx, 'الجداول', 'Schedules'); await crudList(main, SCHED); }
export async function gallery(ctx, main) { top(ctx, 'المعرض', 'Gallery'); await crudList(main, GAL); }
export async function settings(ctx, main) { top(ctx, 'الإعدادات', 'Settings'); await crudList(main, SETT); }
export async function content(ctx, main) {
  top(ctx, 'محتوى الموقع', 'Site content');
  const tab = TABS[ctx.query.tab] ? ctx.query.tab : 'programs';
  main.innerHTML = html`${H('محتوى الموقع', 'Site content')}<div class="tabs">${Object.entries(TABS).map(([k, c]) => html`<a class="${k === tab ? 'on' : ''}" href="/admin/content?tab=${k}">${t(c.ar, c.en)}</a>`)}</div><div id="tb"></div>`.toString();
  await crudList(main.querySelector('#tb'), TABS[tab]);
}

export async function evaluations(ctx, main) {
  top(ctx, 'التقييمات', 'Evaluations');
  const [EV, A, P, E, C] = await Promise.all([rows(sb.from('evaluations').select('*').order('updated_at', { ascending: false })), rows(sb.from('assignments').select('*')), rows(sb.from('profiles').select('id,full_name,email')), rows(sb.from('events').select('id,title_ar,title_en')), rows(sb.from('criteria').select('*'))]);
  const am = Object.fromEntries(A.map(a => [a.id, a])), pm = Object.fromEntries(P.map(p => [p.id, p.full_name || p.email])), em = Object.fromEntries(E.map(e => [e.id, e])), cm = Object.fromEntries(C.map(c => [c.id, c]));
  main.innerHTML = html`${H('التقييمات', 'Evaluations', t('هوية المحكّم ظاهرة للمشرف فقط.', 'Judge identity is visible to administrators only.'))}${EV.length ? html`<div class="tbl"><table><thead><tr><th>${t('الفعالية', 'Event')}</th><th>${t('المحكّم', 'Judge')}</th><th>${t('المشارك', 'Participant')}</th><th>${t('الدرجات', 'Scores')}</th><th>${t('الحالة', 'Status')}</th></tr></thead><tbody>
    ${EV.map(v => { const a = am[v.assignment_id] || {}; return html`<tr><td>${pick(em[a.event_id], 'title')}</td><td>${pm[a.judge_id]}</td><td>${pm[a.participant_id]}</td><td>${Object.entries(v.scores).map(([k, s]) => pick(cm[k], 'name') + ': ' + s).join(' | ')}<br><small>${v.comment || ''}</small></td><td>${badge(v.status)}</td></tr>`; })}</tbody></table></div>` : empty('لا توجد تقييمات.', 'No evaluations yet.')}`.toString();
}

export async function results(ctx, main) {
  top(ctx, 'النتائج', 'Results');
  const E = await rows(sb.from('events').select('id,title_ar,title_en').order('created_at', { ascending: false }));
  const eid = ctx.query.event || E[0]?.id;
  const [R, P] = eid ? await Promise.all([rows(sb.from('results').select('*').eq('event_id', eid).order('rank')), rows(sb.from('profiles').select('id,full_name,email'))]) : [[], []];
  const pm = Object.fromEntries(P.map(p => [p.id, p.full_name || p.email]));
  main.innerHTML = html`${H('النتائج', 'Results', t('احسب النتائج من التقييمات المُسلَّمة، ثم انشرها للمشاركين.', 'Compute from submitted evaluations, then publish to participants.'))}
  ${E.length ? html`<div class="row"><select id="ev">${E.map(e => html`<option value="${e.id}" ${e.id === eid ? 'selected' : ''}>${pick(e, 'title')}</option>`)}</select><button class="btn" id="calc" type="button">${t('احسب النتائج', 'Compute results')}</button>
    <button class="btn o" id="pub" type="button">${t('نشر الكل', 'Publish all')}</button><button class="btn o" id="unp" type="button">${t('إخفاء الكل', 'Unpublish all')}</button></div>` : empty('أنشئ فعالية أولًا.', 'Create an event first.')}
  ${R.length ? html`<div class="tbl"><table><thead><tr><th>${t('الترتيب', 'Rank')}</th><th>${t('المشارك', 'Participant')}</th><th>${t('المجموع', 'Total')}</th><th>${t('النشر', 'Published')}</th></tr></thead><tbody>${R.map(r => html`<tr><td>${num(r.rank ?? '—')}</td><td>${pm[r.participant_id]}</td><td>${num(r.total ?? '—')}</td><td>${r.published ? '✓' : '—'}</td></tr>`)}</tbody></table></div>` : eid ? empty('لا توجد نتائج محسوبة لهذه الفعالية.', 'No computed results for this event.') : ''}`.toString();
  main.querySelector('#ev')?.addEventListener('change', e => nav('/admin/results?event=' + e.target.value));
  const setPub = async v => { const { error } = await sb.from('results').update({ published: v }).eq('event_id', eid); if (error) return toast(failMsg(error), false); toast(t('تم.', 'Done.')); results(ctx, main); };
  main.querySelector('#calc')?.addEventListener('click', async () => { const { error } = await sb.rpc('compute_results', { p_event: eid }); if (error) return toast(failMsg(error), false); toast(t('حُسبت النتائج.', 'Results computed.')); results(ctx, main); });
  main.querySelector('#pub')?.addEventListener('click', () => confirm(t('نشر النتائج والتقييمات للمشاركين؟', 'Publish results and evaluations to participants?')) && setPub(true));
  main.querySelector('#unp')?.addEventListener('click', () => setPub(false));
}

export async function reports(ctx, main) {
  top(ctx, 'التقارير', 'Reports');
  const [E, R, A, EV, RS, P] = await Promise.all([rows(sb.from('events').select('id,title_ar,title_en')), rows(sb.from('registrations').select('event_id,participant_id,status')), rows(sb.from('assignments').select('id,event_id')), rows(sb.from('evaluations').select('assignment_id,status')), rows(sb.from('results').select('*')), rows(sb.from('profiles').select('id,full_name,email'))]);
  const am = Object.fromEntries(A.map(a => [a.id, a])), pm = Object.fromEntries(P.map(p => [p.id, p]));
  const line = e => { const r = R.filter(x => x.event_id === e.id), n = s => r.filter(x => x.status === s).length, ev = EV.filter(v => am[v.assignment_id]?.event_id === e.id);
    return [pick(e, 'title'), r.length, n('pending'), n('approved'), n('rejected'), A.filter(a => a.event_id === e.id).length, ev.filter(v => v.status === 'submitted').length]; };
  const data = E.map(line);
  main.innerHTML = html`${H('التقارير', 'Reports')}<div class="row"><button class="btn o" id="c1" type="button">${t('تصدير التسجيلات CSV', 'Export registrations CSV')}</button><button class="btn o" id="c2" type="button">${t('تصدير النتائج CSV', 'Export results CSV')}</button></div>
  ${data.length ? html`<div class="tbl"><table><thead><tr><th>${t('الفعالية', 'Event')}</th><th>${t('الطلبات', 'Applications')}</th><th>${t('قيد المراجعة', 'Pending')}</th><th>${t('مقبول', 'Approved')}</th><th>${t('مرفوض', 'Rejected')}</th><th>${t('التكليفات', 'Assignments')}</th><th>${t('تقييمات مُسلَّمة', 'Submitted evals')}</th></tr></thead><tbody>${data.map(d => html`<tr>${d.map(c => html`<td>${typeof c === 'number' ? num(c) : c}</td>`)}</tr>`)}</tbody></table></div>` : empty('لا توجد بيانات.', 'No data.')}`.toString();
  const em = Object.fromEntries(E.map(e => [e.id, pick(e, 'title')]));
  main.querySelector('#c1').onclick = () => csv('registrations.csv', ['event', 'name', 'email', 'status'], R.map(r => [em[r.event_id], pm[r.participant_id]?.full_name, pm[r.participant_id]?.email, r.status]));
  main.querySelector('#c2').onclick = () => csv('results.csv', ['event', 'name', 'total', 'rank', 'published'], RS.map(r => [em[r.event_id], pm[r.participant_id]?.full_name, r.total, r.rank, r.published]));
}
