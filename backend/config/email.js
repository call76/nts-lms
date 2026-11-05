const nodemailer = require('nodemailer');

const emailConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

// Created lazily so a missing EMAIL_* config never crashes the server on startup.
// (The original code called nodemailer.createTransporter, which does not exist -
// the correct name is createTransport - and crashed the whole server on require.)
let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transporter;
};

// Function to send OTP to any user's email
const sendOTPEmail = async (toEmail, otp, type = 'verification') => {
  const subject = type === 'verification' ? 'Verify Your NTS Account' : 'Reset Your NTS Password';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>NTS OTP Verification</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 500px;
          margin: 50px auto;
          background: white;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #059669, #047857);
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          color: white;
          margin: 0;
          font-size: 28px;
        }
        .content {
          padding: 30px;
          text-align: center;
        }
        .otp-code {
          font-size: 48px;
          font-weight: bold;
          color: #059669;
          letter-spacing: 10px;
          background: #f0fdf4;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
          font-family: monospace;
        }
        .message {
          color: #374151;
          line-height: 1.6;
          margin-bottom: 20px;
        }
        .footer {
          background: #f9fafb;
          padding: 20px;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>NTS Platform</h1>
        </div>
        <div class="content">
          <h2>${type === 'verification' ? 'Email Verification' : 'Password Reset'}</h2>
          <p class="message">
            ${type === 'verification' 
              ? 'Thank you for registering with NTS Platform. Please use the following OTP to verify your email address:' 
              : 'We received a request to reset your password. Use the following OTP to proceed:'}
          </p>
          <div class="otp-code">${otp}</div>
          <p class="message">
            This OTP is valid for 10 minutes.<br>
            If you didn't request this, please ignore this email.
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} NTS Platform. All rights reserved.</p>
          <p>NEZERWA TECH SOLUTION</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"NTS Platform" <${process.env.EMAIL_USER}>`,
    to: toEmail,  // This is the USER'S email address (receiver)
    subject: subject,
    html: html
  };

  if (!emailConfigured()) {
    // Development fallback: print the code so the flow can still be tested
    console.warn(`⚠️  EMAIL_USER/EMAIL_PASS not set. OTP for ${toEmail}: ${otp}`);
    return !process.env.NODE_ENV || process.env.NODE_ENV !== 'production';
  }

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log(`✅ OTP sent to ${toEmail} - Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Email sending error:', error);
    return false;
  }
};

module.exports = { sendOTPEmail, emailConfigured };