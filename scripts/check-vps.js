const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const fs = require('fs');

async function psql(ssh, sql, label) {
    console.log(`\n--- ${label} ---`);
    // Write SQL to temp file on VPS then execute — avoid shell escaping hell
    const tmpFile = `/tmp/fix_migration_${Date.now()}.sql`;
    await ssh.execCommand(`cat > ${tmpFile} << 'SQLEOF'\n${sql}\nSQLEOF`);
    const result = await ssh.execCommand(
        `docker exec -i mellyna-education-postgres-1 psql -U mellyna -d mellyna_db < ${tmpFile}`
    );
    await ssh.execCommand(`rm -f ${tmpFile}`);
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.log('STDERR:', result.stderr);
    return result;
}

async function main() {
    try {
        const config = JSON.parse(fs.readFileSync('.gemini-ssh.json', 'utf8'));
        await ssh.connect({ host: config.host, username: config.username, password: config.password, port: 22 });
        console.log('✅ Connected to SSH\n');

        // 1. Cek enum Role
        await psql(ssh, `SELECT unnest(enum_range(NULL::"Role")) AS value;`, 'Step 1: Enum Role values');

        // 2. Cek FK constraints
        await psql(ssh,
            `SELECT constraint_name FROM information_schema.table_constraints WHERE constraint_name IN ('Expense_categoryId_fkey','Expense_createdById_fkey');`,
            'Step 2: FK constraints'
        );

        // 3. Tambah ADMIN enum jika belum ada
        await psql(ssh, `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' AND e.enumlabel = 'ADMIN'
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'ADMIN';
  END IF;
END
$$;
`, 'Step 3: Tambah ADMIN ke enum Role (idempotent)');

        // 4. Tambah FK constraints jika belum ada
        await psql(ssh, `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Expense_categoryId_fkey'
  ) THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
`, 'Step 4: FK categoryId (idempotent)');

        await psql(ssh, `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Expense_createdById_fkey'
  ) THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
`, 'Step 5: FK createdById (idempotent)');

        // 6. Hapus duplikat migration row (simpan yang terlama, hapus yang baru)
        await psql(ssh, `
DELETE FROM _prisma_migrations
WHERE migration_name = '20260807142948_add_expense_tracking'
  AND started_at = (
    SELECT MAX(started_at) FROM _prisma_migrations
    WHERE migration_name = '20260807142948_add_expense_tracking'
  );
`, 'Step 6: Hapus duplikat row migration');

        // 7. Verifikasi final
        await psql(ssh,
            `SELECT migration_name, started_at, finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = '20260807142948_add_expense_tracking';`,
            'Step 7: Verifikasi migration final'
        );
        await psql(ssh, `SELECT unnest(enum_range(NULL::"Role")) AS value;`, 'Step 8: Enum Role final');
        await psql(ssh,
            `SELECT constraint_name FROM information_schema.table_constraints WHERE constraint_name IN ('Expense_categoryId_fkey','Expense_createdById_fkey');`,
            'Step 9: FK constraints final'
        );

        ssh.dispose();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
