// V6.2 demo data: 5 library files (real small text files, so Download works) and 5 bank questions per topic.
const fs = require('fs');
const path = require('path');
const MARKER = 'seed.v62';

async function seedDemoDataV62(client) {
  const prisma = client || require('../lib/prisma');
  if (await prisma.siteSetting.findUnique({ where: { key: MARKER } })) return { skipped: true };
  const owner = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'TRAINER'] }, deletedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true, fullName: true } });
  if (!owner) return { skipped: true };

  const dir = path.join(__dirname, '..', 'private_uploads', 'library');
  fs.mkdirSync(dir, { recursive: true });
  const books = [
    ['Computer Basics Handbook', 'NTS Trainers', 'ICT', 'Hardware, software, files and folders explained step by step.'],
    ['HTML & CSS Quick Reference', 'NTS Trainers', 'Web Development', 'Tags, selectors and layout cheat sheet.'],
    ['SQL Practice Questions', 'NTS Trainers', 'Databases', 'Twenty exercises on SELECT, JOIN and GROUP BY.'],
    ['Networking Cabling Guide', 'NTS Trainers', 'Networking', 'Straight and crossover cables, colour codes and testing.'],
    ['Past Paper: ICT Essentials', 'NTS Examinations', 'Past Papers', 'Previous end-of-term paper with marking guide.'],
  ];
  for (let i = 0; i < books.length; i++) {
    const [title, author, category, description] = books[i];
    const stored = `seed-library-${i + 1}.txt`;
    fs.writeFileSync(path.join(dir, stored), `${title}\n${'='.repeat(title.length)}\n\n${description}\n\n(Demo file. Upload real PDFs from Library > Add file.)\n`);
    await prisma.libraryItem.upsert({
      where: { id: `seed-library-${i + 1}` }, update: {},
      create: { id: `seed-library-${i + 1}`, title, author, category, description, fileUrl: stored, fileName: `${title}.txt`, fileType: 'text/plain', sizeBytes: 200, uploaderId: owner.id, uploaderName: owner.fullName, downloads: i * 3 },
    });
  }

  const mod = await prisma.module.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
  const qs = [
    ['What does CPU stand for?', ['Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Control Process Unit'], 0, 'Computer Basics', 'EASY'],
    ['Which HTML tag creates a hyperlink?', ['<link>', '<a>', '<href>', '<nav>'], 1, 'HTML', 'EASY'],
    ['Which SQL keyword removes duplicate rows from a result?', ['UNIQUE ROWS', 'DISTINCT', 'DIFFERENT', 'REMOVE'], 1, 'SQL', 'MEDIUM'],
    ['Which device connects different networks together?', ['Switch', 'Hub', 'Router', 'Repeater'], 2, 'Networking', 'MEDIUM'],
    ['What is the default port of HTTPS?', ['21', '80', '443', '8080'], 2, 'Networking', 'HARD'],
  ];
  for (let i = 0; i < qs.length; i++) {
    const [prompt, options, answerIndex, topic, difficulty] = qs[i];
    await prisma.bankQuestion.upsert({
      where: { id: `seed-bank-${i + 1}` }, update: {},
      create: { id: `seed-bank-${i + 1}`, ownerId: owner.id, moduleId: mod?.id || null, topic, difficulty, prompt, options: JSON.stringify(options), answerIndex, points: 1, explanation: 'Seeded demo question.' },
    });
  }
  await prisma.siteSetting.upsert({ where: { key: MARKER }, update: { value: new Date().toISOString() }, create: { key: MARKER, value: new Date().toISOString() } });
  console.log('✅ V6.2 demo library + question bank created');
  return { ok: true };
}

module.exports = { seedDemoDataV62 };
