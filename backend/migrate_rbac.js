import { prisma } from './src/database/index.js';

async function migrate() {
  try {
    console.log('--- Starting RBAC Migration ---');
    const usersBefore = await prisma.$queryRawUnsafe('SELECT id, email, role FROM users;');
    console.log('Users before migration:', usersBefore);

    console.log('1. Creating enum Role...');
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
          CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATOR');
        END IF;
      END
      $$;
    `);

    console.log('2. Altering users table role column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users 
      ALTER COLUMN role DROP DEFAULT,
      ALTER COLUMN role TYPE "Role" USING (
        CASE 
          WHEN UPPER(role) = 'ADMIN' THEN 'ADMIN'::"Role"
          ELSE 'OPERATOR'::"Role"
        END
      ),
      ALTER COLUMN role SET DEFAULT 'OPERATOR'::"Role";
    `);

    const usersAfter = await prisma.$queryRawUnsafe('SELECT id, email, role FROM users;');
    console.log('3. Users after migration:', usersAfter);

    const adminCountResult = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM users WHERE role = 'ADMIN'::"Role";`);
    const adminCount = adminCountResult[0]?.count || 0;
    console.log(`4. Verified ADMIN user count: ${adminCount}`);

    if (adminCount === 0) {
      console.warn('WARNING: No ADMIN user found! Promoting first user to ADMIN...');
      await prisma.$executeRawUnsafe(`UPDATE users SET role = 'ADMIN'::"Role" WHERE id = (SELECT id FROM users ORDER BY id ASC LIMIT 1);`);
    }

    console.log('--- Migration Completed Successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
