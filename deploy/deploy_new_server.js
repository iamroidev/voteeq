const { exec } = require('child_process');

const host = 'ubuntu@54.215.75.184';
const key = 'C:\\Users\\richi\\Desktop\\ovistocks\\ovistocks-key.pem';

function runCommand(command) {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

async function main() {
  console.log('Deploying backend configuration and logo to new EC2 instance (54.215.75.184)...');

  console.log('1. Uploading backend .env file...');
  const uploadEnv = await runCommand(`scp -i "${key}" -o StrictHostKeyChecking=no "../backend/.env" "${host}:/home/ubuntu/backend.env"`);
  if (!uploadEnv.success) {
    console.error('Failed to upload .env:', uploadEnv.stderr);
    return;
  }
  console.log('Backend .env uploaded.');

  console.log('2. Uploading brand logo.png...');
  const uploadLogo = await runCommand(`scp -i "${key}" -o StrictHostKeyChecking=no "../backend/photos/logo.png" "${host}:/home/ubuntu/logo.png"`);
  if (!uploadLogo.success) {
    console.error('Failed to upload logo:', uploadLogo.stderr);
    return;
  }
  console.log('Logo uploaded.');

  console.log('3. Uploading ec2-bootstrap.sh...');
  const uploadBootstrap = await runCommand(`scp -i "${key}" -o StrictHostKeyChecking=no "../deploy/ec2-bootstrap.sh" "${host}:/home/ubuntu/ec2-bootstrap.sh"`);
  if (!uploadBootstrap.success) {
    console.error('Failed to upload bootstrap script:', uploadBootstrap.stderr);
    return;
  }
  console.log('ec2-bootstrap.sh uploaded.');

  console.log('4. Running ec2-bootstrap.sh as root...');
  const runBootstrap = await runCommand(`ssh -i "${key}" -o StrictHostKeyChecking=no ${host} "sudo bash /home/ubuntu/ec2-bootstrap.sh"`);
  if (!runBootstrap.success) {
    console.error('Bootstrap execution failed:', runBootstrap.stderr);
    console.log(runBootstrap.stdout);
    return;
  }
  console.log('Bootstrap execution successful.');
  console.log(runBootstrap.stdout);

  console.log('5. Copying logo.png into public photos folder...');
  const copyLogo = await runCommand(`ssh -i "${key}" -o StrictHostKeyChecking=no ${host} "sudo cp /home/ubuntu/logo.png /opt/voteeq/backend/photos/logo.png && sudo chmod 644 /opt/voteeq/backend/photos/logo.png"`);
  if (!copyLogo.success) {
    console.error('Failed to copy logo:', copyLogo.stderr);
    return;
  }
  console.log('Logo copied successfully.');

  console.log('\n============================================================');
  console.log('🎉 Server Bootstrapping and Deployment Successful!');
  console.log('============================================================');
}

main().catch(console.error);
