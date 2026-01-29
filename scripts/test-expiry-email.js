#!/usr/bin/env node

/**
 * Test script: Send a sample certificate expiry email via Strapi email API.
 *
 * Usage:
 *   STRAPI_TOKEN=your_token TO_EMAIL=your@email.com node scripts/test-expiry-email.js
 *
 * Optional:
 *   STRAPI_URL=https://admin.ryzolve.com  (default)
 *   TYPE=30-day|7-day|1-day|expired        (default: 30-day)
 */

const STRAPI_URL = process.env.STRAPI_URL || "https://admin.ryzolve.com";
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || "";
const TO_EMAIL = process.env.TO_EMAIL || "";
const TYPE = process.env.TYPE || "30-day";

const RENEWAL_BASE_URL = "https://training.ryzolve.com";

// If --html flag, output HTML to file for browser preview (no token needed)
if (process.argv.includes("--html")) {
  const email = getEmailTemplate(TYPE);
  const fs = require("fs");
  const path = require("path");
  const outFile = path.join(__dirname, `expiry-email-preview-${TYPE}.html`);
  fs.writeFileSync(outFile, email.html);
  console.log(`HTML preview saved to: ${outFile}`);
  console.log(`Open in browser: open ${outFile}`);
  process.exit(0);
}

if (!STRAPI_TOKEN || !TO_EMAIL) {
  console.error("ERROR: STRAPI_TOKEN and TO_EMAIL are required.");
  console.error(
    "Usage: STRAPI_TOKEN=xxx TO_EMAIL=you@email.com node scripts/test-expiry-email.js",
  );
  console.error("Optional: TYPE=30-day|7-day|1-day|expired");
  console.error(
    "\nFor HTML preview only: TYPE=30-day node scripts/test-expiry-email.js --html",
  );
  process.exit(1);
}

function getEmailTemplate(type) {
  const renewalUrl = `${RENEWAL_BASE_URL}/renewal?course=1`;
  const courseName = "16 Hours for New Administrators and Alternates";
  const userName = "Test User";

  const today = new Date();
  const issuedDate = new Date(today);
  issuedDate.setFullYear(issuedDate.getFullYear() - 1);
  const expiryDate = new Date(today);
  expiryDate.setDate(
    expiryDate.getDate() +
      (type === "30-day"
        ? 30
        : type === "7-day"
          ? 7
          : type === "1-day"
            ? 1
            : -1),
  );
  const expiryDateStr = expiryDate.toISOString().split("T")[0];

  // Common email wrapper
  const wrapEmail = (content, ctaText, ctaColor) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://fhfqjcc.stripocdn.email/content/guids/CABINET_e4cafd70dfbf78cd99f9e36321d47993cd56fe9c5c3482d5a73b875e3956e04b/images/screenshot_20240417_at_164631removebgpreview.png" alt="Ryzolve" style="max-width: 150px;" />
      </div>
      ${content}
      <div style="text-align: center; margin: 30px 0;">
        <a href="${renewalUrl}" style="display: inline-block; padding: 15px 30px; background-color: ${ctaColor}; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">${ctaText}</a>
      </div>
      <p style="font-size: 14px; color: #555;">Questions? Contact us at <a href="mailto:pas@ryzolve.com" style="color: #FF774B;">pas@ryzolve.com</a>.</p>
      <p style="font-size: 14px; color: #555;">Best regards,<br />The Ryzolve Team</p>
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
        <p style="font-size: 12px; color: #999;">&copy; 2024 Ryzolve Inc. All rights reserved.</p>
        <p style="font-size: 12px; color: #999;">9309 Highway 75 S Ste 102, New Waverly, TX 77358</p>
      </div>
    </div>
  `;

  // Subject lines
  const subjects = {
    "30-day": `30-day reminder: Renew your ${courseName} certificate`,
    "7-day": `Urgent: Your ${courseName} certificate expires in 7 days`,
    "1-day": `Final notice: Your ${courseName} certificate expires tomorrow`,
    "expired": `Your ${courseName} certificate has expired`,
  };

  // 30-day template - friendly reminder with benefits
  if (type === "30-day") {
    return {
      subject: `[TEST] ${subjects[type]}`,
      html: wrapEmail(`
        <p style="font-size: 14px; color: #555;">Hi ${userName},</p>
        <p style="font-size: 14px; color: #555;">Just a quick reminder—your <strong>${courseName}</strong> certificate will expire on <strong>${expiryDateStr}</strong>.</p>
        <p style="font-size: 14px; color: #555;">Renewing early helps you stay compliant and keeps your training history continuous inside Ryzolve (useful for audits and documentation).</p>
        <p style="font-size: 14px; color: #555; font-weight: bold;">Renewing with Ryzolve means</p>
        <ul style="font-size: 14px; color: #555; padding-left: 20px;">
          <li style="margin-bottom: 8px;">Your training record stays in one place</li>
          <li style="margin-bottom: 8px;">Fast re-enrollment and completion</li>
          <li style="margin-bottom: 8px;">Updated certificate available immediately after completion</li>
          <li style="margin-bottom: 8px;">Reminders to prevent future lapses</li>
        </ul>
      `, "Renew now (recommended)", "#FF774B"),
    };
  }

  // 7-day template - urgent, emphasize deadline
  if (type === "7-day") {
    return {
      subject: `[TEST] ${subjects[type]}`,
      html: wrapEmail(`
        <p style="font-size: 14px; color: #555;">Hi ${userName},</p>
        <p style="font-size: 14px; color: #555;">Your <strong>${courseName}</strong> certificate expires on <strong>${expiryDateStr}</strong>—that's just <strong>7 days away</strong>.</p>
        <p style="font-size: 14px; color: #555;">Once expired, you'll lose access to your course materials and will need to re-enroll to maintain your certification.</p>
        <p style="font-size: 14px; color: #555; font-weight: bold;">Renew now to avoid:</p>
        <ul style="font-size: 14px; color: #555; padding-left: 20px;">
          <li style="margin-bottom: 8px;">Gaps in your training record</li>
          <li style="margin-bottom: 8px;">Compliance issues during audits</li>
          <li style="margin-bottom: 8px;">Losing access to course materials</li>
          <li style="margin-bottom: 8px;">Having to start the enrollment process over</li>
        </ul>
        <p style="font-size: 14px; color: #d32f2f; font-weight: bold;">Don't wait—renew today and keep your certification active.</p>
      `, "Renew now — 7 days left", "#FF5722"),
    };
  }

  // 1-day template - final warning, very urgent
  if (type === "1-day") {
    return {
      subject: `[TEST] ${subjects[type]}`,
      html: wrapEmail(`
        <p style="font-size: 14px; color: #555;">Hi ${userName},</p>
        <p style="font-size: 14px; color: #d32f2f; font-weight: bold; font-size: 16px;">Your <strong>${courseName}</strong> certificate expires tomorrow (${expiryDateStr}).</p>
        <p style="font-size: 14px; color: #555;">This is your last chance to renew before losing access. After tomorrow:</p>
        <ul style="font-size: 14px; color: #555; padding-left: 20px;">
          <li style="margin-bottom: 8px;">Your certificate will be marked as expired</li>
          <li style="margin-bottom: 8px;">You'll lose access to your course</li>
          <li style="margin-bottom: 8px;">Your training record will show a gap</li>
          <li style="margin-bottom: 8px;">You'll need to re-enroll to restore access</li>
        </ul>
        <p style="font-size: 14px; color: #555;">It only takes a few minutes to renew—don't let your hard work expire.</p>
      `, "Renew now — expires tomorrow", "#d32f2f"),
    };
  }

  // Expired template - certificate has expired
  if (type === "expired") {
    return {
      subject: `[TEST] Renew your certificate to stay compliant`,
      html: wrapEmail(`
        <p style="font-size: 14px; color: #555;">Hi ${userName},</p>
        <p style="font-size: 14px; color: #555;">Your <strong>${courseName}</strong> certificate expired on <strong>${expiryDateStr}</strong>.</p>
        <p style="font-size: 14px; color: #555;">To stay compliant and keep your records audit-ready, renew now. Once completed, your updated certificate is available immediately in Ryzolve.</p>
        <p style="font-size: 14px; color: #555; font-weight: bold;">Why renew with Ryzolve</p>
        <ul style="font-size: 14px; color: #555; padding-left: 20px;">
          <li style="margin-bottom: 8px;">Instant certificate download after completion</li>
          <li style="margin-bottom: 8px;">Training history stored in one place for audits</li>
          <li style="margin-bottom: 8px;">Automated reminders before expiry</li>
          <li style="margin-bottom: 8px;">Support available if you need help</li>
        </ul>
        <p style="font-size: 14px; color: #555;">If you have questions, contact our support team anytime.</p>
      `, "Renew Certificate", "#FF774B"),
    };
  }

  // Fallback
  return {
    subject: `[TEST] Certificate update for ${courseName}`,
    html: wrapEmail(`
      <p style="font-size: 14px; color: #555;">Hi ${userName},</p>
      <p style="font-size: 14px; color: #555;">This is a notification about your <strong>${courseName}</strong> certificate.</p>
    `, "View certificate", "#FF774B"),
  };
}

async function main() {
  console.log(`\nSending test ${TYPE} expiry email to ${TO_EMAIL}...`);
  console.log(`Strapi URL: ${STRAPI_URL}\n`);

  const email = getEmailTemplate(TYPE);

  const res = await fetch(`${STRAPI_URL}/api/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${STRAPI_TOKEN}`,
    },
    body: JSON.stringify({
      to: TO_EMAIL,
      subject: email.subject,
      html: email.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed: ${res.status} ${text}`);
    console.log(
      "\nNote: If you get 404, the email endpoint may not be exposed.",
    );
    console.log("You can also save the HTML to a file and open in browser:");
    console.log("  TYPE=30-day node scripts/test-expiry-email.js --html");
    process.exit(1);
  }

  console.log("Email sent successfully!");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
