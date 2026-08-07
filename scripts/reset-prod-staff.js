const { NodeSSH } = require('node-ssh');

async function main() {
  const ssh = new NodeSSH();

  const command1 = `docker exec mellyna-education-postgres-1 psql -U mellyna -d mellyna_db -c "ALTER TYPE \\"Role\\" ADD VALUE IF NOT EXISTS 'ADMIN';"`;
  const command2 = `docker exec mellyna-education-postgres-1 psql -U mellyna -d mellyna_db -c "UPDATE \\"User\\" SET role = 'ADMIN' WHERE email = 'staff@mellyna.id';"`;

  try {
    await ssh.connect({
      host: '43.133.152.91',
      username: 'ubuntu',
      password: 'quantum-67$-rocket'
    });

    console.log('Executing command 1...');
    let res1 = await ssh.execCommand(command1);
    console.log('STDOUT 1:', res1.stdout);
    console.log('STDERR 1:', res1.stderr);

    console.log('Executing command 2...');
    let res2 = await ssh.execCommand(command2);
    console.log('STDOUT 2:', res2.stdout);
    console.log('STDERR 2:', res2.stderr);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    ssh.dispose();
  }
}

main();
