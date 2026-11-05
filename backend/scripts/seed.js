/**
 * Demo data for every table (at least 5 rows each), built from prisma/schema.prisma.
 *
 *   npm run seed            -> (re)insert anything that is missing
 *   SEED_DEMO_DATA=false    -> in .env, stops the automatic seed when the server starts
 *
 * Safe to run many times: every row has a fixed id and is inserted with skipDuplicates,
 * so nothing is overwritten and nothing is deleted. Demo accounts all use the password
 * "Password123" (change or deactivate them from Admin > Users before going live).
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DAY = 86_400_000;
const ago = (days, hours = 0) => new Date(Date.now() - days * DAY - hours * 3_600_000);
const ahead = (days) => new Date(Date.now() + days * DAY);
const DEMO_PASSWORD = 'Password123';
const MARKER = 'seed.demo.version';

async function seedDemoData(client, { force = false } = {}) {
  const prisma = client || require('../lib/prisma');
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = require('../lib/config');

  if (!force && (await prisma.siteSetting.findUnique({ where: { key: MARKER } }))) return { skipped: true };

  const stats = {};
  const ins = async (model, rows) => {
    await prisma[model].createMany({ data: rows, skipDuplicates: true });
    stats[model] = rows.length;
  };

  // ---------- the admin from .env (created here too, so `npm run seed` works on a fresh DB) ----------
  let admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    admin = await prisma.user.create({ data: { email: ADMIN_EMAIL, fullName: 'Admin', passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10), role: 'ADMIN', isVerified: true } });
  }
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ---------- trades & modules (the catalogue the rest of the demo data hangs on) ----------
  if ((await prisma.trade.count()) === 0) {
    await prisma.trade.createMany({
      data: [
        { name: 'Software Development', icon: 'FaCode', color: 'bg-green-500', description: 'Learn programming, web development, mobile apps, and software engineering.' },
        { name: 'Networking & Internet Technologies', icon: 'FaNetworkWired', color: 'bg-blue-500', description: 'Network design, administration and security.' },
        { name: 'Computer Systems & Architecture', icon: 'FaMicrochip', color: 'bg-purple-500', description: 'Hardware, operating systems and system administration.' },
        { name: 'Electronics & Telecommunication', icon: 'FaBroadcastTower', color: 'bg-yellow-500', description: 'Electronic circuits, signals and telecommunication systems.' },
        { name: 'Multimedia & Production', icon: 'FaVideo', color: 'bg-red-500', description: 'Graphic design, video, audio and digital content production.' },
      ],
    });
  }
  const trades = (await prisma.trade.findMany({ orderBy: { id: 'asc' }, take: 5 }));
  const moduleDefs = [
    [0, 1, 'SWDPG301', 'Web Programming Fundamentals'],
    [0, 2, 'SWDDB401', 'Database Design and Administration'],
    [1, 1, 'NETCN301', 'Computer Networks Basics'],
    [1, 2, 'NETSC401', 'Network Security Essentials'],
    [2, 1, 'CSAOS301', 'Operating Systems Administration'],
    [2, 2, 'CSAHW401', 'Computer Hardware and Maintenance'],
    [3, 1, 'ETCEC301', 'Electronic Circuits'],
    [3, 2, 'ETCTS401', 'Telecommunication Systems'],
    [4, 1, 'MMPGD301', 'Graphic Design Principles'],
    [4, 2, 'MMPVP401', 'Video Production'],
  ].filter(([t]) => trades[t]);
  await prisma.module.createMany({
    data: moduleDefs.map(([t, level, code, name]) => ({ tradeId: trades[t].id, level, code, name, description: `${name} - demo module` })),
    skipDuplicates: true,
  });
  const allModules = await prisma.module.findMany({ where: { tradeId: { in: trades.map((t) => t.id) } }, orderBy: { id: 'asc' } });
  const codeToId = Object.fromEntries(allModules.map((m) => [`${m.tradeId}:${m.code}`, m.id]));
  const mods = moduleDefs.map(([t, , code]) => codeToId[`${trades[t].id}:${code}`]).filter(Boolean);
  if (mods.length < 5) throw new Error('Could not prepare 5 modules for the demo data');
  const M = (i) => mods[i % mods.length];

  // ---------- chats & class groups (users reference class groups, so they come first) ----------
  const chats = [1, 2, 3, 4, 5].map((n) => ({
    id: `seed-chat-${n}`, isGroup: n >= 3, name: n >= 3 ? ['', '', 'Web Dev Year 1 A', 'Database Year 2 B', 'Networking Year 1 A'][n - 1] : null, createdAt: ago(30 - n),
  }));
  await ins('chat', chats);

  const classes = [
    { id: 'seed-class-1', name: 'Year 1 A', department: 'Software Development', chatId: 'seed-chat-3' },
    { id: 'seed-class-2', name: 'Year 2 B', department: 'Software Development', chatId: 'seed-chat-4' },
    { id: 'seed-class-3', name: 'Year 1 A', department: 'Networking', chatId: 'seed-chat-5' },
    { id: 'seed-class-4', name: 'Year 1 B', department: 'Multimedia', chatId: null },
    { id: 'seed-class-5', name: 'Year 3 A', department: 'Electronics', chatId: null },
  ].map((c) => ({ ...c, school: 'NTS Demo TVET School', schoolType: 'TVET', level: 'Level 3' }));
  await ins('classGroup', classes);

  // ---------- users ----------
  const U = {
    admin: admin.id,
    admin2: 'seed-user-admin2', trainer1: 'seed-user-trainer1', trainer2: 'seed-user-trainer2',
    s1: 'seed-user-student1', s2: 'seed-user-student2', s3: 'seed-user-student3', s4: 'seed-user-student4', s5: 'seed-user-student5',
    employer: 'seed-user-employer', parent1: 'seed-user-parent1', parent2: 'seed-user-parent2', guest: 'seed-user-guest',
  };

  // relationship data first, so the denormalised counters on User are correct
  const follows = [
    [U.s1, U.trainer1], [U.s2, U.trainer1], [U.s3, U.trainer2], [U.s1, U.s2], [U.s2, U.s1], [U.s4, U.trainer1],
  ];
  const posts = [
    { n: 1, author: U.trainer1, content: 'Welcome to the new term! Notes for Web Programming Fundamentals are now published.' },
    { n: 2, author: U.s1, content: 'Finished my first responsive page today. HTML + CSS grid is fun!' },
    { n: 3, author: U.s2, content: 'Does anyone have tips for normalising a database to 3NF?' },
    { n: 4, author: U.admin2, content: 'Reminder: internship applications close at the end of the month.' },
    { n: 5, author: U.s3, content: 'Our networking lab: we configured VLANs and inter-VLAN routing.' },
  ];
  const likes = [[U.s1, 1], [U.s2, 1], [U.trainer1, 2], [U.s3, 2], [U.s1, 4]];
  const reactions = [[U.s2, 1, 'love'], [U.s3, 1, 'like'], [U.trainer1, 2, 'wow'], [U.s1, 3, 'like'], [U.s4, 5, 'love']];
  const saves = [[U.s1, 1], [U.s2, 1], [U.s3, 4], [U.s4, 2], [U.s5, 3]];
  const reports = [[U.s3, 3], [U.s4, 3], [U.s5, 2], [U.s2, 5], [U.parent1, 3]];
  const comments = [
    { n: 1, post: 1, author: U.s1, content: 'Thank you teacher, downloading the notes now.' },
    { n: 2, post: 2, author: U.trainer1, content: 'Great work! Try adding a mobile breakpoint next.' },
    { n: 3, post: 3, author: U.trainer2, content: 'Start by removing repeating groups, then partial dependencies.' },
    { n: 4, post: 4, author: U.s4, content: 'Applying today.' },
    { n: 5, post: 5, author: U.s1, content: 'Nice, can you share the config?' },
  ];
  const count = (arr, fn) => arr.filter(fn).length;

  const people = [
    { id: U.admin2, fullName: 'Kagabo Jean', email: 'jean.kagabo@nts-demo.rw', phone: '+250788111111', role: 'ADMIN' },
    { id: U.trainer1, fullName: 'Uwase Marie', email: 'marie.uwase@nts-demo.rw', phone: '+250788222222', role: 'TRAINER', department: 'Software Development', bio: 'Trainer in Software Development.' },
    { id: U.trainer2, fullName: 'Habimana Patrick', email: 'patrick.habimana@nts-demo.rw', phone: '+250788222333', role: 'TRAINER', department: 'Networking', bio: 'Trainer in Networking and Security.' },
    { id: U.s1, fullName: 'Mugisha Eric', email: 'eric.mugisha@nts-demo.rw', phone: '+250788333333', avatar: '/images/v6-portrait-boy.webp', role: 'STUDENT', classGroupId: 'seed-class-1', className: 'Year 1 A', department: 'Software Development', verificationStatus: 'APPROVED' },
    { id: U.s2, fullName: 'Ishimwe Grace', email: 'grace.ishimwe@nts-demo.rw', phone: '+250788333444', avatar: '/images/v6-portrait-girl.webp', role: 'STUDENT', classGroupId: 'seed-class-1', className: 'Year 1 A', department: 'Software Development', verificationStatus: 'APPROVED' },
    { id: U.s3, fullName: 'Niyonzima David', email: 'david.niyonzima@nts-demo.rw', phone: '+250788333555', role: 'STUDENT', classGroupId: 'seed-class-2', className: 'Year 2 B', department: 'Software Development', verificationStatus: 'APPROVED' },
    { id: U.s4, fullName: 'Mukamana Sandra', email: 'sandra.mukamana@nts-demo.rw', phone: '+250788333666', role: 'STUDENT', classGroupId: 'seed-class-3', className: 'Year 1 A', department: 'Networking', verificationStatus: 'PENDING' },
    { id: U.s5, fullName: 'Nsengimana Prince', email: 'prince.nsengimana@nts-demo.rw', phone: '+250788333777', role: 'STUDENT', classGroupId: 'seed-class-4', className: 'Year 1 B', department: 'Multimedia', isActive: false, status: 'INACTIVE' },
    { id: U.employer, fullName: 'Ntwari Alain', email: 'alain.ntwari@nts-demo.rw', phone: '+250788444444', role: 'EMPLOYER', bio: 'Hiring manager at a Kigali software company.' },
    { id: U.parent1, fullName: 'Giraneza Aline', email: 'aline.giraneza@nts-demo.rw', phone: '+250788555555', role: 'PARENT' },
    { id: U.parent2, fullName: 'Rwema Joseph', email: 'joseph.rwema@nts-demo.rw', phone: '+250788555666', role: 'PARENT' },
    { id: U.guest, fullName: 'Kayitesi Olivia', email: 'olivia.kayitesi@nts-demo.rw', phone: '+250788666666', role: 'GUEST' },
  ].map((u, i) => ({
    passwordHash, isVerified: true, status: 'ACTIVE', isActive: true, createdAt: ago(60 - i),
    school: ['STUDENT', 'TRAINER'].includes(u.role) ? 'NTS Demo TVET School' : null,
    schoolType: u.role === 'STUDENT' ? 'TVET' : null,
    postsCount: count(posts, (p) => p.author === u.id),
    followersCount: count(follows, ([, f]) => f === u.id),
    followingCount: count(follows, ([f]) => f === u.id),
    ...u,
  }));
  await ins('user', people);

  // ---------- one-time codes (already expired: harmless examples) ----------
  const otpHash = await bcrypt.hash('000000', 8);
  await ins('otp', [1, 2, 3, 4, 5].map((n) => ({
    id: `seed-otp-${n}`, email: people[n + 2].email, codeHash: otpHash, type: n % 2 ? 'verification' : 'reset', attempts: 0, expiresAt: ago(1), createdAt: ago(1, 1),
  })));

  // ---------- messaging ----------
  const parts = [
    ['seed-chat-1', U.s1], ['seed-chat-1', U.trainer1], ['seed-chat-2', U.s2], ['seed-chat-2', U.parent1],
    ['seed-chat-3', U.trainer1], ['seed-chat-3', U.s1], ['seed-chat-3', U.s2],
    ['seed-chat-4', U.trainer1], ['seed-chat-4', U.s3], ['seed-chat-5', U.trainer2], ['seed-chat-5', U.s4],
  ];
  await ins('chatParticipant', parts.map(([chatId, userId], i) => ({ id: `seed-cp-${i + 1}`, chatId, userId })));
  await ins('message', [
    { n: 1, chatId: 'seed-chat-1', from: U.s1, to: U.trainer1, text: 'Good morning, may I get the assignment instructions?' },
    { n: 2, chatId: 'seed-chat-1', from: U.trainer1, to: U.s1, text: 'Good morning Eric, they are in the Learning Studio.' },
    { n: 3, chatId: 'seed-chat-2', from: U.parent1, to: U.s2, text: 'How is school going this week?' },
    { n: 4, chatId: 'seed-chat-3', from: U.trainer1, to: null, text: 'Quiz on Friday: chapters 1 to 3.' },
    { n: 5, chatId: 'seed-chat-3', from: U.s2, to: null, text: 'Thank you, we will be ready.' },
    { n: 6, chatId: 'seed-chat-5', from: U.trainer2, to: null, text: 'Lab 2 starts at 9:00 in room B.' },
  ].map((m) => ({ id: `seed-msg-${m.n}`, chatId: m.chatId, senderId: m.from, receiverId: m.to, content: m.text, isRead: m.n % 2 === 0, createdAt: ago(5, 7 - m.n) })));

  // ---------- social feed ----------
  await ins('follow', follows.map(([followerId, followingId], i) => ({ id: `seed-follow-${i + 1}`, followerId, followingId })));
  await ins('post', posts.map((p) => ({
    id: `seed-post-${p.n}`, content: p.content, authorId: p.author, createdAt: ago(10 - p.n),
    likesCount: count(likes, ([, post]) => post === p.n), commentsCount: count(comments, (c) => c.post === p.n),
  })));
  await ins('like', likes.map(([userId, n], i) => ({ id: `seed-like-${i + 1}`, userId, postId: `seed-post-${n}` })));
  await ins('postReaction', reactions.map(([userId, n, reaction], i) => ({ id: `seed-react-${i + 1}`, userId, postId: `seed-post-${n}`, reaction })));
  await ins('savedPost', saves.map(([userId, n], i) => ({ id: `seed-save-${i + 1}`, userId, postId: `seed-post-${n}` })));
  await ins('report', reports.map(([reporterId, n], i) => ({ id: `seed-report-${i + 1}`, reporterId, postId: `seed-post-${n}`, reason: ['Spam', 'Off topic', 'Inappropriate', 'Duplicate', 'Other'][i], status: 'OPEN' })));
  await ins('comment', comments.map((c) => ({ id: `seed-comment-${c.n}`, postId: `seed-post-${c.post}`, authorId: c.author, content: c.content, createdAt: ago(8 - c.n) })));

  // ---------- internships ----------
  const internships = [
    ['Junior Web Developer Intern', 'Kigali Digital Labs', 'Build and test web pages with a mentor.', 'Kigali', 3, 80000],
    ['Network Support Intern', 'Rwanda Connect Ltd', 'Help the team maintain office networks.', 'Kigali', 3, 60000],
    ['IT Helpdesk Intern', 'Huye Tech Hub', 'First-line support for staff and clients.', 'Huye', 2, 50000],
    ['Graphic Design Intern', 'Creative Studio RW', 'Design social media and print material.', 'Musanze', 3, 70000],
    ['Electronics Technician Intern', 'Volt Systems', 'Assist with repairs and installations.', 'Rubavu', 4, 90000],
  ];
  await ins('internship', internships.map(([title, company, description, location, duration, stipend], i) => ({
    id: `seed-intern-${i + 1}`, title, company, description, location, duration, stipend, deadline: ahead(20 + i * 5), tradeId: trades[i]?.id ?? null,
  })));
  const apps = [
    [1, U.s1, 1, 'COMPLETED'], [2, U.s2, 2, 'COMPLETED'], [3, U.s3, 3, 'COMPLETED'], [4, U.s4, 4, 'COMPLETED'], [5, U.s1, 5, 'COMPLETED'],
    [6, U.s2, 1, 'COMPLETED'], [7, U.s3, 1, 'PENDING'], [8, U.s4, 2, 'REJECTED'], [9, U.s1, 2, 'IN_PROGRESS'], [10, U.s2, 3, 'APPROVED'],
  ];
  await ins('internshipApplication', apps.map(([n, studentId, i, status]) => ({
    id: `seed-app-${n}`, studentId, internshipId: `seed-intern-${i}`, status, message: 'I am motivated to learn and contribute.', appliedAt: ago(40 - n), reviewedAt: status === 'PENDING' ? null : ago(30 - n),
  })));

  // ---------- teaching: materials, lessons, assignments, quizzes ----------
  await ins('trainerMaterial', [1, 2, 3, 4, 5].map((n) => ({
    id: `seed-material-${n}`, title: ['HTML & CSS notes', 'SQL cheat sheet', 'Networking labs guide', 'OS commands', 'Design basics'][n - 1],
    description: 'Demo learning material', fileUrl: n % 2 ? '/uploads/1779108610454-783977686.pdf' : '/uploads/1779059028545-374700205.pdf',
    fileName: `material-${n}.pdf`, fileType: 'application/pdf', trainerId: n === 3 ? U.trainer2 : U.trainer1, classGroupId: n <= 3 ? `seed-class-${n}` : null,
  })));
  const enrol = [[U.s1, 0, 80, 'IN_PROGRESS'], [U.s1, 1, 100, 'COMPLETED'], [U.s2, 0, 100, 'COMPLETED'], [U.s3, 1, 60, 'IN_PROGRESS'], [U.s4, 2, 25, 'ENROLLED'], [U.s5, 3, 5, 'ENROLLED'], [U.s2, 2, 90, 'IN_PROGRESS']];
  await ins('courseEnrollment', enrol.map(([userId, m, progress, status], i) => ({ id: `seed-enrol-${i + 1}`, userId, moduleId: M(m), progress, status })));
  await ins('lesson', [1, 2, 3, 4, 5].map((n) => ({
    id: `seed-lesson-${n}`, moduleId: M(n - 1), trainerId: n === 3 ? U.trainer2 : U.trainer1, title: `Lesson ${n}: ${['Getting started', 'Core concepts', 'Hands-on lab', 'Troubleshooting', 'Review'][n - 1]}`,
    content: 'Demo lesson content. Replace with real material from the Learning Studio.', order: n, published: true,
  })));
  await ins('assignment', [1, 2, 3, 4, 5].map((n) => ({
    id: `seed-assign-${n}`, moduleId: M(n - 1), trainerId: n === 3 ? U.trainer2 : U.trainer1, title: `Assignment ${n}`,
    instructions: 'Complete the exercise and submit your answer or file.', dueAt: ahead(7 * n), maxScore: 100, published: true,
  })));
  const subs = [[1, U.s1, 85, 'GRADED'], [1, U.s2, 92, 'GRADED'], [2, U.s1, 78, 'GRADED'], [3, U.s3, null, 'SUBMITTED'], [4, U.s2, 66, 'GRADED']];
  await ins('assignmentSubmission', subs.map(([a, studentId, score, status], i) => ({
    id: `seed-sub-${i + 1}`, assignmentId: `seed-assign-${a}`, studentId, answer: 'My answer to the assignment.', status, score,
    feedback: score == null ? null : 'Good work, keep it up.', gradedById: score == null ? null : U.trainer1, gradedAt: score == null ? null : ago(2),
  })));
  const questionSet = (topic) => JSON.stringify([
    { prompt: `What does ${topic} mainly help you do?`, options: ['Solve the problem', 'Delete data', 'Nothing', 'Break things'], answerIndex: 0, points: 1 },
    { prompt: `Which is a best practice for ${topic}?`, options: ['Skip testing', 'Document your work', 'Ignore errors', 'Share passwords'], answerIndex: 1, points: 1 },
    { prompt: `${topic}: which statement is true?`, options: ['It never changes', 'It needs practice', 'It is magic', 'It is optional'], answerIndex: 1, points: 2 },
  ]);
  const topics = ['HTML', 'SQL', 'Networking', 'Operating systems', 'Design'];
  await ins('quiz', topics.map((t, i) => ({
    id: `seed-quiz-${i + 1}`, moduleId: M(i), trainerId: i === 2 ? U.trainer2 : U.trainer1, title: `${t} quiz`, description: `Short check on ${t}.`,
    questions: questionSet(t), passMark: 50, published: true,
  })));
  const attempts = [[1, U.s1, 4, true], [1, U.s2, 4, true], [2, U.s3, 2, false], [3, U.s4, 3, true], [4, U.s2, 1, false]];
  await ins('quizAttempt', attempts.map(([q, studentId, score, passed], i) => ({
    id: `seed-attempt-${i + 1}`, quizId: `seed-quiz-${q}`, studentId, answers: JSON.stringify([0, 1, 1]), score, total: 4, passed,
  })));

  // ---------- certificates ----------
  const signatories = [
    ['seed-signatory-1', 'Dr. Mukasa Anne', 'Director General', true],
    ['seed-signatory-2', 'Eng. Bizimana Paul', 'Head of Training', true],
    ['seed-signatory-3', 'Mrs. Uwimana Clarisse', 'Registrar', true],
    ['seed-signatory-4', 'Mr. Habyarimana Eric', 'Industry Partner', false],
    ['seed-signatory-5', 'Ms. Ingabire Diane', 'Quality Assurance', true],
  ];
  await ins('certificateSignatory', signatories.map(([id, fullName, title, isAuthorized]) => ({ id, fullName, title, institution: 'NTS Demo TVET School', isAuthorized, createdById: admin.id })));
  const sigJson = JSON.stringify(signatories.filter((s) => s[3]).slice(0, 2).map(([id, fullName, title]) => ({ id, fullName, title })));
  await ins('certificateTemplate', [
    ['seed-template-1', 'NTS Standard', '#163b65', '#c7a34b', true],
    ['seed-template-2', 'NTS Green', '#166534', '#f59e0b', false],
    ['seed-template-3', 'NTS Classic', '#1f2937', '#b45309', false],
    ['seed-template-4', 'NTS Internship', '#0f766e', '#facc15', false],
    ['seed-template-5', 'NTS Modern', '#4c1d95', '#22d3ee', false],
  ].map(([id, name, primaryColor, secondaryColor, isDefault]) => ({ id, name, institution: 'NTS Demo TVET School', primaryColor, secondaryColor, isDefault, createdById: admin.id, layoutJson: JSON.stringify({ orientation: 'landscape' }) })));
  const certs = [[1, U.s1, 0, 'ACTIVE', 88], [2, U.s2, 0, 'ACTIVE', 93], [3, U.s3, 1, 'ACTIVE', 81], [4, U.s1, 1, 'ACTIVE', 76], [5, U.s2, 2, 'SUSPENDED', 70]];
  await ins('certificate', certs.map(([n, studentId, m, status, finalScore]) => ({
    id: `seed-cert-${n}`, studentId, moduleId: M(m), code: `NTS-DEMO-${String(n).padStart(4, '0')}`, status, finalScore,
    assessmentSummary: JSON.stringify([{ label: 'Final assessment', score: finalScore }]), templateName: 'NTS Standard', templateId: 'seed-template-1', signaturesJson: sigJson, issuedAt: ago(20 - n),
  })));
  const reqs = [[1, U.s1, 0, 'APPROVED'], [2, U.s2, 0, 'APPROVED'], [3, U.s3, 1, 'APPROVED'], [4, U.s4, 2, 'PENDING'], [5, U.s5, 3, 'REJECTED']];
  await ins('certificateRequest', reqs.map(([n, studentId, m, status]) => ({
    id: `seed-certreq-${n}`, studentId, moduleId: M(m), status, note: status === 'REJECTED' ? 'Progress is below the required level.' : null,
    reviewedById: status === 'PENDING' ? null : admin.id, reviewedAt: status === 'PENDING' ? null : ago(3),
  })));
  await ins('certificateAuditLog', certs.map(([n]) => ({ id: `seed-certlog-${n}`, certificateId: `seed-cert-${n}`, actorId: admin.id, action: 'ISSUED', details: JSON.stringify({ templateId: 'seed-template-1' }) })));
  await ins('certificatePolicy', [0, 1, 2, 3, 4].map((m) => ({
    id: `seed-policy-${m + 1}`, moduleId: M(m), requireQuiz: m < 3, quizId: m < 3 ? `seed-quiz-${m + 1}` : null, minimumScore: 70, maxAttempts: 3, updatedById: admin.id,
  })));
  await ins('internshipCertificateRequest', apps.slice(0, 6).map(([n, studentId], i) => ({
    id: `seed-intcertreq-${n}`, studentId, applicationId: `seed-app-${n}`, status: n === 6 ? 'PENDING' : 'APPROVED', reviewedById: n === 6 ? null : admin.id, reviewedAt: n === 6 ? null : ago(4),
  })));
  await ins('internshipCertificate', apps.slice(0, 5).map(([n, studentId, i]) => ({
    id: `seed-intcert-${n}`, studentId, applicationId: `seed-app-${n}`, code: `NTS-INT-DEMO-${String(n).padStart(4, '0')}`, internshipTitle: internships[i - 1][0], company: internships[i - 1][1],
    finalScore: 80 + n, assessmentSummary: JSON.stringify([{ label: 'Supervisor evaluation', score: 80 + n }]), startDate: ago(120), endDate: ago(30), templateId: 'seed-template-4', signaturesJson: sigJson, issuedAt: ago(10 - n),
  })));

  // ---------- private learning files (placeholder text files so the download link works) ----------
  const privateDir = path.join(__dirname, '..', 'private_uploads');
  fs.mkdirSync(privateDir, { recursive: true });
  const resources = [1, 2, 3, 4, 5].map((n) => {
    const storageName = `seed-resource-${n}.txt`;
    const body = `Demo learning resource ${n}.\nReplace this with a real file from Learning Studio.\n`;
    const file = path.join(privateDir, storageName);
    if (!fs.existsSync(file)) fs.writeFileSync(file, body);
    return { id: `seed-resource-${n}`, moduleId: M(n - 1), trainerId: n === 3 ? U.trainer2 : U.trainer1, title: `Course pack ${n}`, description: 'Demo file', storageName, originalName: `course-pack-${n}.txt`, mimeType: 'text/plain', sizeBytes: Buffer.byteLength(body), isPublished: true };
  });
  await ins('learningResource', resources);

  // ---------- V5.1: parent links and admin audit trail ----------
  await ins('parentStudent', [[1, U.parent1, U.s1, 'Mother'], [2, U.parent1, U.s2, 'Mother'], [3, U.parent2, U.s3, 'Father'], [4, U.parent2, U.s4, 'Guardian'], [5, U.parent1, U.s5, 'Aunt']]
    .map(([n, parentId, studentId, relationship]) => ({ id: `seed-parentlink-${n}`, parentId, studentId, relationship })));
  await ins('adminAuditLog', [
    ['USER_CREATED', U.trainer1], ['USER_CREATED', U.s1], ['USER_DEACTIVATED', U.s5], ['ROLE_CHANGED', U.employer], ['PARENT_LINKED', U.s1],
  ].map(([action, targetId], i) => ({ id: `seed-audit-${i + 1}`, actorId: admin.id, targetId, action, details: 'demo data', createdAt: ago(6 - i) })));

  // ---------- V5.2: announcements and notifications ----------
  await ins('announcement', [
    ['seed-announce-1', 'Welcome to the new term', 'Classes start Monday. Check your timetable and course notes in the Learning Studio.', 'ALL', 'NORMAL', true, U.admin2],
    ['seed-announce-2', 'Quiz on Friday', 'Web Programming quiz covers chapters 1 to 3. Bring your questions.', 'STUDENT', 'IMPORTANT', false, U.trainer1],
    ['seed-announce-3', 'Parents meeting', 'Parents are invited to the progress meeting on the last Saturday of the month.', 'PARENT', 'IMPORTANT', false, U.admin2],
    ['seed-announce-4', 'Internship applications close soon', 'Submit your internship applications before the deadline shown on the Internships page.', 'STUDENT', 'URGENT', false, U.admin2],
    ['seed-announce-5', 'Employer open day', 'Employers are invited to meet certified students at the open day next month.', 'EMPLOYER', 'NORMAL', false, U.admin2],
  ].map(([id, title, body, audience, priority, pinned, authorId], i) => ({ id, title, body, audience, priority, pinned, authorId, expiresAt: ahead(30), createdAt: ago(5 - i) })));
  await ins('notification', [
    ['seed-notif-1', U.s1, 'ANNOUNCEMENT', 'Welcome to the new term', 'Classes start Monday.', '/announcements', false],
    ['seed-notif-2', U.s1, 'GRADE', 'Your assignment was graded', 'Assignment 1: 85/100', '/learning', false],
    ['seed-notif-3', U.s2, 'GRADE', 'Your assignment was graded', 'Assignment 1: 92/100', '/learning', true],
    ['seed-notif-4', U.parent1, 'ANNOUNCEMENT', 'Parents meeting', 'Progress meeting on the last Saturday.', '/announcements', false],
    ['seed-notif-5', U.s3, 'APPLICATION', 'Internship application completed', 'IT Helpdesk Intern', '/internships', true],
  ].map(([id, userId, type, title, body, link, isRead], i) => ({ id, userId, type, title, body, link, isRead, createdAt: ago(3, i) })));

  // ---------- site settings (the real "site" row is never touched) + marker so startup skips next time ----------
  await ins('siteSetting', [
    ['platform.name', 'NTS Professional LMS'], ['platform.tagline', 'Learn - Practice - Excel'],
    ['support.email', ADMIN_EMAIL], ['support.phone', '+250788000000'], [MARKER, new Date().toISOString()],
  ].map(([key, value]) => ({ key, value })));

  console.log(`🌱 Demo data ready (${Object.keys(stats).length} tables). Demo login password: ${DEMO_PASSWORD}`);
  return { skipped: false, stats };
}

// ---------------------------------------------------------------------------------
// V5.3 demo data: family threads/messages, attendance, teacher remarks, school events
// (5 rows each). Separate marker so databases seeded by older versions get these too.
// ---------------------------------------------------------------------------------
const MARKER_V53 = 'seed.demo.v53';
async function seedDemoDataV53(client, { force = false } = {}) {
  const prisma = client || require('../lib/prisma');
  if (!force && (await prisma.siteSetting.findUnique({ where: { key: MARKER_V53 } }))) return { skipped: true };
  // needs the base demo users; if they are missing (SEED_DEMO_DATA was false) there is nothing to attach to
  const base = await prisma.user.findMany({ where: { id: { in: ['seed-user-parent1', 'seed-user-parent2', 'seed-user-trainer1', 'seed-user-trainer2', 'seed-user-student1', 'seed-user-student2', 'seed-user-student3', 'seed-user-student4'] } }, select: { id: true } });
  if (base.length < 8) return { skipped: true };
  const ins = (model, rows) => prisma[model].createMany({ data: rows, skipDuplicates: true });
  const P1 = 'seed-user-parent1'; const P2 = 'seed-user-parent2'; const T1 = 'seed-user-trainer1'; const T2 = 'seed-user-trainer2';
  const S = ['seed-user-student1', 'seed-user-student2', 'seed-user-student3', 'seed-user-student4'];

  // existing demo parent links are approved; make sure old rows (before the status column) are too
  await prisma.parentStudent.updateMany({ where: { id: { startsWith: 'seed-parentlink-' } }, data: { status: 'APPROVED' } });

  const threads = [
    ['seed-thread-1', P1, T1, S[0], 'How is Eric doing in Web Programming?', 'OPEN'],
    ['seed-thread-2', P1, T1, S[1], 'Grace missed Monday class', 'OPEN'],
    ['seed-thread-3', P2, T1, S[2], 'Extra help with databases', 'OPEN'],
    ['seed-thread-4', P2, T2, S[3], 'Networking lab fees and materials', 'CLOSED'],
    ['seed-thread-5', P1, T2, S[0], 'Internship advice for Eric', 'OPEN'],
  ];
  await ins('familyThread', threads.map(([id, parentId, trainerId, studentId, subject, status], i) => ({ id, parentId, trainerId, studentId, subject, status, createdAt: ago(9 - i), updatedAt: ago(4 - (i % 3)) })));
  const msgs = [
    [1, 'seed-thread-1', P1, 'Good afternoon teacher. How is Eric doing in class?'],
    [2, 'seed-thread-1', T1, 'Good afternoon. Eric is doing well - he finished his responsive page and scored 85 on the first assignment.'],
    [3, 'seed-thread-2', P1, 'Grace was home sick on Monday. Can she catch up on the notes?'],
    [4, 'seed-thread-2', T1, 'Of course. I marked it as excused and shared the notes in the Learning Studio.'],
    [5, 'seed-thread-3', P2, 'David finds normalisation hard. Is there extra practice available?'],
    [6, 'seed-thread-3', T1, 'Yes, I will add a practice quiz this week and he can ask me questions after class.'],
    [7, 'seed-thread-4', P2, 'Which materials does Sandra need for the networking lab?'],
    [8, 'seed-thread-4', T2, 'Only a notebook; the lab equipment is provided. Thank you!'],
    [9, 'seed-thread-5', P1, 'Which internship would you advise for Eric?'],
    [10, 'seed-thread-5', T2, 'The Junior Web Developer internship suits his skills. He should apply before the deadline.'],
  ];
  await ins('familyMessage', msgs.map(([n, threadId, senderId, content]) => ({ id: `seed-fmsg-${n}`, threadId, senderId, content, createdAt: ago(8 - Math.floor(n / 2), 10 - n) })));

  // attendance: 5 school days for 4 students (20 rows)
  const days = [1, 2, 3, 4, 5].map((n) => { const d = new Date(Date.now() - n * DAY); d.setUTCHours(0, 0, 0, 0); return d; });
  const pattern = { 0: ['PRESENT', 'PRESENT', 'LATE', 'PRESENT', 'PRESENT'], 1: ['PRESENT', 'EXCUSED', 'PRESENT', 'PRESENT', 'PRESENT'], 2: ['ABSENT', 'PRESENT', 'PRESENT', 'ABSENT', 'PRESENT'], 3: ['PRESENT', 'LATE', 'PRESENT', 'PRESENT', 'ABSENT'] };
  const att = [];
  S.forEach((studentId, si) => days.forEach((date, di) => att.push({ id: `seed-att-${si + 1}-${di + 1}`, studentId, trainerId: T1, date, status: pattern[si][di], note: pattern[si][di] === 'EXCUSED' ? 'Sick - parent informed' : null })));
  await ins('attendance', att);

  await ins('teacherRemark', [
    ['seed-remark-1', S[0], T1, 'PRAISE', 'Eric helps classmates during labs and always submits on time.'],
    ['seed-remark-2', S[1], T1, 'NOTE', 'Grace should revise CSS flexbox before the Friday quiz.'],
    ['seed-remark-3', S[2], T1, 'CONCERN', 'David missed two classes this week and is behind on the database assignment.'],
    ['seed-remark-4', S[3], T2, 'PRAISE', 'Sandra configured her first VLAN without any help. Excellent!'],
    ['seed-remark-5', S[0], T2, 'NOTE', 'Consider joining the networking club - good fit for your skills.'],
  ].map(([id, studentId, trainerId, type, content], i) => ({ id, studentId, trainerId, type, content, createdAt: ago(5 - i) })));

  await ins('schoolEvent', [
    ['seed-event-1', 'Parents & teachers meeting', 'Progress meeting for all parents. Bring your questions.', 6, 'Main hall', 'PARENT'],
    ['seed-event-2', 'Web Programming quiz', 'Chapters 1 to 3.', 3, 'Lab 1', 'STUDENT'],
    ['seed-event-3', 'Employer open day', 'Meet certified students and discuss internships.', 14, 'Auditorium', 'EMPLOYER'],
    ['seed-event-4', 'Trainers planning workshop', 'Plan next term timetable and assessments.', 8, 'Staff room', 'TRAINER'],
    ['seed-event-5', 'NTS graduation day', 'Certificates are handed to graduating students.', 30, 'School grounds', 'ALL'],
  ].map(([id, title, description, inDays, location, audience]) => ({ id, title, description, location, audience, startsAt: ahead(inDays), createdById: 'seed-user-admin2' })));

  await prisma.siteSetting.upsert({ where: { key: MARKER_V53 }, update: { value: new Date().toISOString() }, create: { key: MARKER_V53, value: new Date().toISOString() } });
  console.log('🌱 V5.3 demo data ready (family chat, attendance, remarks, events)');
  return { skipped: false };
}

// V5.4 demo data: online attendance sessions, check-ins and absence excuses (5+ rows each)
const MARKER_V54 = 'seed.demo.v54';
async function seedDemoDataV54(client, { force = false } = {}) {
  const prisma = client || require('../lib/prisma');
  if (!force && (await prisma.siteSetting.findUnique({ where: { key: MARKER_V54 } }))) return { skipped: true };
  const base = await prisma.user.count({ where: { id: { in: ['seed-user-trainer1', 'seed-user-trainer2', 'seed-user-student1', 'seed-user-student2', 'seed-user-student3', 'seed-user-student4'] } } });
  if (base < 6) return { skipped: true };
  const ins = (model, rows) => prisma[model].createMany({ data: rows, skipDuplicates: true });
  const day = (n) => { const d = new Date(Date.now() - n * DAY); return d; };
  const sessions = [
    ['seed-session-1', 'seed-user-trainer1', 'seed-class-1', 'Web Programming - HTML forms', 'VERIFIED', true, false, 6, '48213'],
    ['seed-session-2', 'seed-user-trainer1', 'seed-class-1', 'Web Programming - CSS grid', 'VERIFIED', false, false, 4, '30977'],
    ['seed-session-3', 'seed-user-trainer1', 'seed-class-2', 'Databases - normalisation', 'CLOSED', false, false, 2, '75120'],
    ['seed-session-4', 'seed-user-trainer2', 'seed-class-3', 'Networking - VLAN lab', 'VERIFIED', true, true, 3, '16654'],
    ['seed-session-5', 'seed-user-trainer1', 'seed-class-1', 'Web Programming - JavaScript basics', 'OPEN', false, false, 0, '12345'],
  ];
  await ins('attendanceSession', sessions.map(([id, trainerId, classGroupId, title, status, sp, sa, n, code]) => {
    const startsAt = n === 0 ? new Date() : day(n);
    return { id, trainerId, classGroupId, title, status, sharedWithParents: sp, sharedWithAdmin: sa, code, startsAt, opensUntil: n === 0 ? new Date(Date.now() + 60 * 60_000) : new Date(startsAt.getTime() + 30 * 60_000), meetingLink: 'https://meet.example.com/nts-demo', verifiedAt: status === 'VERIFIED' ? startsAt : null };
  }));
  const at = (sid, minutes) => { const s = sessions.find((x) => x[0] === sid); const base0 = s[7] === 0 ? new Date() : day(s[7]); return new Date(base0.getTime() + minutes * 60_000); };
  await ins('attendanceCheckin', [
    ['seed-checkin-1', 'seed-session-1', 'seed-user-student1', 2, 'CONFIRMED'],
    ['seed-checkin-2', 'seed-session-1', 'seed-user-student2', 5, 'CONFIRMED'],
    ['seed-checkin-3', 'seed-session-2', 'seed-user-student1', 1, 'CONFIRMED'],
    ['seed-checkin-4', 'seed-session-2', 'seed-user-student2', 28, 'REJECTED'],
    ['seed-checkin-5', 'seed-session-3', 'seed-user-student3', 3, 'PENDING'],
    ['seed-checkin-6', 'seed-session-4', 'seed-user-student4', 4, 'CONFIRMED'],
    ['seed-checkin-7', 'seed-session-5', 'seed-user-student1', 1, 'PENDING'],
  ].map(([id, sessionId, studentId, min, decision]) => ({ id, sessionId, studentId, decision, checkedInAt: at(sessionId, min) })));
  await ins('absenceExcuse', [
    ['seed-excuse-1', 'seed-user-student2', 'seed-user-parent1', 4, 'I had a fever and stayed home.', 'APPROVED'],
    ['seed-excuse-2', 'seed-user-student3', 'seed-user-parent2', 2, 'Family emergency in Huye.', 'PENDING'],
    ['seed-excuse-3', 'seed-user-student4', 'seed-user-student4', 8, 'No internet at home during the online class.', 'PENDING'],
    ['seed-excuse-4', 'seed-user-student1', 'seed-user-student1', 10, 'Dentist appointment.', 'REJECTED'],
    ['seed-excuse-5', 'seed-user-student3', 'seed-user-student3', 1, 'Power cut during the lesson.', 'PENDING'],
  ].map(([id, studentId, submittedById, n, reason, status]) => {
    const d = day(n); d.setUTCHours(0, 0, 0, 0);
    return { id, studentId, submittedById, date: d, reason, status, decidedById: status === 'PENDING' ? null : 'seed-user-trainer1', decidedAt: status === 'PENDING' ? null : new Date() };
  }));
  await prisma.siteSetting.upsert({ where: { key: MARKER_V54 }, update: { value: new Date().toISOString() }, create: { key: MARKER_V54, value: new Date().toISOString() } });
  console.log('🌱 V5.4 demo data ready (online attendance sessions, check-ins, excuses)');
  return { skipped: false };
}

// V5.5 demo data: trainer class assignments, parent shares, video views, certificate questions,
// Pro requests, meetings and saved notes (5+ rows each) + a real demo verification document.
const MARKER_V55 = 'seed.demo.v55';
async function seedDemoDataV55(client, { force = false } = {}) {
  const prisma = client || require('../lib/prisma');
  if (!force && (await prisma.siteSetting.findUnique({ where: { key: MARKER_V55 } }))) return { skipped: true };
  const base = await prisma.user.count({ where: { id: { in: ['seed-user-trainer1', 'seed-user-trainer2', 'seed-user-student1', 'seed-user-student2', 'seed-user-student3', 'seed-user-student4', 'seed-user-student5'] } } });
  if (base < 7) return { skipped: true };
  const ins = (model, rows) => prisma[model].createMany({ data: rows, skipDuplicates: true });
  const T1 = 'seed-user-trainer1'; const T2 = 'seed-user-trainer2'; const S = ['seed-user-student1', 'seed-user-student2', 'seed-user-student3', 'seed-user-student4', 'seed-user-student5'];

  await ins('trainerAssignment', [[T1, 'seed-class-1'], [T1, 'seed-class-2'], [T2, 'seed-class-3'], [T2, 'seed-class-4'], [T2, 'seed-class-5']].map(([trainerId, classGroupId], i) => ({ id: `seed-assign-${i + 1}`, trainerId, classGroupId })));
  await ins('parentShare', [[S[0], 'MARKS'], [S[0], 'ATTENDANCE'], [S[1], 'MARKS'], [S[2], 'CERTIFICATES'], [S[3], 'ATTENDANCE']].map(([studentId, kind], i) => ({ id: `seed-share-${i + 1}`, studentId, kind, grantedById: T1 })));
  await ins('lessonView', S.map((studentId, i) => ({ id: `seed-lview-${i + 1}`, lessonId: `seed-lesson-${i + 1}`, studentId, watchedPct: i < 3 ? 100 : 40, completedAt: i < 3 ? ago(i + 1) : null })));
  await ins('certificateQuestion', [
    ['Certificate has a wrong name', 'My name on the certificate is spelt Mugisha Erick, it should be Mugisha Eric.', 'ANSWERED', 'Thank you. We corrected the spelling and re-issued your certificate.'],
    ['Where do I download my certificate?', 'I cannot find the download button.', 'ANSWERED', 'Open Certificates, then press Download PDF under your certificate.'],
    ['Certificate request is still pending', 'I completed the module two weeks ago.', 'OPEN', null],
    ['Can I get an internship certificate?', 'I finished my internship at a company in Kigali.', 'OPEN', null],
    ['QR code does not verify', 'The QR code shows certificate not found.', 'OPEN', null],
  ].map(([subject, message, status, reply], i) => ({ id: `seed-cquestion-${i + 1}`, studentId: S[i], subject, message, status, reply, repliedById: reply ? 'seed-user-admin2' : null, repliedAt: reply ? ago(1) : null, createdAt: ago(5 - i) })));
  await ins('proRequest', [['MTN-2210-0041', 'APPROVED'], ['AIRTEL-8821-7710', 'REJECTED'], ['BK-004419-22', 'PENDING'], ['MTN-6633-1180', 'PENDING'], ['MTN-9087-3321', 'PENDING']].map(([reference, status], i) => ({ id: `seed-pro-${i + 1}`, studentId: S[i], reference, status, decidedById: status === 'PENDING' ? null : 'seed-user-admin2', decidedAt: status === 'PENDING' ? null : ago(2), createdAt: ago(6 - i) })));
  await prisma.user.updateMany({ where: { id: S[0] }, data: { isPro: true } });
  await prisma.user.updateMany({ where: { id: T1 }, data: { canEditEvents: true } });
  await ins('meeting', [
    ['seed-meeting-1', T1, 'Web Programming - revision Q&A', 0.2, 'seed-class-1'], ['seed-meeting-2', T1, 'Databases - office hour', 1, 'seed-class-2'],
    ['seed-meeting-3', T2, 'Networking lab walkthrough', 2, 'seed-class-3'], ['seed-meeting-4', 'seed-user-admin2', 'Staff & trainers weekly meeting', 3, null], ['seed-meeting-5', S[0], 'Study group: HTML & CSS', 1.5, null],
  ].map(([id, hostId, title, inDays, classGroupId]) => ({ id, hostId, title, room: `NTS-demo-${id.slice(-1)}-room`, startsAt: new Date(Date.now() + inDays * DAY), classGroupId, invitedIds: JSON.stringify(classGroupId ? [] : [S[1], S[2], T1].filter((x) => x !== hostId)), status: 'SCHEDULED' })));
  await ins('meetingJoin', [['seed-meeting-1', S[0]], ['seed-meeting-1', S[1]], ['seed-meeting-3', S[3]], ['seed-meeting-5', S[1]], ['seed-meeting-5', S[2]]].map(([meetingId, userId], i) => ({ id: `seed-mjoin-${i + 1}`, meetingId, userId })));
  await ins('savedNote', S.map((userId, i) => ({ id: `seed-saved-${i + 1}`, userId, title: ['HTML cheat sheet', 'SQL joins notes', 'Network cabling guide', 'CSS flexbox summary', 'Operating systems notes'][i], url: 'https://developer.mozilla.org/', source: 'lesson' })));
  await prisma.siteSetting.upsert({ where: { key: 'cert.freeLimit' }, update: {}, create: { key: 'cert.freeLimit', value: '3' } });

  // a real (placeholder) document so "View document" works for the pending demo student
  try {
    const fs = require('fs'); const path = require('path');
    const dir = path.join(__dirname, '..', 'private-verifications');
    fs.mkdirSync(dir, { recursive: true });
    const file = 'seed-sandra-introduction-letter.svg';
    fs.writeFileSync(path.join(dir, file), '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560" viewBox="0 0 800 560"><rect width="800" height="560" fill="#fffdf6" stroke="#b8892b" stroke-width="6"/><text x="400" y="90" font-family="Georgia,serif" font-size="30" text-anchor="middle" fill="#0d4a34">NTS DEMO TVET SCHOOL</text><text x="400" y="140" font-family="Arial" font-size="18" text-anchor="middle" fill="#555">Introduction letter (demo document)</text><text x="60" y="230" font-family="Arial" font-size="18" fill="#222">To whom it may concern,</text><text x="60" y="280" font-family="Arial" font-size="18" fill="#222">This letter confirms that Mukamana Sandra is a student of</text><text x="60" y="310" font-family="Arial" font-size="18" fill="#222">Networking, Year 1 A at NTS Demo TVET School.</text><text x="60" y="440" font-family="Arial" font-size="16" fill="#555">Head teacher - signed (demo)</text></svg>');
    await prisma.user.updateMany({ where: { id: 'seed-user-student4' }, data: { verificationDocumentUrl: `/private-verifications/${file}`, schoolType: 'TVET' } });
  } catch (e) { console.warn('demo document skipped:', e.message); }

  await prisma.siteSetting.upsert({ where: { key: MARKER_V55 }, update: { value: new Date().toISOString() }, create: { key: MARKER_V55, value: new Date().toISOString() } });
  console.log('🌱 V5.5 demo data ready (assignments, shares, meetings, questions, Pro requests)');
  return { skipped: false };
}

module.exports = { seedDemoData, seedDemoDataV53, seedDemoDataV54, seedDemoDataV55 };

if (require.main === module) {
  seedDemoData(null, { force: true })
    .then(() => seedDemoDataV53(null, { force: true }))
    .then(() => seedDemoDataV54(null, { force: true }))
    .then(() => seedDemoDataV55(null, { force: true }))
    .then(async () => { await require('../lib/prisma').$disconnect(); })
    .catch(async (e) => { console.error('❌ Seed failed:', e); try { await require('../lib/prisma').$disconnect(); } catch (_) { /* ignore */ } process.exit(1); });
}
