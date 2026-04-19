// User facing email sending logic with Resend
import { Resend } from 'resend';

// Only init if key exists for safety
export const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Stubbed email send function
export async function sendEmail({ to, subject, text, html }: { to: string, subject: string, text?: string, html?: string }) {
  if (!resend) {
    console.warn("No RESEND_API_KEY found, simulating email send.");
    return { id: 'simulated' };
  }
  
  return await resend.emails.send({
    from: 'InkFlow <no-reply@yourdomain.com>',
    to,
    subject,
    text: text || '',
    html,
  });
}
