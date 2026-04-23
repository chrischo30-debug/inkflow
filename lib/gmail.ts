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

// ── Inbox read types ─────────────────────────────────────────────────────────

interface GmailHeader { name: string; value: string }
interface GmailBodyPart {
  mimeType: string;
  headers?: GmailHeader[];
  body?: { data?: string; size: number };
  parts?: GmailBodyPart[];
}
interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailBodyPart & { headers?: GmailHeader[] };
}
interface GmailRawThread {
  id: string;
  historyId?: string;
  messages?: GmailMessage[];
}

export interface InboxThreadSummary {
  threadId: string;
  subject: string;
  from: string;
  fromEmail: string;
  snippet: string;
  date: string;
  unread: boolean;
  messageCount: number;
}

export interface InboxMessage {
  messageId: string;
  from: string;
  fromEmail: string;
  replyToEmail: string | null;
  to: string;
  subject: string;
  date: string;
  body: string;
  unread: boolean;
}

export interface InboxThreadDetail {
  threadId: string;
  subject: string;
  messages: InboxMessage[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getHeader(headers: GmailHeader[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseFrom(from: string): { name: string; email: string } {
  const m = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim(), email: m[2] };
  return { name: from, email: from };
}

function decodeBody(part: GmailBodyPart): string {
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf-8");
  }
  if (part.parts) {
    for (const p of part.parts) {
      if (p.mimeType === "text/plain" && p.body?.data) {
        return Buffer.from(p.body.data, "base64url").toString("utf-8");
      }
      if (p.mimeType.startsWith("multipart/")) {
        const nested = decodeBody(p);
        if (nested) return nested;
      }
    }
    for (const p of part.parts) {
      if (p.mimeType === "text/html" && p.body?.data) {
        return Buffer.from(p.body.data, "base64url")
          .toString("utf-8")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .trim();
      }
    }
  }
  return "";
}

// ── API calls ─────────────────────────────────────────────────────────────────

interface GmailThreadListItem { id: string; snippet: string; historyId: string }

export async function listGmailThreads(
  refreshToken: string,
  maxResults = 25,
  pageToken?: string,
): Promise<{ threads: GmailThreadListItem[]; nextPageToken?: string }> {
  const accessToken = await refreshGoogleAccessToken(refreshToken);
  const params = new URLSearchParams({ labelIds: "INBOX", maxResults: String(maxResults) });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Gmail threads list failed: ${await res.text()}`);
  const data = (await res.json()) as { threads?: GmailThreadListItem[]; nextPageToken?: string };
  return { threads: data.threads ?? [], nextPageToken: data.nextPageToken };
}

export async function getGmailThreadSummary(
  refreshToken: string,
  threadId: string,
  snippet: string,
): Promise<InboxThreadSummary> {
  const accessToken = await refreshGoogleAccessToken(refreshToken);
  const params = new URLSearchParams({ format: "metadata" });
  params.append("metadataHeaders", "From");
  params.append("metadataHeaders", "Subject");
  params.append("metadataHeaders", "Date");

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Gmail thread metadata failed: ${await res.text()}`);
  const thread = (await res.json()) as GmailRawThread;
  const messages = thread.messages ?? [];
  const firstMsg = messages[0];
  const lastMsg = messages[messages.length - 1];
  const firstHeaders = firstMsg?.payload?.headers ?? [];
  const lastHeaders = lastMsg?.payload?.headers ?? [];
  const { name, email } = parseFrom(getHeader(firstHeaders, "From"));
  const dateRaw = getHeader(lastHeaders, "Date");

  return {
    threadId,
    subject: getHeader(firstHeaders, "Subject") || "(no subject)",
    from: name || email,
    fromEmail: email,
    snippet,
    date: dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString(),
    unread: messages.some(m => m.labelIds?.includes("UNREAD")),
    messageCount: messages.length,
  };
}

export async function getGmailThreadDetail(
  refreshToken: string,
  threadId: string,
): Promise<InboxThreadDetail> {
  const accessToken = await refreshGoogleAccessToken(refreshToken);
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Gmail thread full fetch failed: ${await res.text()}`);
  const thread = (await res.json()) as GmailRawThread;
  const messages = (thread.messages ?? []).map(msg => {
    const headers = msg.payload?.headers ?? [];
    const { name, email } = parseFrom(getHeader(headers, "From"));
    const replyToRaw = getHeader(headers, "Reply-To");
    const replyToEmail = replyToRaw ? parseFrom(replyToRaw).email : null;
    const dateRaw = getHeader(headers, "Date");
    return {
      messageId: msg.id,
      from: name || email,
      fromEmail: email,
      replyToEmail: replyToEmail !== email ? replyToEmail : null,
      to: getHeader(headers, "To"),
      subject: getHeader(headers, "Subject") || "(no subject)",
      date: dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString(),
      body: msg.payload ? decodeBody(msg.payload) : "",
      unread: msg.labelIds?.includes("UNREAD") ?? false,
    } satisfies InboxMessage;
  });

  return { threadId, subject: messages[0]?.subject ?? "(no subject)", messages };
}

export async function markGmailThreadRead(refreshToken: string, threadId: string): Promise<void> {
  const accessToken = await refreshGoogleAccessToken(refreshToken);
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
}
