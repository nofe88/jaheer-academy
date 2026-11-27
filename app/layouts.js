// أربعة تخطيطات مستقلة: عام، مشارك، محكّم، مشرف
import { html, t, lang, setLang, state, sb, dash, configured } from './core.js';
const LOGO = '/assets/logo/jaheer.png';
const here = () => location.pathname.replace(/\/+$/, '') || '/';
const active = p => here() === p || (p !== '/' && here().startsWith(p + '/'));
const langBtn = () => html`<button class="lg" data-lang type="button">${lang === 'ar' ? 'English' : 'العربية'}</button>`;
const brand = cls => html`<a href="/" class="brand ${cls || ''}"><img src="${LOGO}" alt="${t('أكاديمية جَهير', 'Jaheer Academy')}"></a>`;
const links = (L, cls) => L.map(([p, a, e]) => html`<a href="${p}" class="${cls} ${active(p) ? 'on' : ''}">${t(a, e)}</a>`);
const setup = () => configured ? '' : html`<div class="setup" role="alert">${t('لم يتم ربط قاعدة البيانات بعد (assets/config.js).', 'Database is not connected yet (assets/config.js).')}</div>`;

function wire(root) {
  root.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { setLang(lang === 'ar' ? 'en' : 'ar'); window.dispatchEvent(new Event('route')); });
  root.querySelectorAll('[data-logout]').forEach(b => b.onclick = async () => { await sb?.auth.signOut(); location.replace('/login'); });
  root.querySelectorAll('[data-menu]').forEach(b => b.onclick = () => document.body.classList.toggle('menu-open'));
}
const finish = root => { wire(root); return root.querySelector('#main'); };
export const renderCrumbs = (list, ctx) => {
  const el = document.querySelector('#crumbs'); if (!el || !list) return;
  el.innerHTML = html`<nav aria-label="breadcrumb">${list.map(([a, e, h], i) => h ? html`<a href="${h}">${t(a, e)}</a><span>›</span>` : html`<b>${t(a, e)}</b>`)}</nav>`.toString();
};

/* ===== عام ===== */
export function publicLayout(root) {
  const L = [['/', 'الرئيسية', 'Home'], ['/about', 'عن جهير', 'About'], ['/programs', 'البرامج', 'Programs'], ['/marathon', 'الماراثون', 'Marathon'], ['/events', 'الفعاليات', 'Events'], ['/gallery', 'المعرض', 'Gallery'], ['/contact', 'تواصل معنا', 'Contact']];
  root.innerHTML = html`<div class="pub">${setup()}
  <header class="pnav"><div class="pnv">${brand()}<nav class="plinks">${links(L, 'pl')}</nav>
    <div class="pact">${langBtn()}${state.me ? html`<a class="btn sm" href="${dash[state.me.role]}">${t('لوحتي', 'Dashboard')}</a>` : html`<a class="btn sm" href="/login">${t('دخول', 'Sign in')}</a>`}<button class="mb" data-menu type="button" aria-label="menu">☰</button></div></div></header>
  <div id="crumbs" class="crumbs"></div><main id="main"></main>
  <footer class="pfoot"><div class="in pf">
    <div>${brand('f')}${html`<p class="small">${t('أكاديمية جَهير للإلقاء والخطابة', 'Jaheer Academy for Public Speaking & Oratory')}</p>`}</div>
    <div><h4>${t('روابط', 'Links')}</h4>${links(L.slice(1), 'fl')}</div>
    <div><h4>${t('الحساب', 'Account')}</h4><a class="fl" href="/login">${t('تسجيل الدخول', 'Sign in')}</a><a class="fl" href="/register">${t('تسجيل المشاركين', 'Participant registration')}</a></div>
  </div><p class="cp">© ${t('أكاديمية جَهير', 'Jaheer Academy')}</p></footer></div>`.toString();
  return finish(root);
}

/* ===== المشارك: شريط جانبي فاتح ===== */
export function participantLayout(root) {
  const L = [['/participant/dashboard', 'لوحة التحكم', 'Dashboard'], ['/participant/profile', 'ملفي', 'Profile'], ['/participant/events', 'الفعاليات', 'Events'], ['/participant/registrations', 'تسجيلاتي', 'Registrations'], ['/participant/schedule', 'الجدول', 'Schedule'], ['/participant/evaluations', 'التقييمات', 'Evaluations'], ['/participant/results', 'النتائج', 'Results']];
  root.innerHTML = html`<div class="shell sp">${setup()}<aside class="side">${brand()}<div class="who">${state.me.full_name || state.me.email}<small>${t('بوابة المشارك', 'Participant portal')}</small></div>
    <nav>${links(L, 'sl')}</nav><div class="sidefoot">${langBtn()}<button class="lg" data-logout type="button">${t('خروج', 'Sign out')}</button><a class="lnk" href="/">${t('الموقع العام', 'Public site')}</a></div></aside>
    <div class="body"><div class="bar"><button class="mb" data-menu type="button" aria-label="menu">☰</button><div id="crumbs" class="crumbs"></div></div><main id="main"></main></div></div>`.toString();
  return finish(root);
}

/* ===== المحكّم: شريط علوي بتبويبات ===== */
export function judgeLayout(root) {
  const L = [['/judge/dashboard', 'الرئيسية', 'Home'], ['/judge/assignments', 'التكليفات', 'Assignments'], ['/judge/submissions', 'تقييماتي', 'My evaluations'], ['/judge/profile', 'ملفي', 'Profile']];
  root.innerHTML = html`<div class="shell sj">${setup()}<header class="jbar"><div class="jin">${brand()}<span class="jtag">${t('بوابة المحكّمين', 'Judges portal')}</span><nav class="jtabs">${links(L, 'jt')}</nav>
    <div class="jact">${langBtn()}<button class="lg" data-logout type="button">${t('خروج', 'Sign out')}</button></div></div></header>
    <div class="jwrap"><div id="crumbs" class="crumbs"></div><main id="main"></main></div></div>`.toString();
  return finish(root);
}

/* ===== المشرف: شريط جانبي داكن بمجموعات ===== */
export function adminLayout(root) {
  const G = [[['الإدارة', 'Overview'], [['/admin/dashboard', 'لوحة التحكم', 'Dashboard'], ['/admin/reports', 'التقارير', 'Reports']]],
    [['الأشخاص', 'People'], [['/admin/participants', 'المشاركون', 'Participants'], ['/admin/judges', 'المحكّمون', 'Judges']]],
    [['الفعاليات', 'Events'], [['/admin/events', 'الفعاليات', 'Events'], ['/admin/schedules', 'الجداول', 'Schedules'], ['/admin/assignments', 'التكليفات', 'Assignments'], ['/admin/evaluations', 'التقييمات', 'Evaluations'], ['/admin/results', 'النتائج', 'Results']]],
    [['المحتوى', 'Content'], [['/admin/content', 'محتوى الموقع', 'Site content'], ['/admin/gallery', 'المعرض', 'Gallery'], ['/admin/settings', 'الإعدادات', 'Settings']]]];
  root.innerHTML = html`<div class="shell sa">${setup()}<aside class="aside"><div class="abrand">${brand()}<small>${t('لوحة الإدارة', 'Admin console')}</small></div>
    <nav>${G.map(([h, L]) => html`<div class="grp">${t(...h)}</div>${links(L, 'al')}`)}</nav>
    <div class="sidefoot">${langBtn()}<button class="lg" data-logout type="button">${t('خروج', 'Sign out')}</button><a class="lnk" href="/">${t('الموقع العام', 'Public site')}</a></div></aside>
    <div class="body"><div class="bar"><button class="mb" data-menu type="button" aria-label="menu">☰</button><div id="crumbs" class="crumbs"></div><span class="me">${state.me.email}</span></div><main id="main"></main></div></div>`.toString();
  return finish(root);
}
