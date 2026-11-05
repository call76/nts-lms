const { PrismaClient } = require('@prisma/client');

// Single shared client (avoids exhausting DB connections)
const prisma = global.__ntsPrisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') global.__ntsPrisma = prisma;

module.exports = prisma;
