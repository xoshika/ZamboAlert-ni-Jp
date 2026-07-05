import nodemailer from 'nodemailer';

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function hasRealSmtpConfig() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return Boolean(user && pass && !/your-/.test(user) && !/your-/.test(pass) && !user.includes('example') && !pass.includes('password'));
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (!hasRealSmtpConfig()) {
    console.warn('SMTP credentials are not configured. Email delivery is disabled.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

export async function sendVerificationEmail(to: string, code: string, purpose: 'verification' | 'reset') {
  const mailer = getTransporter();
  if (!mailer) {
    throw new Error('SMTP credentials are not configured. Set SMTP_USER and SMTP_PASS in backend/.env.');
  }

  const subject = purpose === 'reset'
    ? 'ZamboAlert password reset code'
    : 'Verify your ZamboAlert rescuer account';

  const title = purpose === 'reset' ? 'Password reset' : 'Account verification';
  const intro = purpose === 'reset'
    ? 'We received a request to reset your ZamboAlert rescuer password.'
    : 'Thanks for creating a ZamboAlert rescuer account.';

  const text = `${intro}\n\nYour verification code is: ${code}\n\nEnter this code in the app to continue.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #b91c1c;">ZamboAlert</h2>
      <p>${intro}</p>
      <p>Your ${title.toLowerCase()} code is:</p>
      <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; margin: 20px 0; color: #111827;">${code}</div>
      <p>Enter this code in the app to continue.</p>
    </div>
  `;

  return mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}
