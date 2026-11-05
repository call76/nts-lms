# NTS Professional LMS (V6.2) – Nezerwa Tech Solution
*Learn • Practice • Excel*

## Gutangira vuba (Kinyarwanda)
1. Tangiza MySQL (XAMPP). Database `nts` irashingwa na Prisma yonyine.
2. **Backend:** `cd backend && npm install && npm run dev` (ikora schema sync, admin na demo data – nibura 5 records muri buri table).
3. **Frontend:** `cd frontend && npm install && npm start` → http://localhost:3000
4. Admin: `ADMIN_EMAIL` / `ADMIN_PASSWORD` biri muri `backend/.env`. Demo accounts zose: password `Password123`
   (teacher `marie.uwase@nts-demo.rw`, student `eric.mugisha@nts-demo.rw`, parent `aline.giraneza@nts-demo.rw`, employer `alain.ntwari@nts-demo.rw`).
5. Register: Student, Parent, Employer cyangwa Guest. Trainer ashyirwaho na Admin. Niba email ya Gmail itohereje code mu gihe cya development, konti ihita yemera (code igaragara muri console ya backend). `EMAIL_VERIFICATION=off` ihagarika code burundu.

## V6.2 – ibishya (Kinyarwanda)
* **Add Module ikoresha upload** (Admin Panel > Courses & Modules > Add Module): intambwe 3 – Details, Cover & intro video, Learning files. Byose **ubirura (Browse / drag & drop)** uva kuri computer, nta link cyangwa «location» wandika. Module ishobora guhindurwa (**Edit / Files**) ukongeraho cyangwa ugakuraho amadosiye. Mu Learning Studio, video n'amanota y'isomo nabyo birurwa.
* **Library** (`/library`): ibitabo, notes na past papers byurwa na trainer/admin, abanyeshuri bakabireba/bakabikuramo.
* **Question Bank** (`/question-bank`): bika ibibazo, ubyongere muri quiz, wandukure ibibazo bya quiz isanzweho, ukore quiz mu kanya.
* **Help & Support** (`/help`): FAQ ihindurwa na admin.
* **Profile > Update Password** ifite igishushanyo nk'icyo wohereje + strength meter. Ifoto nshya y'«digital profiles» iri kuri Profile, Login slideshow na Users.
* **System Builder** (Admin > Site settings): palettes z'amabara, font, imiterere y'impande, sidebar style, dark mode default, **Menu manager** (hisha/ongera izina/hindura umurongo/hitamo roles + custom links), dashboard widgets, **gufunga registration** ya buri role, FAQ, Advanced CSS.
* Nyuma yo gusimbura code: `cd backend && npm run migrate` (ongeramo ibice bishya bya Module, LibraryItem, BankQuestion).

## V5.5 – ibishya
* **Certificate nshya (English)**: igishushanyo cya professional, ifoto y'umunyeshuri, marks nyakuri ziva muri system (assignments + quizzes), QR, seal na signatures. **Download PDF / PNG / Print** biri ku rupapuro rwa certificate. Ikosa «authorize at least one signatory» ryakosowe (signatories bemewe bakoreshwa mu buryo bwa default).
* **Robot check** («I am not a robot») kuri Login, Register no ku rupapuro rwa public rwo kugenzura certificate (`/verify/:code`). `HUMAN_CHECK=off` irahagarika.
* **Ibibazo bya certificate**: umunyeshuri abaza Admin, Admin agasubiza muri Certificate Settings. **NTS Pro**: certificates z'ubuntu zifite imipaka (admin ayishyiraho), izirenzeho zisaba Pro (payment reference, admin yemeza). Admin ashobora **gushyiraho internship certificate** y'umunyeshuri (upload file).
* **Video → questions → certificate**: trainer/admin ashyiraho video ku isomo, quiz ihuzwa na video; umunyeshuri agomba kubanza kuyireba (system ibikurikirana) mbere yo gusubiza.
* **Learning Studio**: nta prompt() zikiriho – quiz player, submit/grade modals, edit/delete (lessons, assignments, quizzes) na admin; notes zifunguka koko, zishobora **gukururwa** cyangwa **kubikwa muri My library**; «Joined» igaragara umunyeshuri amaze kwinjira mu module/class.
* **Trainers ↔ classes**: Admin agabanya classes ku barimu (`/admin/teaching`) kandi atanga uburenganzira bwo guhindura internships/calendar. Trainer abona gusa abanyeshuri b'amaclasses ye, kandi abona notification igihe umunyeshuri yinjiye muri class/module.
* **Ababyeyi**: babona modules umwana yiga; marks, certificates na attendance yuzuye iyo mwarimu abyemeje (Attendance → Parents' access). Bashobora no kwandikira admin. Nta Learning/Internships/Certificates kuri bo.
* **Meetings** (`/meetings`): video meetings (Jitsi) hagati y'abanyeshuri, abarimu na admin; host abona abinjiye.

## V5.3 – ibishya
* **Parents & Teachers (`/family`)** – umubyeyi na mwarimu bandikirana ku mwana; **umunyeshuri abona ibyo bavuga ariko ntashobora kwandika**. Real-time (Socket.IO) + notifications.
* **Ababyeyi biyandikisha** bashyiramo email y'umwana; umwana agomba kwemeza (Parents & Teachers → Parent requests) cyangwa Admin akabihuza. Nta kwemezwa = nta makuru babona.
* **Parent Portal** ifite charts: course progress, quiz scores, attendance.
* **Attendance (`/attendance`)** – mwarimu ashyiraho present/late/excused/absent; umubyeyi wa absent ahabwa notification; umunyeshuri n'umubyeyi babona chart. Hari na **teacher remarks** (praise / concern / note).
* **Online class attendance (V5.4)** – mwarimu afungura session (class + link ya meeting), akerekana **code** mu online class; abanyeshuri bakora **check-in** bandika iyo code. Mwarimu abona urutonde, akabona abaje batinze cyane (⚠), agahitamo ushobora kutemera (yiyandikishije ariko atitabiriye), hanyuma agakora **Verify**. Abatakoze check-in bahita bandikwa absent (cyangwa excused niba bafite excuse yemewe).
* **Guhitamo uwohererezwa**: mwarimu ahitamo kohereza umubyeyi (abona niba umwana yitabiriye n'igihe yinjiriye) na/cyangwa Admin, cyangwa akabyihorera (umunyeshuri wenyine abibona).
* **Absence excuses** – umunyeshuri cyangwa umubyeyi atanga impamvu, mwarimu akemeza → umunsi uba EXCUSED. **CSV export** ya buri session.
* **Calendar (`/events`)** – meetings, quizzes, open days zerekanwa ku bantu bagenewe.
* Register na Login byavuguruwe (roles nyinshi, kwerekana password, demo accounts muri development).
* Ibidakenewe byasibwe: ibyandikwa bya docs bisubiramo (hasigaye README imwe).

## V5.1 / V5.2 (muri make)
Admin > Users (add/edit/soft-delete/restore/reset password/activate), audit log, parent links, announcements, notifications bell, dashboards za buri role, certified students (employer), leaderboard, Export CSV.

Social learning platform for Rwanda TVET students and trainers: feed, real-time chat (private + groups),
internships & applications, course/trade catalogue and an admin panel.

* **frontend/** – React 18 (Create React App), Tailwind, Zustand, Socket.IO client
* **backend/** – Node 18+, Express, Prisma (MySQL (XAMPP) or PostgreSQL), Socket.IO, Nodemailer (OTP emails)

## Run locally

```bash
# 1. Backend
cd backend
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, EMAIL_USER / EMAIL_PASS
npm install                 # also runs `prisma generate`
npm run migrate             # prisma db push (safe, non-destructive)
npm run dev                 # http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env        # REACT_APP_API_URL / REACT_APP_SOCKET_URL
npm install
npm start                   # http://localhost:3000
```

Without `EMAIL_USER`/`EMAIL_PASS` (development only) the OTP code is printed in the backend console.
A default admin is created on first start: `ADMIN_EMAIL` / `ADMIN_PASSWORD` (default `admin@nts.rw` / `Admin123` – **change it**).

## Deploy

* Backend (Render): build `npm install`, start `npm start` (runs the schema sync, then the server).
  Set `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `EMAIL_USER`, `EMAIL_PASS`, `FRONTEND_URL`.
  Note: Render's disk is ephemeral – uploaded files in `backend/uploads` disappear on redeploy. Move uploads to
  S3/Cloudinary/Supabase Storage for permanent storage.
* Frontend (Netlify / Vercel): config is in `netlify.toml` and `frontend/vercel.json`
  (env vars `REACT_APP_API_URL`, `REACT_APP_SOCKET_URL`).

## API overview (all under `/api`, JWT `Authorization: Bearer …` except auth)

| Area | Endpoints |
|------|-----------|
| Auth | `POST /auth/register`, `/auth/verify-otp`, `/auth/resend-otp`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`, `GET /auth/me` |
| Users | `GET /users/profile/:id`, `PUT /users/profile`, `GET /users/suggested`, `GET /users/search`, `POST /users/:id/follow` |
| Posts | `GET /posts/feed`, `/posts/saved`, `/posts/user/:id`, `POST /posts`, `PUT/DELETE /posts/:id`, `POST /posts/:id/like|react|save|share|report`, comments CRUD under `/posts/:id/comments` |
| Chat | `GET /chat`, `GET /chat/search`, `POST /chat/private/:userId`, `POST /chat/group`, `GET /chat/:chatId/messages`, `POST /chat/messages`, `PUT/DELETE /chat/messages/:id`, `POST /chat/messages/:id/read|react` |
| Internships | `GET/POST /internships`, `DELETE /internships/:id`, `POST /internships/:id/apply`, `GET /my-applications`, `DELETE /applications/:id` |
| Courses | `GET /trades`, `POST /trades`, `DELETE /trades/:id`, `POST /trades/:id/modules`, `DELETE /trades/modules/:id` |
| Admin | `GET /admin/users`, `PUT /admin/users/:id[/role]`, `DELETE /admin/users/:id`, `GET /admin/applications`, `PUT /admin/applications/:id/status`, `GET /admin/reports`, `GET /admin/contact` |
| Family (V5.3) | `GET /family/contacts`, `GET/POST /family/threads`, `GET /family/threads/:id`, `POST /family/threads/:id/messages`, `PUT /family/threads/:id/status`, `GET/POST/DELETE /family/remarks` |
| School (V5.3) | `GET /school/attendance/classes`, `GET /school/attendance/class/:id?date=`, `POST /school/attendance/mark`, `GET /school/attendance/student/:id|me`, `GET/POST/DELETE /school/events` |
| Online attendance (V5.4) | `POST/GET /school/sessions`, `GET /school/sessions/:id`, `POST /school/sessions/:id/checkin\|close\|verify`, `GET/POST /school/excuses`, `PUT /school/excuses/:id` |
| Parents | `GET /parents/children`, `GET /parents/requests`, `PUT /parents/requests/:id` |
| Misc | `POST /upload`, `GET /dashboard/stats`, `GET /health` |

Real-time events (Socket.IO, authenticated with the JWT): `message:received|updated|deleted|read|reacted`,
`typing:start|stop`, `user:online|offline`, `post:created|edited|deleted`, `comment:added|edited|deleted`,
`application:status:updated`, `chat:created`.

## V6.1 visual upgrade
- Role-aware image launchpad on dashboards: Learning Studio, Certificates, Campus Workspace and Career Opportunities.
- Uses the supplied dashboard mock-ups as the visual reference and reuses the included optimized school, learning and graduate photography.
- Added responsive image overlays, hover transitions, accessibility labels and reduced-motion support.
- Local `backend/.env` and `frontend/.env` are configured for the requested MySQL database and localhost ports. Replace credentials before sharing this archive.

## V6.0 additions (this upgrade)
- Learning: trainers/admins add questions per module (form, picture, **CSV bulk import**), quiz time limit, attempts limit, hide/show answers, copy quiz, quiz results + hard-question statistics, gradebook CSV.
- Students: watch video → pass quiz → module completes automatically → **certificate is issued automatically** (admin can turn this off: PUT /api/certificates/auto-issue). Live progress checklist, lesson discussion (ask/reply), module ratings, to-do list endpoint.
- Internships: admin / allowed trainers can **edit, activate/deactivate and delete**; applicants list; student **logbook** with supervisor approval; employer/supervisor evaluation. Employer dashboard kept.
- Trades/modules: edit trade and module; trainers can add modules; events can be edited.
- Campus tools (/campus): performance analytics + at-risk students + CSV report, TVET competency checklists with evidence upload and skills portfolio, fees + receipts + reminders, timetable with clash detection and notifications, AI tutor (Kinyarwanda/English/French; needs OPENAI_API_KEY).
- Fixed: a skipped quiz question was counted as answer #1; modules finished by video/quiz never reached 100%.
- Database: new tables/columns are added by `prisma db push` on start (existing data is kept).
- Security: .env files are NOT included. Copy `.env.example` to `.env` and set your own secrets.

## V6.0 design (from the supplied mock-ups)
- Dark-blue **sidebar** on desktop with role-based menu; top bar with date, notifications, dark mode, profile. Mobile keeps the top menu + bottom bar.
- Blue **welcome banners** with photos (admin: school, trainer: teacher, student: student) and blue page heroes; coloured stat cards; "v6.0" promo card.
- **Exam page**: header with question count and time, progress bar, question navigator (current / answered / not answered), red time-remaining box, instructions, optional picture per question.
- **Learning Studio** (student): video + tabs (Lesson Details, Resources, Quiz, Notes, Discussion), course playlist with progress, next lesson.
- **Certificate Center**: verify panel (certificate ID), valid / invalid result, Share button.
- Images cropped from the mock-ups are in `frontend/public/images/v6-*.webp` and are used as default banners / avatars. Admin can still change them in Site Settings.
