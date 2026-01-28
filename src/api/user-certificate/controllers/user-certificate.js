'use strict';

/**
 * user-certificate controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::user-certificate.user-certificate', ({ strapi }) => ({
  /**
   * Test certificate expiry email for a specific user.
   * POST /api/user-certificates/test-expiry-email?email=user@example.com
   *
   * Finds the user by email, checks their certificates, and if any are
   * expiring (within 30 days) or expired, sends the appropriate email.
   * If none are expiring, returns a message saying so.
   */
  async testExpiryEmail(ctx) {
    const { email } = ctx.query;

    if (!email) {
      ctx.response.status = 400;
      return { error: 'Email query parameter is required. Usage: ?email=user@example.com' };
    }

    // Find user by email
    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      ctx.response.status = 404;
      return { error: `No user found with email: ${email}` };
    }

    // Find all certificates for this user
    const certificates = await strapi.db.query('api::user-certificate.user-certificate').findMany({
      where: { user: user.id },
      populate: ['user', 'course'],
    });

    if (!certificates.length) {
      return { message: `No certificates found for ${email}` };
    }

    const today = new Date();
    const results = [];

    for (const cert of certificates) {
      const expiryDate = new Date(cert.expiryDate);
      const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

      let type = null;

      if (daysUntilExpiry <= 0) {
        type = 'expired';
      } else if (daysUntilExpiry <= 1) {
        type = '1-day';
      } else if (daysUntilExpiry <= 7) {
        type = '7-day';
      } else if (daysUntilExpiry <= 30) {
        type = '30-day';
      }

      if (!type) {
        results.push({
          course: cert.course?.title,
          status: cert.status,
          expiryDate: cert.expiryDate,
          daysLeft: daysUntilExpiry,
          emailSent: false,
          reason: 'Not expiring within 30 days',
        });
        continue;
      }

      try {
        // Send the expiry email using the service's email templates
        const service = strapi.service('api::user-certificate.user-certificate');

        // We need to call the email function directly - import the template functions
        // Since they're in the service file, we trigger via checkExpiringCertificates-like logic
        await strapi.plugins['email'].services.email.send({
          to: user.email,
          subject: getSubject(type, cert.course?.title),
          html: getEmailHtml(type, cert, user),
        });

        results.push({
          course: cert.course?.title,
          status: cert.status,
          expiryDate: cert.expiryDate,
          daysLeft: daysUntilExpiry,
          emailSent: true,
          emailType: type,
        });
      } catch (err) {
        results.push({
          course: cert.course?.title,
          status: cert.status,
          expiryDate: cert.expiryDate,
          daysLeft: daysUntilExpiry,
          emailSent: false,
          error: err.message,
        });
      }
    }

    return {
      success: true,
      user: { id: user.id, email: user.email, username: user.username },
      certificates: results,
    };
  },
}));

// --- Email template helpers (mirrors user-certificate service templates) ---

const RENEWAL_BASE_URL = process.env.CLIENT_URL || 'https://training.ryzolve.com';

function getSubject(type, courseName) {
  const subjects = {
    '30-day': `30-day reminder: Renew your ${courseName} certificate`,
    '7-day': `Urgent: Your ${courseName} certificate expires in 7 days`,
    '1-day': `Final notice: Your ${courseName} certificate expires tomorrow`,
    'expired': `Your ${courseName} certificate has expired`,
  };
  return `[TEST] ${subjects[type]}`;
}

function getEmailHtml(type, cert, user) {
  const renewalUrl = `${RENEWAL_BASE_URL}/renewal?course=${cert.course?.id}`;
  const courseName = cert.course?.title || 'your course';
  const userName = user.firstname || user.username || 'Student';
  const expiryDate = cert.expiryDate;

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

  // 30-day template - friendly reminder with benefits
  if (type === '30-day') {
    return wrapEmail(`
      <p style="font-size: 14px; color: #555;">Hi ${userName},</p>
      <p style="font-size: 14px; color: #555;">Just a quick reminder—your <strong>${courseName}</strong> certificate will expire on <strong>${expiryDate}</strong>.</p>
      <p style="font-size: 14px; color: #555;">Renewing early helps you stay compliant and keeps your training history continuous inside Ryzolve (useful for audits and documentation).</p>
      <p style="font-size: 14px; color: #555; font-weight: bold;">Renewing with Ryzolve means</p>
      <ul style="font-size: 14px; color: #555; padding-left: 20px;">
        <li style="margin-bottom: 8px;">Your training record stays in one place</li>
        <li style="margin-bottom: 8px;">Fast re-enrollment and completion</li>
        <li style="margin-bottom: 8px;">Updated certificate available immediately after completion</li>
        <li style="margin-bottom: 8px;">Reminders to prevent future lapses</li>
      </ul>
    `, 'Renew now (recommended)', '#FF774B');
  }

  // 7-day template - urgent, emphasize deadline
  if (type === '7-day') {
    return wrapEmail(`
      <p style="font-size: 14px; color: #555;">Hi ${userName},</p>
      <p style="font-size: 14px; color: #555;">Your <strong>${courseName}</strong> certificate expires on <strong>${expiryDate}</strong>—that's just <strong>7 days away</strong>.</p>
      <p style="font-size: 14px; color: #555;">Once expired, you'll lose access to your course materials and will need to re-enroll to maintain your certification.</p>
      <p style="font-size: 14px; color: #555; font-weight: bold;">Renew now to avoid:</p>
      <ul style="font-size: 14px; color: #555; padding-left: 20px;">
        <li style="margin-bottom: 8px;">Gaps in your training record</li>
        <li style="margin-bottom: 8px;">Compliance issues during audits</li>
        <li style="margin-bottom: 8px;">Losing access to course materials</li>
        <li style="margin-bottom: 8px;">Having to start the enrollment process over</li>
      </ul>
      <p style="font-size: 14px; color: #d32f2f; font-weight: bold;">Don't wait—renew today and keep your certification active.</p>
    `, 'Renew now — 7 days left', '#FF5722');
  }

  // 1-day template - final warning, very urgent
  if (type === '1-day') {
    return wrapEmail(`
      <p style="font-size: 14px; color: #555;">Hi ${userName},</p>
      <p style="font-size: 14px; color: #d32f2f; font-weight: bold; font-size: 16px;">Your <strong>${courseName}</strong> certificate expires tomorrow (${expiryDate}).</p>
      <p style="font-size: 14px; color: #555;">This is your last chance to renew before losing access. After tomorrow:</p>
      <ul style="font-size: 14px; color: #555; padding-left: 20px;">
        <li style="margin-bottom: 8px;">Your certificate will be marked as expired</li>
        <li style="margin-bottom: 8px;">You'll lose access to your course</li>
        <li style="margin-bottom: 8px;">Your training record will show a gap</li>
        <li style="margin-bottom: 8px;">You'll need to re-enroll to restore access</li>
      </ul>
      <p style="font-size: 14px; color: #555;">It only takes a few minutes to renew—don't let your hard work expire.</p>
    `, 'Renew now — expires tomorrow', '#d32f2f');
  }

  // Expired template - certificate has expired
  if (type === 'expired') {
    return wrapEmail(`
      <p style="font-size: 14px; color: #555;">Hi ${userName},</p>
      <p style="font-size: 14px; color: #555;">Your <strong>${courseName}</strong> certificate expired on <strong>${expiryDate}</strong>.</p>
      <p style="font-size: 14px; color: #555;">As a result, your access to the course has been removed and your certification is no longer active.</p>
      <p style="font-size: 14px; color: #555; font-weight: bold;">To restore your certification:</p>
      <ul style="font-size: 14px; color: #555; padding-left: 20px;">
        <li style="margin-bottom: 8px;">Re-enroll in the course through Ryzolve</li>
        <li style="margin-bottom: 8px;">Complete the training requirements</li>
        <li style="margin-bottom: 8px;">Receive a new certificate valid for another year</li>
      </ul>
      <p style="font-size: 14px; color: #555;">We've kept your training history on file, so re-enrolling is quick and easy.</p>
    `, 'Re-enroll now', '#d32f2f');
  }

  // Fallback
  return wrapEmail(`
    <p style="font-size: 14px; color: #555;">Hi ${userName},</p>
    <p style="font-size: 14px; color: #555;">This is a notification about your <strong>${courseName}</strong> certificate.</p>
  `, 'View certificate', '#FF774B');
}
