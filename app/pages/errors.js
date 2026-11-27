import { html, t } from '../core.js';
const box = (code, ar, ae, a1, e1) => html`<div class="in sec err-pg"><div class="code">${code}</div><h1>${t(ar, ae)}</h1><p class="lead">${t(a1, e1)}</p><p><a class="btn" href="/">${t('العودة للرئيسية', 'Back to home')}</a></p></div>`;
export const notFound = (ctx, main) => { main.innerHTML = box('404', 'الصفحة غير موجودة', 'Page not found', 'الرابط الذي فتحته غير صحيح أو أُزيلت صفحته.', 'The link you opened is invalid or the page was removed.').toString(); };
export const forbidden = (ctx, main) => { main.innerHTML = box('403', 'غير مصرّح بالدخول', 'Access denied', 'ليست لديك صلاحية لفتح هذه الصفحة.', 'You do not have permission to open this page.').toString(); };
