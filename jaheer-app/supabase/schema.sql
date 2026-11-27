-- ============================================================
-- منصة أكاديمية جَهير — المخطط الكامل (يحل محل أي schema.sql سابق)
-- نفّذه مرة واحدة: Supabase ← SQL Editor ← New query ← Run
-- ============================================================

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'participant' check (role in ('participant','judge','admin')),
  full_name  text not null default '' check (char_length(full_name) <= 100),
  email      text,
  bio        text check (bio is null or char_length(bio) <= 1000),
  consent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.programs (
  slug text primary key, sort int not null default 0,
  name_ar text not null, name_en text not null,
  description_ar text, description_en text, objectives_ar text, objectives_en text, outcomes_ar text, outcomes_en text
);
create table public.pages_content (key text primary key, ar text, en text);
create table public.settings (key text primary key, value jsonb not null);
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title_ar text, title_en text, body_ar text, body_en text,
  published boolean not null default false, created_at timestamptz not null default now()
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  category text not null default 'general' check (category in ('general','marathon','workshop')),
  title_ar text not null, title_en text, description_ar text, description_en text, venue_ar text, venue_en text,
  status text not null default 'draft' check (status in ('draft','upcoming','open','closed','completed')),
  event_date timestamptz, apply_open timestamptz, apply_close timestamptz,
  published boolean not null default false, created_at timestamptz not null default now()
);
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  unique (event_id, participant_id)
);
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz, location text,
  published boolean not null default false
);
create table public.criteria (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name_ar text not null, name_en text,
  max_score int not null default 10 check (max_score between 1 and 100), sort int not null default 0
);
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  judge_id uuid not null references public.profiles(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, judge_id, participant_id)
);
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.assignments(id) on delete cascade,
  scores jsonb not null default '{}'::jsonb,
  comment text check (comment is null or char_length(comment) <= 3000),
  status text not null default 'draft' check (status in ('draft','submitted')),
  updated_at timestamptz not null default now(), submitted_at timestamptz
);
create table public.results (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  total numeric, rank int, published boolean not null default false,
  unique (event_id, participant_id)
);
create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  section text not null default 'general' check (section in ('general','marathon')),
  event_id uuid references public.events(id) on delete set null,
  kind text not null default 'image' check (kind in ('image','video')),
  url text not null check (url ~* '^https://'),
  caption_ar text, caption_en text, taken_on date,
  published boolean not null default false, created_at timestamptz not null default now()
);
create table public.marathon_participants (
  id uuid primary key default gen_random_uuid(), position int not null default 0,
  name_ar text not null, name_en text, degree_ar text, degree_en text, bio_ar text, bio_en text,
  journey_ar text, journey_en text, achievements_ar text, achievements_en text,
  published boolean not null default false
);

-- ---------- دوال الأدوار ----------
create function public.app_role() returns text language sql security definer set search_path=public stable as
$$ select role from public.profiles where id = auth.uid() $$;
create function public.is_admin() returns boolean language sql security definer set search_path=public stable as
$$ select coalesce(public.app_role() = 'admin', false) $$;
create function public.is_judge() returns boolean language sql security definer set search_path=public stable as
$$ select coalesce(public.app_role() = 'judge', false) $$;

-- ---------- المشغّلات ----------
-- كل حساب جديد = مشارك دائمًا. الدور لا يُقرأ أبدًا من بيانات المستخدم.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if m->>'invited' is null and coalesce((m->>'consent')::boolean, false) is not true then
    raise exception 'consent required';
  end if;
  insert into public.profiles (id, email, full_name, consent_at)
  values (new.id, new.email, left(btrim(coalesce(m->>'full_name','')), 100), case when m->>'consent' = 'true' then now() end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.check_assignment() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if (select role from public.profiles where id = new.judge_id) is distinct from 'judge' then raise exception 'not a judge'; end if;
  if (select role from public.profiles where id = new.participant_id) is distinct from 'participant' then raise exception 'not a participant'; end if;
  return new;
end $$;
create trigger trg_check_assignment before insert or update on public.assignments for each row execute function public.check_assignment();

create function public.check_evaluation() returns trigger language plpgsql security definer set search_path=public as $$
declare ev uuid; r record;
begin
  select event_id into ev from public.assignments where id = new.assignment_id;
  for r in select key, value from jsonb_each_text(coalesce(new.scores,'{}'::jsonb)) loop
    if not exists (select 1 from public.criteria c where c.id::text = r.key and c.event_id = ev and r.value::numeric between 0 and c.max_score) then
      raise exception 'invalid score';
    end if;
  end loop;
  new.updated_at := now();
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status <> 'submitted') then
    if (select count(*) from public.criteria where event_id = ev) <> (select count(*) from jsonb_object_keys(coalesce(new.scores,'{}'::jsonb))) then
      raise exception 'incomplete scores';
    end if;
    new.submitted_at := now();
  end if;
  return new;
end $$;
create trigger trg_check_evaluation before insert or update on public.evaluations for each row execute function public.check_evaluation();

-- ---------- تفعيل RLS + صلاحية المشرف الكاملة ----------
do $$ declare t text; begin
  foreach t in array array['profiles','events','programs','pages_content','settings','announcements','registrations','schedules','criteria','assignments','evaluations','results','gallery_items','marathon_participants'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "admin all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------- الصلاحيات الأساسية ----------
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.programs, public.pages_content, public.settings, public.announcements, public.events, public.gallery_items, public.marathon_participants to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, bio) on public.profiles to authenticated;
revoke update on public.registrations from authenticated;
grant update (status) on public.registrations to authenticated;

-- ---------- المحتوى العام ----------
create policy "public read" on public.programs for select to anon, authenticated using (true);
create policy "public read" on public.pages_content for select to anon, authenticated using (true);
create policy "public read" on public.settings for select to anon, authenticated using (true);
create policy "public read" on public.announcements for select to anon, authenticated using (published);
create policy "public read" on public.events for select to anon, authenticated using (published);
create policy "public read" on public.gallery_items for select to anon, authenticated using (published);
create policy "public read" on public.marathon_participants for select to anon, authenticated using (published);

-- ---------- الملف الشخصي ----------
create policy "own profile read"   on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- التسجيل في الفعاليات (للمشارك فقط، وفعالية مفتوحة فقط) ----------
create policy "own registrations read" on public.registrations for select to authenticated using (participant_id = auth.uid());
create policy "participant registers" on public.registrations for insert to authenticated with check (
  participant_id = auth.uid() and status = 'pending' and public.app_role() = 'participant' and exists (
    select 1 from public.events e where e.id = event_id and e.published and e.status = 'open'
      and (e.apply_open is null or now() >= e.apply_open) and (e.apply_close is null or now() <= e.apply_close)));
create policy "participant withdraws" on public.registrations for update to authenticated
  using (participant_id = auth.uid()) with check (participant_id = auth.uid() and status = 'withdrawn');

-- ---------- الجداول ----------
create policy "participant reads own schedule" on public.schedules for select to authenticated using (participant_id = auth.uid() and published);
create policy "judge reads assigned schedule" on public.schedules for select to authenticated using (
  published and exists (select 1 from public.assignments a where a.judge_id = auth.uid() and a.event_id = schedules.event_id and a.participant_id = schedules.participant_id));

-- ---------- المعايير والتكليفات ----------
create policy "criteria readable" on public.criteria for select to authenticated using (true);
create policy "judge reads own assignments" on public.assignments for select to authenticated using (judge_id = auth.uid());
-- المحكّم يرى فعاليات تكليفاته، والمشارك يرى فعاليات تسجيلاته (حتى لو أُخفيت لاحقًا)
create policy "judge reads assigned events" on public.events for select to authenticated using (
  exists (select 1 from public.assignments a where a.event_id = events.id and a.judge_id = auth.uid()));
create policy "participant reads registered events" on public.events for select to authenticated using (
  exists (select 1 from public.registrations r where r.event_id = events.id and r.participant_id = auth.uid()));

-- ---------- التقييمات: المحكّم لتكليفاته فقط، والمشارك لا صلاحية له إطلاقًا ----------
create policy "judge reads own evals" on public.evaluations for select to authenticated using (
  exists (select 1 from public.assignments a where a.id = assignment_id and a.judge_id = auth.uid()));
create policy "judge creates eval" on public.evaluations for insert to authenticated with check (
  public.is_judge() and exists (select 1 from public.assignments a where a.id = assignment_id and a.judge_id = auth.uid()));
create policy "judge edits draft" on public.evaluations for update to authenticated
  using (status = 'draft' and exists (select 1 from public.assignments a where a.id = assignment_id and a.judge_id = auth.uid()))
  with check (exists (select 1 from public.assignments a where a.id = assignment_id and a.judge_id = auth.uid()));

-- ---------- النتائج ----------
create policy "participant reads published result" on public.results for select to authenticated using (participant_id = auth.uid() and published);

-- ---------- دوال الواجهة ----------
-- المشارك: درجاته وملاحظات المحكّمين دون أي حقل يدل على المحكّم، وبعد نشر نتائج الفعالية فقط
create function public.my_evaluations() returns table (event_id uuid, scores jsonb, comment text, on_date date)
language sql security definer set search_path=public stable as
$$ select a.event_id, e.scores, e.comment, e.submitted_at::date
   from public.evaluations e join public.assignments a on a.id = e.assignment_id
   where a.participant_id = auth.uid() and e.status = 'submitted'
     and exists (select 1 from public.results r where r.event_id = a.event_id and r.participant_id = a.participant_id and r.published)
   order by a.event_id, md5(e.id::text) $$;

-- المحكّم: تكليفاته مع اسم المشارك ونبذته فقط (دون بريد)
create function public.judge_assignments() returns table (id uuid, event_id uuid, participant_id uuid, participant_name text, participant_bio text, eval_status text)
language sql security definer set search_path=public stable as
$$ select a.id, a.event_id, a.participant_id, p.full_name, p.bio, coalesce(ev.status, 'assigned')
   from public.assignments a join public.profiles p on p.id = a.participant_id
   left join public.evaluations ev on ev.assignment_id = a.id
   where a.judge_id = auth.uid() and public.is_judge() order by a.created_at desc $$;

-- المشرف: حساب النتائج (متوسط مجموع درجات التقييمات المُسلَّمة)
create function public.compute_results(p_event uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  with per_eval as (
    select a.participant_id, (select coalesce(sum(value::numeric), 0) from jsonb_each_text(e.scores)) s
    from public.evaluations e join public.assignments a on a.id = e.assignment_id
    where a.event_id = p_event and e.status = 'submitted'),
  tot as (select participant_id, avg(s) total from per_eval group by participant_id)
  insert into public.results (event_id, participant_id, total, rank)
  select p_event, participant_id, round(total, 2), rank() over (order by total desc) from tot
  on conflict (event_id, participant_id) do update set total = excluded.total, rank = excluded.rank;
end $$;

-- المشرف: تحويل الحساب بين مشارك ومحكّم (لا يمكن إنشاء مشرف من الواجهة)
create function public.admin_set_role(uid uuid, new_role text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if new_role not in ('participant','judge') then raise exception 'invalid role'; end if;
  update public.profiles set role = new_role where id = uid and role <> 'admin';
end $$;

revoke all on all functions in schema public from public, anon;
grant execute on function public.app_role(), public.is_admin(), public.is_judge(), public.my_evaluations(), public.judge_assignments(),
  public.compute_results(uuid), public.admin_set_role(uuid, text) to authenticated;

-- ---------- بيانات أولية ----------
insert into public.programs (slug, sort, name_ar, name_en, description_ar, description_en, objectives_ar, objectives_en, outcomes_ar, outcomes_en) values
('experimental-speaking',1,'الإلقاء التجريبي','Experimental Delivery','[وصف البرنامج]','[Program description]','[أهداف البرنامج]','[Objectives]','[مخرجات التعلم]','[Learning outcomes]'),
('muallaqat',2,'لون المعلقات','The Mu''allaqat Color','هو أحد ألوان الإلقاء الأدبي الذي يركز على تقديم روائع الشعر العربي، من خلال إلقاء الأبيات الشعرية بأسلوب يعكس معانيها، ويُبرز جمال اللغة العربية وقوة التعبير فيها.','One of the literary delivery colors, focused on presenting masterpieces of Arabic poetry by reciting verses in a style that reflects their meaning and highlights the beauty of the Arabic language and the power of expression within it.','[أهداف البرنامج]','[Objectives]','[مخرجات التعلم]','[Learning outcomes]'),
('persuasive-speaking',3,'اللون الإقناعي','The Persuasive Color','[وصف البرنامج]','[Program description]','[أهداف البرنامج]','[Objectives]','[مخرجات التعلم]','[Learning outcomes]'),
('oratory-speaking',4,'اللون الخطابي','The Oratory Color','[وصف البرنامج]','[Program description]','[أهداف البرنامج]','[Objectives]','[مخرجات التعلم]','[Learning outcomes]');

insert into public.pages_content (key, ar, en) values
('about_who','أكاديمية تدريبية تهدف إلى تطوير مهارات التواصل، فن الإقناع، وبناء الثقة بالنفس، من خلال التدريب العملي على مهارات الإلقاء والخطابة أمام الجمهور.','A training academy that aims to develop communication skills, the art of persuasion, and self-confidence, through practical training in public speaking and oratory before an audience.'),
('about_mission','نؤمن أن لكل شخص صوتًا داخليًا ورسالة تستحق أن تُسمع، يأتي دور "جهير" إلى تمكينه لتحويل هذا الصوت إلى أداء مؤثر وصدى يلامس الجمهور، مع العمل على تحويل رهبة الوقوف أمام الآخرين إلى تجربة تعزز الحضور والشخصية القيادية.','We believe every person has an inner voice and a message worth hearing. Jaheer''s role is to empower them to turn that voice into impactful delivery and an echo that touches the audience, while turning the fear of standing before others into an experience that strengthens presence and leadership.'),
('about_vision','بناء شخصيات قيادية قادرة على التعبير عن الأفكار بثقة ووضوح. صقل المهارات الإقناعية والارتجالية وصياغة الرسائل بوضوح وتأثير. التدريب على إعداد وإلقاء خطب قصيرة وفعالة أمام جمهور حقيقي.','Building leadership personalities capable of expressing ideas with confidence and clarity. Refining persuasive and impromptu skills and crafting messages with clarity and impact. Training to prepare and deliver short, effective speeches before a real audience.'),
('about_values','[قيم الأكاديمية — تُضاف من لوحة الإدارة]','[Academy values — add from the admin panel]'),
('about_journey','[مسيرة الأكاديمية وإنجازاتها — تُضاف من لوحة الإدارة]','[Academy journey and achievements — add from the admin panel]'),
('marathon_intro','عشرة متحدثين أتمّوا ألوان جَهير الأربعة، في طريقهم إلى المسرح الكبير.','Ten speakers who completed all four Jaheer colors, on their way to the grand stage.');

insert into public.settings (key, value) values
('stats','[{"n":"26","ar":"ورشة تدريبية","en":"Training workshops","ar_note":"ورش تدريبية تغطي مواضيع الإلقاء","en_note":"Workshops covering public speaking topics"},{"n":"783,100","ar":"حرف منطوق","en":"Letters spoken","ar_note":"إجمالي الحروف المنطوقة في تدريب المشاركين","en_note":"Total letters spoken during participants'' training"},{"n":"2360","ar":"ساعة","en":"Training hours","ar_note":"14 ساعة تدريب لكل متدرب","en_note":"14 training hours per trainee"},{"n":"160+","ar":"متدربًا","en":"Trainees","ar_note":"استفادوا من برامج جهير","en_note":"Benefited from Jaheer programs"}]'::jsonb),
('contact_email','""'::jsonb),
('social','[{"label":"LinkedIn","url":"https://www.linkedin.com/company/jaheer-academy/"}]'::jsonb);

-- ---------- أول مشرف ----------
-- سجّل حسابك من /register ثم نفّذ (بدّل البريد ببريدك):
--   update public.profiles set role = 'admin' where email = 'your@email.com';
