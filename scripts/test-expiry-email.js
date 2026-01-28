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
  const issuedDateStr = issuedDate.toISOString().split("T")[0];

  // 30-day template has a unique design with benefits list
  if (type === "30-day") {
    return {
      subject: `[TEST] 30-day reminder: Renew your ${courseName} certificate`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://fhfqjcc.stripocdn.email/content/guids/CABINET_e4cafd70dfbf78cd99f9e36321d47993cd56fe9c5c3482d5a73b875e3956e04b/images/screenshot_20240417_at_164631removebgpreview.png" alt="Ryzolve" style="max-width: 150px;" />
          </div>
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
          <div style="text-align: center; margin: 30px 0;">
            <a href="${renewalUrl}" style="display: inline-block; padding: 15px 30px; background-color: #FF774B; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Renew now (recommended)</a>
          </div>
          <p style="font-size: 14px; color: #555;">Questions? Contact us at <a href="mailto:pas@ryzolve.com" style="color: #FF774B;">pas@ryzolve.com</a>.</p>
          <p style="font-size: 14px; color: #555;">Best regards,<br />The Ryzolve Team</p>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="font-size: 12px; color: #999;">&copy; 2024 Ryzolve Inc. All rights reserved.</p>
            <p style="font-size: 12px; color: #999;">9309 Highway 75 S Ste 102, New Waverly, TX 77358</p>
          </div>
        </div>
      `,
    };
  }

  const templates = {
    "7-day": {
      subject: "Certificate Expires in 7 Days - Action Required",
      heading: "Urgent: Certificate Expiring Soon",
      message: `Your certificate for <strong>${courseName}</strong> will expire in <strong>7 days</strong>. Don't lose access to your certification!`,
      ctaText: "Renew Now - Don't Lose Access!",
      ctaColor: "#FF5722",
      urgency:
        '<p style="font-size: 14px; color: #d32f2f; font-weight: bold;">Act now to avoid losing your certification and course access.</p>',
    },
    "1-day": {
      subject: "Final Notice: Certificate Expires Tomorrow!",
      heading: "Final Warning: Certificate Expires Tomorrow",
      message: `Your certificate for <strong>${courseName}</strong> expires <strong>tomorrow</strong>! After expiry, you will lose access to the course and must re-enroll.`,
      ctaText: "Renew Today",
      ctaColor: "#d32f2f",
      urgency:
        '<p style="font-size: 14px; color: #d32f2f; font-weight: bold;">This is your last chance to renew before losing access!</p>',
    },
    expired: {
      subject: "Your Certificate Has Expired - Re-enroll Now",
      heading: "Certificate Expired",
      message: `Your certificate for <strong>${courseName}</strong> has expired. You no longer have access to this course. To regain access and renew your certification, please re-enroll.`,
      ctaText: "Re-enroll Now",
      ctaColor: "#d32f2f",
      urgency: "",
    },
  };

  const template = templates[type];

  return {
    subject: `[TEST] ${template.subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://fhfqjcc.stripocdn.email/content/guids/CABINET_e4cafd70dfbf78cd99f9e36321d47993cd56fe9c5c3482d5a73b875e3956e04b/images/screenshot_20240417_at_164631removebgpreview.png" alt="Ryzolve" style="max-width: 150px;" />
        </div>
        <h2 style="color: #333; text-align: center;">${template.heading}</h2>
        <p style="font-size: 14px; color: #555;">Hi ${userName},</p>
        <p style="font-size: 14px; color: #555;">${template.message}</p>
        ${template.urgency}
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Course</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${courseName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Issued Date</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${issuedDateStr}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Expiry Date</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${expiryDateStr}</td>
          </tr>
        </table>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${renewalUrl}" style="display: inline-block; padding: 15px 30px; background-color: ${template.ctaColor}; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">${template.ctaText}</a>
        </div>
        <p style="font-size: 14px; color: #555;">If you have any questions, please contact our support team.</p>
        <p style="font-size: 14px; color: #555;">Best regards,<br />The Ryzolve Team</p>
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #999;">&copy; 2024 Ryzolve Inc. All rights reserved.</p>
          <p style="font-size: 12px; color: #999;">9309 Highway 75 S Ste 102, New Waverly, TX 77358</p>
        </div>
      </div>
    `,
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
