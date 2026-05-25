// src/services/email.js
/**
 * Sends data sa GHL for verification
 * 
 * Payload expected by GHL workflow:
 * { email, first_name, otp }
 */
export async function sendVerificationEmail(email, firstName, otp) {
  const webhookUrl = process.env.GHL_VERIFY_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error('GHL_VERIFY_WEBHOOK_URL not configured in environment variables');
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email,
      first_name: firstName,
      otp: otp
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to trigger GHL verification automation: ${response.statusText}`);
  }

  const data = await response.json().catch(() => ({}));
  console.log('Verification webhook triggered successfully:', data);
  return data;
}

/**
 * Send data sa GHL for Reset
 * 
 * Payload expected by GHL workflow:
 * { email, first_name, otp }
 */
export async function sendResetEmail(email, firstName, otp) {
  const webhookUrl = process.env.GHL_RESET_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error('GHL_RESET_WEBHOOK_URL not configured in environment variables');
  }
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email,
      first_name: firstName,
      otp: otp
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to trigger GHL reset automation: ${response.statusText}`);
  }

  const data = await response.json().catch(() => ({}));
  console.log('Reset password webhook triggered successfully:', data);
  return data;
}