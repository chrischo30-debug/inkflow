import { refreshGoogleAccessToken } from "./google-calendar";

interface SendGmailPayload {
  refreshToken: string;
  fromAddress: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

interface GmailSendResult {
  messageId: string;
  threadId: string;
}

function buildRfc2822(from: string, to: string, subject: string, body: string): string {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    body,
  ];
  return lines.join("\r\n");
}

export async function sendViaGmail(payload: SendGmailPayload): Promise<GmailSendResult> {
  const { refreshToken, fromAddress, fromName, to, subject, body, threadId } = payload;

  const accessToken = await refreshGoogleAccessToken(refreshToken);

  const raw = buildRfc2822(`${fromName} <${fromAddress}>`, to, subject, body);
  const encodedRaw = Buffer.from(raw).toString("base64url");

  const requestBody: Record<string, string> = { raw: encodedRaw };
  if (threadId) requestBody.threadId = threadId;

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed: ${text}`);
  }

  const data = (await res.json()) as { id: string; threadId: string };
  return { messageId: data.id, threadId: data.threadId };
}

export function gmailThreadUrl(threadId: string): string {
  return `https://mail.google.com/mail/u/0/#all/${threadId}`;
}
