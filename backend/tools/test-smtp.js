require('../src/config/loadEnv');

const mailService = require('../src/services/mailService');

const getArgValue = (prefix) => {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (!found) return '';
  return found.slice(prefix.length).trim();
};

const main = async () => {
  const to = getArgValue('--to=');
  const subject = getArgValue('--subject=') || '[BeautyBook] SMTP test';

  if (!to) {
    console.error('Missing required argument: --to=email@example.com');
    process.exitCode = 1;
    return;
  }

  try {
    await mailService.verifySmtpConnection();

    const result = await mailService.sendEmail({
      to,
      subject,
      html: '<h3>SMTP connected successfully</h3><p>This is a real test email from BeautyBook backend.</p>',
      text: 'SMTP connected successfully. This is a real test email from BeautyBook backend.'
    });

    console.log('SMTP test email sent successfully.');
    console.log(`Message ID: ${result.messageId}`);
    console.log(`Accepted: ${(result.accepted || []).join(', ') || 'none'}`);
    if ((result.rejected || []).length) {
      console.log(`Rejected: ${result.rejected.join(', ')}`);
    }
  } catch (error) {
    console.error('SMTP test failed:', error.message || error);
    process.exitCode = 1;
  }
};

main();
