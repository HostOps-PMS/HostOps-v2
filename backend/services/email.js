// src/services/email.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendViaGHL(webhookUrl, payload) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`GHL webhook HTTP error: ${response.statusText}`);
  }

  const data = await response.json().catch(() => ({}));
  if (typeof data.status === 'string' && data.status.startsWith('Error:')) {
    throw new Error(`GHL webhook error: ${data.status}`);
  }
  return data;
}

// firstName is user-controlled (sign-up form): escape it so nobody can plant
// links/HTML in an email that really comes from us.
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendOtpViaResend(email, rawFirstName, otp, subject) {
  const firstName = escapeHtml(rawFirstName);
  const from = process.env.EMAIL_FROM || 'HostPilot <onboarding@resend.dev>';
  await resend.emails.send({
    from,
    to: email,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Hi ${firstName},</h2>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px 0">${otp}</div>
        <p>This code expires in 10 minutes. Do not share it with anyone.</p>
        <p style="color:#888;font-size:12px">— HostPilot Team</p>
      </div>
    `,
  });
}

/**
 * Sends data sa GHL for verification
 *
 * Payload expected by GHL workflow:
 * { email, first_name, otp }
 */
export async function sendVerificationEmail(email, firstName, otp) {
  const webhookUrl = process.env.GHL_VERIFY_WEBHOOK_URL;

  if (webhookUrl) {
    try {
      const data = await sendViaGHL(webhookUrl, { email, first_name: firstName, otp });
      console.log('Verification webhook triggered successfully:', data);
      return data;
    } catch (err) {
      console.warn('GHL verify webhook failed, falling back to Resend:', err.message);
    }
  }

  await sendOtpViaResend(email, firstName, otp, 'Your HostPilot Verification Code');
  console.log('Verification OTP sent via Resend to:', email);
}

/**
 * Send data sa GHL for Reset
 *
 * Payload expected by GHL workflow:
 * { email, first_name, otp }
 */
export async function sendResetEmail(email, firstName, otp) {
  const webhookUrl = process.env.GHL_RESET_WEBHOOK_URL;

  if (webhookUrl) {
    try {
      const data = await sendViaGHL(webhookUrl, { email, first_name: firstName, otp });
      console.log('Reset password webhook triggered successfully:', data);
      return data;
    } catch (err) {
      console.warn('GHL reset webhook failed, falling back to Resend:', err.message);
    }
  }

  await sendOtpViaResend(email, firstName, otp, 'Your HostPilot Password Reset Code');
  console.log('Reset OTP sent via Resend to:', email);
}
