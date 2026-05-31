import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Reset Kata Sandi - Mellyna Education',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f8fafc; border-radius: 12px;">
        <img src="${process.env.NEXTAUTH_URL}/icons/mellyna-logo-primary.svg" alt="Mellyna Education" width="160" style="margin-bottom: 24px;" />
        <h2 style="color: #1A56DB; margin-bottom: 8px;">Reset Kata Sandi</h2>
        <p style="color: #475569; margin-bottom: 24px;">Hai <strong>${name}</strong>, kami menerima permintaan untuk mereset kata sandi akun Mellyna Education kamu.</p>
        <a href="${resetUrl}" style="display: inline-block; background: #1A56DB; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 24px;">
          Reset Kata Sandi
        </a>
        <p style="color: #94a3b8; font-size: 13px;">Link ini berlaku selama <strong>1 jam</strong>. Jika kamu tidak meminta reset kata sandi, abaikan email ini.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #cbd5e1; font-size: 12px;">© ${new Date().getFullYear()} Mellyna Education. All rights reserved.</p>
      </div>
    `,
  })
}
