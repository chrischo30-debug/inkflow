import { LegalShell } from "@/components/legal/LegalShell";

export const metadata = {
  title: "Privacy Policy — FlashBooker",
  description: "Privacy Policy for FlashBooker, a booking management service for tattoo artists.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" lastUpdated="April 24, 2026">

      <p>
        This Privacy Policy explains how Day One Digital Marketing, LLC
        (&ldquo;<strong>FlashBooker</strong>,&rdquo; &ldquo;<strong>we</strong>,&rdquo;
        &ldquo;<strong>us</strong>&rdquo;) collects, uses, and shares information when you use our
        booking management service for tattoo artists (the &ldquo;<strong>Service</strong>&rdquo;).
        By using the Service you agree to the practices described here.
      </p>

      <h2>1. Who this applies to</h2>
      <p>
        FlashBooker has two kinds of users:
      </p>
      <ul>
        <li><strong>Artists</strong>, who create an account and use the dashboard to manage
          bookings, clients, and communications; and</li>
        <li><strong>Clients</strong>, who submit inquiries or book appointments through an
          Artist&apos;s public booking page.</li>
      </ul>
      <p>
        For Artist accounts, FlashBooker acts as the controller of the personal information we
        hold. For Client information that an Artist collects through the Service, the Artist is
        the controller and FlashBooker acts as a processor on the Artist&apos;s behalf. Clients
        with questions about how their information is used should contact the Artist directly;
        Clients may also contact us at support@flashbooker.app and we will route the request
        appropriately.
      </p>

      <h2>2. Information we collect</h2>

      <h3>From Artists</h3>
      <ul>
        <li><strong>Account information</strong>: email address, password (stored hashed), and
          profile details you provide (name, studio name, phone, logo image, booking page
          settings).</li>
        <li><strong>Business content</strong>: form templates, email templates, payment link
          configurations, calendar availability, and similar settings you create.</li>
        <li><strong>Integration credentials and data</strong>: API keys and OAuth tokens you
          connect (e.g., Stripe, Gmail, Google Calendar, Cal.com, Kit), and the data returned by
          those integrations that we need to provide the Service (for example, email threads,
          calendar events, payment records).</li>
        <li><strong>Communications with us</strong>: messages you send to support and related
          metadata.</li>
      </ul>

      <h3>From Clients (on behalf of the Artist)</h3>
      <ul>
        <li><strong>Contact details</strong>: name, email, phone.</li>
        <li><strong>Booking details</strong>: description of the requested tattoo, size,
          placement, budget, availability, reference images you upload, and any custom form
          fields the Artist has configured.</li>
        <li><strong>Appointment records</strong>: status, scheduled dates, deposit and payment
          status, and communications sent to you through the Service.</li>
      </ul>

      <h3>Collected automatically</h3>
      <ul>
        <li><strong>Log and device data</strong>: IP address, browser type, operating system,
          referring pages, and pages visited, used for security, debugging, and fraud prevention.</li>
        <li><strong>Cookies and similar technologies</strong>: used to keep you signed in and
          remember preferences. If we enable Google Analytics, it may set cookies to measure
          aggregated usage of the Service.</li>
      </ul>

      <p>
        We do not knowingly collect information from minors. The Service is intended for users
        18 years of age and older; if you believe a minor has provided personal information,
        please contact us and we will delete it.
      </p>

      <h2>3. How we use information</h2>
      <ul>
        <li>To provide, maintain, and improve the Service, including operating booking pages,
          sending transactional emails on an Artist&apos;s behalf, syncing calendars, and
          processing payments through the Artist&apos;s connected provider.</li>
        <li>To authenticate users and protect the Service from abuse, fraud, and unauthorized
          access.</li>
        <li>To communicate with Artists about their accounts, product updates, and support
          requests.</li>
        <li>To comply with legal obligations and enforce our Terms of Service.</li>
        <li>For aggregated analytics about how the Service is used, which may inform product
          decisions.</li>
      </ul>

      <h2>4. How we share information</h2>
      <p>
        We do not sell your personal information, and we do not share personal information for
        cross-context behavioral advertising. We share information only as described below:
      </p>

      <h3>Service providers we rely on</h3>
      <ul>
        <li><strong>Supabase</strong> — database hosting and authentication.</li>
        <li><strong>Stripe</strong> — payment processing (only when an Artist connects Stripe).</li>
        <li><strong>Resend</strong> — transactional email delivery.</li>
        <li><strong>Google (Gmail and Google Calendar)</strong> — inbox and calendar integration
          (only when an Artist connects their Google account). Our use of information received
          from Google APIs adheres to Google&apos;s Limited Use requirements.</li>
        <li><strong>Kit</strong> — newsletter signup integration (only when an Artist connects
          Kit).</li>
        <li><strong>Cal.com</strong> — scheduling link integration (only when an Artist connects
          Cal.com).</li>
        <li><strong>Google Analytics</strong> — aggregated usage analytics (if enabled). You may
          opt out using the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google Analytics browser add-on</a>.</li>
      </ul>

      <h3>Integrations you direct</h3>
      <p>
        When an Artist connects a third-party integration, we share with that provider only the
        information needed to fulfill the Artist&apos;s instructions (for example, sending an
        email, creating a calendar event, or issuing a payment link). The provider&apos;s own
        privacy policy governs its use of that information.
      </p>

      <h3>Legal reasons and business transfers</h3>
      <p>
        We may disclose information if required by law or legal process, to enforce our Terms, or
        to protect the rights, property, or safety of FlashBooker, our users, or the public. If
        FlashBooker is involved in a merger, acquisition, or sale of assets, user information
        may be transferred as part of that transaction; we will notify you of any material
        change in ownership or use.
      </p>

      <h2>5. Where data is stored</h2>
      <p>
        FlashBooker stores data on infrastructure located in the United States. The Service is
        intended for use within the United States. If you access the Service from outside the
        U.S., you understand that your information will be transferred to and processed in the
        U.S., which may have different data-protection laws than your country of residence.
      </p>

      <h2>6. Retention</h2>
      <p>
        We retain account and Service data for as long as your account remains active. When you
        delete your account, we delete or anonymize your personal information within a reasonable
        period, except where we are required to keep it (for example, for tax, accounting, or
        legal-compliance reasons), or where it is retained in routine backups that age out on a
        rolling basis. Artists are responsible for retention of Client information they have
        collected; deleting a booking or client in the dashboard removes it from active records
        on the same schedule.
      </p>

      <h2>7. Your rights and choices</h2>
      <p>
        You can access and update most of your account information directly in the dashboard,
        and you can delete your account from the settings page or by emailing us. Depending on
        where you live, you may also have the right to:
      </p>
      <ul>
        <li>request access to the personal information we hold about you;</li>
        <li>request correction of inaccurate information;</li>
        <li>request deletion of your information;</li>
        <li>request a copy of your information in a portable format;</li>
        <li>object to or restrict certain processing.</li>
      </ul>
      <p>
        To exercise any of these rights, email us at{" "}
        <a href="mailto:support@flashbooker.app">support@flashbooker.app</a>. We will respond
        within the timeframes required by applicable law (typically within 30 days). We may need
        to verify your identity before fulfilling a request. If you are a Client and would like
        to exercise rights over information an Artist collected through the Service, please
        contact the Artist; we will assist them in responding as their processor.
      </p>
      <p>
        <strong>California residents.</strong> Under the CCPA, you have the right to know what
        personal information we collect, to request deletion, to correct inaccurate information,
        and to not be discriminated against for exercising these rights. We do not &ldquo;sell&rdquo;
        or &ldquo;share&rdquo; personal information as those terms are defined by the CCPA.
      </p>

      <h2>8. Security</h2>
      <p>
        We use reasonable administrative, technical, and physical safeguards designed to protect
        information against unauthorized access, loss, or alteration, including encryption in
        transit, access controls, and hashed password storage. No method of transmission or
        storage is perfectly secure, and we cannot guarantee absolute security. You are
        responsible for keeping your password confidential and for notifying us promptly of any
        suspected unauthorized use of your account.
      </p>

      <h2>9. Cookies</h2>
      <p>
        We use cookies and similar technologies to keep you signed in, remember preferences, and
        (if enabled) measure aggregated usage through analytics providers. Most browsers let you
        refuse or delete cookies; if you do so, portions of the Service may not function
        properly.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. When we do, we will update the
        &ldquo;Last updated&rdquo; date above. If the changes are material, we will provide
        additional notice (for example, by email or in-product). Your continued use of the
        Service after the changes take effect means you accept the updated policy.
      </p>

      <h2>11. Contact us</h2>
      <p>
        Day One Digital Marketing, LLC<br />
        Pennsylvania, United States<br />
        Email: <a href="mailto:support@flashbooker.app">support@flashbooker.app</a>
      </p>

    </LegalShell>
  );
}
