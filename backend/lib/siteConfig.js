// Reads the admin's saved site settings (merged over the defaults) from anywhere in the backend.
const prisma = require('./prisma');
const defaults = require('./siteDefaults.json');

async function getSite() {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: 'site' } });
    const stored = row ? JSON.parse(row.value) : {};
    return { ...defaults, ...stored, system: { ...defaults.system, ...(stored.system || {}) } };
  } catch (e) {
    return defaults;
  }
}

// role -> setting key controlled by the admin in System Builder > Access
const SIGNUP_FLAG = { STUDENT: 'allowStudentSignup', PARENT: 'allowParentSignup', EMPLOYER: 'allowEmployerSignup', GUEST: 'allowGuestSignup' };
async function signupAllowed(role) {
  const flag = SIGNUP_FLAG[role];
  if (!flag) return true;
  const site = await getSite();
  return site.system[flag] !== false;
}

module.exports = { getSite, signupAllowed };
