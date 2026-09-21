import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_FROM_EMAIL,
    pass: process.env.SMTP_APP_PASSWORD ? process.env.SMTP_APP_PASSWORD.replace(/\s+/g, "") : undefined,
  },
});

export async function sendPasswordResetEmail(
  toEmail: string,
  fullName: string,
  resetLink: string,
): Promise<void> {
  await transporter.sendMail({
    from: `"Jimma City Administration" <${process.env.SMTP_FROM_EMAIL}>`,
    to: toEmail,
    subject: "Password Reset — Jimma City Address MIS",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 32px;">
        <div style="background: #0d2447; padding: 24px 32px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Jimma City Address MIS</h1>
          <p style="color: #93c5fd; margin: 8px 0 0; font-size: 13px;">Municipal Information System</p>
        </div>
        <div style="background: #ffffff; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
          <h2 style="color: #0d2447; font-size: 20px; margin: 0 0 8px;">Password Reset Request</h2>
          <p style="color: #374151; font-size: 15px;">Hello, <strong>${fullName}</strong>,</p>
          <p style="color: #374151; font-size: 15px;">
            We received a request to reset the password for your account. Click the button below to set a new password.
            This link is valid for <strong>1 hour</strong>.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}" style="background: linear-gradient(90deg, #0d2447, #1a5276); color: #ffffff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-size: 16px; font-weight: bold; display: inline-block;">
              Reset My Password
            </a>
          </div>
          <p style="color: #6b7280; font-size: 13px;">
            If you did not request this, you can safely ignore this email. Your password will remain unchanged.
          </p>
          <p style="color: #6b7280; font-size: 13px;">
            If the button above doesn't work, copy and paste this link into your browser:<br/>
            <a href="${resetLink}" style="color: #1a5276; word-break: break-all;">${resetLink}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            © ${new Date().getFullYear()} Jimma City Administration. All rights reserved.
          </p>
        </div>
      </div>
    `,
  });
}
