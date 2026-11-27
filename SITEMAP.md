# خريطة المسارات (Sitemap)

كل مسار له رابط وصفحة ووظيفة مستقلة. الحراسة: الدور يُقرأ من قاعدة البيانات (جدول profiles) لا من المتصفح، والبيانات نفسها محمية بـ RLS.

| المسار | التخطيط | الصلاحية | الدالة |
|---|---|---|---|
| `/` | public | عام | pub.home |
| `/about` | public | عام | pub.about |
| `/programs` | public | عام | pub.programs |
| `/programs/:slug` | public | عام | pub.program |
| `/marathon` | public | عام | pub.marathon |
| `/events` | public | عام | pub.events |
| `/events/:slug` | public | عام | pub.event |
| `/gallery` | public | عام | pub.gallery |
| `/contact` | public | عام | pub.contact |
| `/login` | public | عام (للزائر فقط) | auth.login |
| `/register` | public | عام (للزائر فقط) | auth.register |
| `/forgot-password` | public | عام | auth.forgot |
| `/reset-password` | public | عام | auth.reset |
| `/verify-email` | public | عام | auth.verify |
| `/participant/dashboard` | participant | 🔒 participant | par.dashboard |
| `/participant/profile` | participant | 🔒 participant | par.profile |
| `/participant/events` | participant | 🔒 participant | par.events |
| `/participant/registrations` | participant | 🔒 participant | par.registrations |
| `/participant/schedule` | participant | 🔒 participant | par.schedule |
| `/participant/evaluations` | participant | 🔒 participant | par.evaluations |
| `/participant/results` | participant | 🔒 participant | par.results |
| `/judge/dashboard` | judge | 🔒 judge | jud.dashboard |
| `/judge/assignments` | judge | 🔒 judge | jud.assignments |
| `/judge/submissions` | judge | 🔒 judge | jud.submissions |
| `/judge/profile` | judge | 🔒 judge | jud.profile |
| `/judge/evaluate/:id` | judge | 🔒 judge | jud.evaluate |
| `/admin/dashboard` | admin | 🔒 admin | adm.dashboard |
| `/admin/participants` | admin | 🔒 admin | adm.participants |
| `/admin/judges` | admin | 🔒 admin | adm.judges |
| `/admin/events` | admin | 🔒 admin | adm.events |
| `/admin/assignments` | admin | 🔒 admin | adm.assignments |
| `/admin/evaluations` | admin | 🔒 admin | adm.evaluations |
| `/admin/results` | admin | 🔒 admin | adm.results |
| `/admin/schedules` | admin | 🔒 admin | adm.schedules |
| `/admin/gallery` | admin | 🔒 admin | adm.gallery |
| `/admin/reports` | admin | 🔒 admin | adm.reports |
| `/admin/settings` | admin | 🔒 admin | adm.settings |
| `/admin/content` | admin | 🔒 admin | adm.content |
| `/admin/events/create` | admin | 🔒 admin | adm.eventCreate |
| `/admin/events/:id` | admin | 🔒 admin | adm.eventEdit |

| أي مسار غير مذكور | عام | 404 | errors.notFound |
| مسار محمي بدور غير مناسب | عام | 403 | errors.forbidden |
