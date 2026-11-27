// محرك إدارة عام: قائمة + نموذج إضافة/تعديل لأي جدول، دون كتابة كود لكل صفحة
import { sb, html, t, pick, rows, one, toast, failMsg, fmtDate } from './core.js';
const lbl = r => r.full_name || r.title_ar || r.name_ar || r.email || r.slug || r.id;
const toLocal = v => { if (!v) return ''; const d = new Date(v), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
async function loadRef(f) {
  let q = sb.from(f.ref.table).select('*'); if (f.ref.eq) q = q.eq(...f.ref.eq);
  const R = await rows(q.limit(1000)); return R.map(r => [r.id, (f.ref.label || lbl)(r)]);
}
const field = (f, v, opts, editing) => {
  if (f.type === 'hidden') return '';
  const n = f.k, req = f.req ? 'required' : '', dis = f.createOnly && editing ? 'disabled' : '', L = t(f.ar, f.en);
  let inp;
  if (f.type === 'textarea') inp = html`<textarea name="${n}" ${req} maxlength="${f.max || 5000}">${v ?? ''}</textarea>`;
  else if (f.type === 'json') inp = html`<textarea name="${n}" dir="ltr" ${req}>${v == null ? '' : JSON.stringify(v, null, 1)}</textarea>`;
  else if (f.type === 'bool') return html`<label class="chk"><input type="checkbox" name="${n}" ${v ? 'checked' : ''}><span>${L}</span></label>`;
  else if (f.type === 'select' || f.type === 'ref') {
    const O = f.type === 'ref' ? opts : f.opts.map(o => [o[0], t(o[1], o[2])]);
    inp = html`<select name="${n}" ${req} ${dis}>${f.req ? '' : html`<option value="">—</option>`}${O.map(([k, l]) => html`<option value="${k}" ${String(v) === String(k) ? 'selected' : ''}>${l}</option>`)}</select>`;
  } else inp = html`<input name="${n}" type="${f.type === 'datetime' ? 'datetime-local' : f.type || 'text'}" ${req} ${dis} ${f.type === 'number' ? 'step="any"' : ''} maxlength="${f.max || 500}" value="${f.type === 'datetime' ? toLocal(v) : (v ?? '')}" ${f.ltr || f.type === 'url' ? 'dir=ltr' : ''}>`;
  return html`<label>${L}${inp}</label>`;
};

export async function formView(box, cfg, id, done) {
  const pk = cfg.pk || 'id';
  const row = id ? await one(sb.from(cfg.table).select('*').eq(pk, id).maybeSingle()) : null;
  const maps = {}; for (const f of cfg.fields.filter(f => f.type === 'ref')) maps[f.k] = await loadRef(f);
  box.innerHTML = html`<form class="panel form" novalidate>${cfg.fields.map(f => field(f, row ? row[f.k] : cfg.defaults?.[f.k] ?? f.def, maps[f.k], !!row))}
    <div class="row"><button class="btn" type="submit">${t('حفظ', 'Save')}</button><button class="btn o" type="button" data-cancel>${t('إلغاء', 'Cancel')}</button></div></form>`.toString();
  const form = box.querySelector('form');
  box.querySelector('[data-cancel]').onclick = () => done(false);
  form.onsubmit = async e => {
    e.preventDefault(); const p = {};
    for (const f of cfg.fields) {
      if (f.type === 'hidden' || (f.createOnly && row)) continue;
      const el = form.elements[f.k]; if (!el) continue;
      let v;
      if (f.type === 'bool') v = el.checked;
      else {
        v = el.value.trim(); if (v === '') v = f.req ? '' : null;
        if (v !== null && f.type === 'number') v = Number(v);
        if (v && f.type === 'datetime') v = new Date(v).toISOString();
        if (v !== null && f.type === 'json') { try { v = JSON.parse(v); } catch { return toast(t('صيغة JSON غير صحيحة.', 'Invalid JSON.'), false); } }
      }
      p[f.k] = v;
    }
    if (!row) Object.assign(p, cfg.defaults || {});
    const { error } = row ? await sb.from(cfg.table).update(p).eq(pk, id) : await sb.from(cfg.table).insert(p);
    if (error) return toast(failMsg(error), false);
    toast(t('تم الحفظ.', 'Saved.')); done(true);
  };
}

export async function crudList(main, cfg) {
  const pk = cfg.pk || 'id', maps = {};
  for (const f of cfg.fields.filter(f => f.type === 'ref')) maps[f.k] = Object.fromEntries(await loadRef(f));
  let q = sb.from(cfg.table).select('*'); (cfg.where || []).forEach(([k, v]) => q = q.eq(k, v));
  if (cfg.order) q = q.order(cfg.order[0], { ascending: cfg.order[1] !== false });
  const R = await rows(q.limit(500));
  const cell = (c, r) => c.f ? c.f(r, maps) : maps[c.k] ? maps[c.k][r[c.k]] || '' : typeof r[c.k] === 'boolean' ? (r[c.k] ? '✓' : '—') : /(_at|_date|starts|ends|^apply_|taken_on)/.test(c.k) ? fmtDate(r[c.k], c.k !== 'taken_on') : String(r[c.k] ?? '').slice(0, 90);
  main.innerHTML = html`<div class="row between"><h2>${t(cfg.ar, cfg.en)}</h2>${cfg.noCreate ? '' : cfg.link ? html`<a class="btn sm" href="${cfg.link.create}">${t('+ إضافة', '+ Add')}</a>` : html`<button class="btn sm" data-new type="button">${t('+ إضافة', '+ Add')}</button>`}</div>
    <div class="cf"></div>${R.length ? html`<div class="tbl"><table><thead><tr>${cfg.cols.map(c => html`<th>${t(c.ar, c.en)}</th>`)}<th></th></tr></thead><tbody>
    ${R.map(r => html`<tr>${cfg.cols.map(c => html`<td>${cell(c, r)}</td>`)}<td class="acts">${cfg.link ? html`<a class="btn o sm" href="${cfg.link.edit(r[pk])}">${t('تعديل', 'Edit')}</a>` : html`<button class="btn o sm" data-edit="${r[pk]}" type="button">${t('تعديل', 'Edit')}</button>`}${cfg.noDelete ? '' : html`<button class="btn o sm danger" data-del="${r[pk]}" type="button">${t('حذف', 'Delete')}</button>`}</td></tr>`)}</tbody></table></div>` : html`<p class="muted box">${t('لا توجد سجلات.', 'No records.')}</p>`}`.toString();
  const refresh = () => crudList(main, cfg), box = main.querySelector('.cf');
  const open = id => formView(box, cfg, id, ok => { box.innerHTML = ''; if (ok) refresh(); });
  main.querySelector('[data-new]')?.addEventListener('click', () => open(null));
  main.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { open(b.dataset.edit); box.scrollIntoView({ behavior: 'smooth' }); });
  main.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm(t('حذف هذا السجل نهائيًا؟', 'Delete this record permanently?'))) return;
    const { error } = await sb.from(cfg.table).delete().eq(pk, b.dataset.del); if (error) return toast(failMsg(error), false); toast(t('تم الحذف.', 'Deleted.')); refresh();
  });
}
