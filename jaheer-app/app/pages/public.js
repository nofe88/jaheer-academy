// الصفحات العامة: الرئيسية، عن جهير، البرامج، الماراثون، الفعاليات، المعرض، التواصل
import { sb, html, t, pick, rows, one, setting, page, fmtDate, sloganHtml, badge, regState, safeUrl, state, dash } from '../core.js';
const head = (ar, en, lead) => html`<section class="phead"><div class="in"><h1>${t(ar, en)}</h1>${lead ? html`<p class="lead">${lead}</p>` : ''}</div></section>`;
const sec = (...c) => html`<section class="in sec">${c}</section>`;
const evCard = e => html`<a class="card ev" href="/events/${e.slug}"><div class="row">${badge(regState(e))}<small>${fmtDate(e.event_date)}</small></div><h3>${pick(e, 'title')}</h3><p>${pick(e, 'description').slice(0, 140)}</p></a>`;
const nf = async (ctx, main) => (await import('./errors.js')).notFound(ctx, main);
const lines = s => (s || '').split(/\n+/).filter(Boolean).map(x => html`<p>${x}</p>`);

export async function home(ctx, main) {
  const [ev, an, stats] = await Promise.all([
    rows(sb?.from('events').select('*').eq('published', true).in('status', ['upcoming', 'open']).order('event_date').limit(3)),
    rows(sb?.from('announcements').select('*').eq('published', true).order('created_at', { ascending: false }).limit(3)),
    setting('stats')]);
  const go = [['/about', 'عن جهير', 'About Jaheer', 'من نحن ورسالتنا ورؤيتنا.', 'Who we are, our mission and vision.'], ['/programs', 'البرامج', 'Programs', 'ألوان الإلقاء الأربعة.', 'The four speaking colors.'],
    ['/marathon', 'ماراثون جَهير', 'Jaheer Marathon', 'عشرة متحدثين نحو المسرح الكبير.', 'Ten speakers heading to the grand stage.'], ['/gallery', 'المعرض', 'Gallery', 'صور وفيديوهات الفعاليات.', 'Photos and videos from our events.']];
  main.innerHTML = html`
  <section class="hero"><div class="in hero-in"><span class="ey">${t('أكاديمية للإلقاء والخطابة', 'Public speaking & oratory academy')}</span>
    <h1>${t('أكاديمية جَهير', 'Jaheer Academy')}</h1><p class="tg">${t('للإلقاء والخطابة', 'for Public Speaking & Oratory')}</p>${sloganHtml()}
    <div class="cta"><a class="btn" href="/programs">${t('برامجنا', 'Our programs')}</a><a class="btn o" href="/marathon">${t('ماراثون جَهير', 'Jaheer Marathon')}</a></div></div></section>
  ${Array.isArray(stats) && stats.length ? html`<div class="stats"><div class="in sr">${stats.map(s => html`<div><b>${s.n}</b><span>${t(s.ar, s.en)}</span><small>${t(s.ar_note, s.en_note)}</small></div>`)}</div></div>` : ''}
  ${sec(html`<h2>${t('فعاليات مميزة', 'Featured events')}</h2>`, ev.length ? html`<div class="grid3">${ev.map(evCard)}</div><p><a class="more" href="/events">${t('كل الفعاليات ›', 'All events ›')}</a></p>` : html`<p class="muted">${t('لا توجد فعاليات معلنة حاليًا.', 'No announced events right now.')}</p>`)}
  ${sec(html`<h2>${t('إعلانات مهمة', 'Announcements')}</h2>`, an.length ? html`<div class="grid3">${an.map(a => html`<article class="card"><small>${fmtDate(a.created_at)}</small><h3>${pick(a, 'title')}</h3><p>${pick(a, 'body')}</p></article>`)}</div>` : html`<p class="muted">${t('لا توجد إعلانات حاليًا.', 'No announcements right now.')}</p>`)}
  ${sec(html`<h2>${t('استكشف', 'Explore')}</h2>`, html`<div class="grid4">${go.map(g => html`<a class="card nav-card" href="${g[0]}"><h3>${t(g[1], g[2])}</h3><p>${t(g[3], g[4])}</p></a>`)}</div>`)}`.toString();
}

export async function about(ctx, main) {
  ctx.crumbs = [['الرئيسية', 'Home', '/'], ['عن جهير', 'About']];
  const keys = ['about_who', 'about_vision', 'about_mission', 'about_values', 'about_journey'];
  const P = Object.fromEntries((await rows(sb?.from('pages_content').select('*').in('key', keys))).map(r => [r.key, r]));
  const B = [['من نحن', 'Who we are', 'about_who'], ['رؤيتنا', 'Our vision', 'about_vision'], ['رسالتنا', 'Our mission', 'about_mission'], ['قيمنا', 'Our values', 'about_values'], ['مسيرتنا وإنجازاتنا', 'Our journey & achievements', 'about_journey']];
  main.innerHTML = html`${head('عن جهير', 'About Jaheer')}<section class="in sec"><div class="about-grid">${B.map(([a, e, k]) => html`<article class="block"><h2>${t(a, e)}</h2>${lines(t(P[k]?.ar, P[k]?.en))}</article>`)}</div></section>`.toString();
}

export async function programs(ctx, main) {
  ctx.crumbs = [['الرئيسية', 'Home', '/'], ['البرامج', 'Programs']];
  const L = await rows(sb?.from('programs').select('*').order('sort'));
  main.innerHTML = html`${head('البرامج', 'Speaking programs', t('أربعة ألوان للإلقاء تمثل مراحل رحلة المتحدث.', 'Four speaking colors that mark the speaker’s journey.'))}
  <section class="in sec"><div class="grid2">${L.map((p, i) => html`<a class="card prog" href="/programs/${p.slug}"><span class="n">${i + 1}</span><h3>${pick(p, 'name')}</h3><p>${pick(p, 'description').slice(0, 160)}</p><span class="more">${t('التفاصيل ›', 'Details ›')}</span></a>`)}</div></section>`.toString();
}

export async function program(ctx, main) {
  const p = await one(sb?.from('programs').select('*').eq('slug', ctx.params.slug).maybeSingle());
  if (!p) return nf(ctx, main);
  ctx.title = [p.name_ar, p.name_en];
  ctx.crumbs = [['الرئيسية', 'Home', '/'], ['البرامج', 'Programs', '/programs'], [p.name_ar, p.name_en]];
  main.innerHTML = html`${head(p.name_ar, p.name_en)}<section class="in sec"><div class="about-grid">
    <article class="block"><h2>${t('وصف البرنامج', 'Description')}</h2>${lines(pick(p, 'description'))}</article>
    <article class="block"><h2>${t('الأهداف', 'Objectives')}</h2>${lines(pick(p, 'objectives'))}</article>
    <article class="block"><h2>${t('مخرجات التعلم', 'Learning outcomes')}</h2>${lines(pick(p, 'outcomes'))}</article></div>
    <p><a class="btn o" href="/programs">${t('كل البرامج', 'All programs')}</a></p></section>`.toString();
}

export async function marathon(ctx, main) {
  ctx.crumbs = [['الرئيسية', 'Home', '/'], ['ماراثون جَهير', 'Jaheer Marathon']];
  const [pp, ev, gal, intro] = await Promise.all([
    rows(sb?.from('marathon_participants').select('*').eq('published', true).order('position')),
    rows(sb?.from('events').select('*').eq('published', true).eq('category', 'marathon').order('event_date')),
    rows(sb?.from('gallery_items').select('*').eq('published', true).eq('section', 'marathon').order('taken_on', { ascending: false })),
    page('marathon_intro')]);
  main.innerHTML = html`${head('ماراثون جَهير', 'Jaheer Marathon', t(intro.ar, intro.en))}
  ${sec(html`<h2>${t('المتحدثون العشرة', 'The ten speakers')}</h2><p class="muted">${t('المشاركون المعتمدون فقط — الماراثون ليس مفتوح التسجيل.', 'Authorized participants only — the marathon is not open for registration.')}</p>`,
    pp.length ? html`<div class="grid3">${pp.map(p => html`<article class="card sp-card"><h3>${pick(p, 'name')}</h3><small>${pick(p, 'degree')}</small><p>${pick(p, 'bio')}</p>
      <details><summary>${t('رحلته وإنجازاته', 'Journey & achievements')}</summary><h4>${t('الرحلة', 'Journey')}</h4>${lines(pick(p, 'journey'))}<h4>${t('الإنجازات', 'Achievements')}</h4>${lines(pick(p, 'achievements'))}</details></article>`)}</div>` : html`<p class="muted">${t('سيُعلن عن المتحدثين العشرة قريبًا.', 'The ten speakers will be announced soon.')}</p>`)}
  ${sec(html`<h2>${t('جدول الماراثون', 'Marathon schedule')}</h2>`, ev.length ? html`<div class="grid3">${ev.map(evCard)}</div>` : html`<p class="muted">${t('سيُعلن الجدول قريبًا.', 'The schedule will be announced soon.')}</p>`)}
  ${sec(html`<h2>${t('الأنشطة والصور', 'Activities & photos')}</h2>`, gal.length ? html`<div class="gal">${gal.map(g => mediaTag(g))}</div>` : html`<p class="muted">${t('ستُضاف الصور قريبًا.', 'Photos will be added soon.')}</p>`)}`.toString();
}
const mediaTag = g => g.kind === 'video' ? html`<figure><video controls preload="none" src="${safeUrl(g.url)}"></video><figcaption>${pick(g, 'caption')}</figcaption></figure>` : html`<figure><img loading="lazy" src="${safeUrl(g.url)}" alt="${pick(g, 'caption')}"><figcaption>${pick(g, 'caption')}</figcaption></figure>`;

export async function events(ctx, main) {
  ctx.crumbs = [['الرئيسية', 'Home', '/'], ['الفعاليات', 'Events']];
  const L = await rows(sb?.from('events').select('*').eq('published', true).order('event_date', { ascending: false }));
  const up = L.filter(e => e.status !== 'completed'), past = L.filter(e => e.status === 'completed');
  main.innerHTML = html`${head('الفعاليات', 'Events')}
  ${sec(html`<h2>${t('الفعاليات القادمة', 'Upcoming events')}</h2>`, up.length ? html`<div class="grid3">${up.map(evCard)}</div>` : html`<p class="muted">${t('لا توجد فعاليات قادمة حاليًا.', 'No upcoming events right now.')}</p>`)}
  ${sec(html`<h2>${t('فعاليات سابقة', 'Previous events')}</h2>`, past.length ? html`<div class="grid3">${past.map(evCard)}</div>` : html`<p class="muted">${t('لا توجد فعاليات سابقة.', 'No previous events.')}</p>`)}`.toString();
}

export async function event(ctx, main) {
  const e = await one(sb?.from('events').select('*').eq('slug', ctx.params.slug).eq('published', true).maybeSingle());
  if (!e) return nf(ctx, main);
  ctx.title = [e.title_ar, e.title_en || e.title_ar];
  ctx.crumbs = [['الرئيسية', 'Home', '/'], ['الفعاليات', 'Events', '/events'], [e.title_ar, e.title_en || e.title_ar]];
  const st = regState(e), me = state.me;
  const cta = st === 'open' ? (me?.role === 'participant' ? html`<a class="btn" href="/participant/events">${t('سجّل من بوابة المشارك', 'Register in the participant portal')}</a>` : !me ? html`<a class="btn" href="/register">${t('أنشئ حساب مشارك للتسجيل', 'Create a participant account to apply')}</a>` : '') : '';
  main.innerHTML = html`${head(e.title_ar, e.title_en || e.title_ar)}<section class="in sec"><div class="detail">
    <div class="facts"><div>${badge(st)}</div>
      <dl><dt>${t('موعد الفعالية', 'Event date')}</dt><dd>${fmtDate(e.event_date, true) || '—'}</dd><dt>${t('المكان', 'Venue')}</dt><dd>${pick(e, 'venue') || '—'}</dd>
      <dt>${t('فتح التقديم', 'Applications open')}</dt><dd>${fmtDate(e.apply_open, true) || '—'}</dd><dt>${t('إغلاق التقديم', 'Applications close')}</dt><dd>${fmtDate(e.apply_close, true) || '—'}</dd></dl>${cta}</div>
    <div class="block">${lines(pick(e, 'description'))}</div></div></section>`.toString();
}

export async function gallery(ctx, main) {
  ctx.crumbs = [['الرئيسية', 'Home', '/'], ['المعرض', 'Gallery']];
  const [G, E] = await Promise.all([rows(sb?.from('gallery_items').select('*').eq('published', true).order('taken_on', { ascending: false })), rows(sb?.from('events').select('id,title_ar,title_en').eq('published', true))]);
  const name = Object.fromEntries(E.map(e => [e.id, pick(e, 'title')]));
  const groups = new Map(); G.forEach(g => { const k = g.event_id || 'none'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(g); });
  main.innerHTML = html`${head('المعرض', 'Gallery')}<section class="in sec">${G.length ? [...groups].map(([k, items]) => html`<h2 class="gh">${k === 'none' ? t('عام', 'General') : name[k] || ''}</h2><p class="muted">${fmtDate(items[0].taken_on)}</p><div class="gal">${items.map(mediaTag)}</div>`) : html`<p class="muted">${t('ستُضاف الصور والفيديوهات قريبًا.', 'Photos and videos will be added soon.')}</p>`}</section>`.toString();
}

export async function contact(ctx, main) {
  ctx.crumbs = [['الرئيسية', 'Home', '/'], ['تواصل معنا', 'Contact']];
  const [mail, soc] = await Promise.all([setting('contact_email'), setting('social')]);
  main.innerHTML = html`${head('تواصل معنا', 'Contact us')}<section class="in sec"><div class="about-grid">
    <article class="block"><h2>${t('البريد الإلكتروني', 'Email')}</h2>${mail ? html`<p><a class="btn" href="mailto:${mail}">${mail}</a></p>` : html`<p class="muted">${t('سيُضاف البريد الرسمي قريبًا.', 'The official email will be added soon.')}</p>`}</article>
    <article class="block"><h2>${t('حساباتنا', 'Social media')}</h2>${Array.isArray(soc) && soc.length ? html`<p>${soc.map(s => html`<a class="btn o sm" target="_blank" rel="noopener noreferrer" href="${safeUrl(s.url)}">${s.label}</a> `)}</p>` : html`<p class="muted">${t('ستُضاف الروابط الرسمية قريبًا.', 'Official links will be added soon.')}</p>`}</article></div></section>`.toString();
}
