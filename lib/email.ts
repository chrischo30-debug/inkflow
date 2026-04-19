import { Resend } from 'resend';
import { BookingState } from './types';

// The key will be read from environment variables in production.
const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

interface TransitionEmailPayload {
  toEmail: string;
  clientName: string;
  newState: BookingState;
  artistName: string;
  paymentLink?: string;
}

export async function sendStateTransitionEmail(payload: TransitionEmailPayload) {
  const { toEmail, clientName, newState, artistName, paymentLink } = payload;
  
  let subject = '';
  let text = '';

  switch (newState) {
    case 'inquiry':
      subject = `Inquiry Received - ${artistName}`;
      text = `Hi ${clientName},\n\nWe received your inquiry. ${artistName} is reviewing it and will get back to you shortly.\n\nThanks,\nFlashBook`;
      break;
    case 'reviewed':
      subject = `Good news! Your inquiry was reviewed - ${artistName}`;
      text = `Hi ${clientName},\n\nYour tattoo idea looks great! ${artistName} has reviewed it. Please wait for the official deposit instructions shortly.\n\nThanks,\nFlashBook`;
      break;
    case 'deposit_sent':
      subject = `Action Required: Deposit for ${artistName}`;
      text = `Hi ${clientName},\n\nYour booking requires a deposit. Please pay to finalize your spot.\n\nPayment link: ${paymentLink || 'artist link here'}\n\nThanks,\nFlashBook`;
      break;
    case 'deposit_paid':
      subject = `Deposit Received - ${artistName}`;
      text = `Hi ${clientName},\n\nYour deposit was received. We are moving this to confirmed!\n\nThanks,\nFlashBook`;
      break;
    case 'confirmed':
      subject = `Appointment Confirmed - ${artistName}`;
      text = `Hi ${clientName},\n\nYou are locked in! We will send a calendar invite shortly.\n\nThanks,\nFlashBook`;
      break;
    case 'completed':
      subject = `Tattoo Completed - ${artistName}`;
      text = `Hi ${clientName},\n\nIt was a pleasure working with you. Take care of your new tattoo!\n\nThanks,\nFlashBook`;
      break;
    default:
      return;
  }

  if (process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY) {
    console.log('[MOCK EMAIL SENT]', { to: toEmail, subject, text });
    return;
  }

  try {
    await resend.emails.send({
      from: 'FlashBook <noreply@flashbook.app>',
      to: [toEmail],
      subject: subject,
      text: text,
    });
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}
