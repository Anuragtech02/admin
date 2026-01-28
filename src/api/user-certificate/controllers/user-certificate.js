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
  if (type === '30-day') {
    return `[TEST] 30-day reminder: Renew your ${courseName} certificate`;
  }
  const subjects = {
    '7-day': 'Certificate Expires in 7 Days - Action Required',
    '1-day': 'Final Notice: Certificate Expires Tomorrow!',
    'expired': 'Your Certificate Has Expired - Re-enroll Now',
  };
  return `[TEST] ${subjects[type]} - ${courseName}`;
}

function getEmailHtml(type, cert, user) {
  const renewalUrl = `${RENEWAL_BASE_URL}/renewal?course=${cert.course?.id}`;
  const courseName = cert.course?.title || 'your course';
  const userName = user.firstname || user.username || 'Student';
  const expiryDate = cert.expiryDate;

  // 30-day template has a unique design with benefits list
  if (type === '30-day') {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://fhfqjcc.stripocdn.email/content/guids/CABINET_e4cafd70dfbf78cd99f9e36321d47993cd56fe9c5c3482d5a73b875e3956e04b/images/screenshot_20240417_at_164631removebgpreview.png" alt="Ryzolve" style="max-width: 150px;" />
        </div>
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
    `;
  }

  const templates = {
    '7-day': {
      heading: 'Urgent: Certificate Expiring Soon',
      message: `Your certificate for <strong>${courseName}</strong> will expire in <strong>7 days</strong>. Don't lose access to your certification!`,
      ctaText: "Renew Now - Don't Lose Access!",
      ctaColor: '#FF5722',
      urgency: '<p style="font-size: 14px; color: #d32f2f; font-weight: bold;">Act now to avoid losing your certification and course access.</p>',
    },
    '1-day': {
      heading: 'Final Warning: Certificate Expires Tomorrow',
      message: `Your certificate for <strong>${courseName}</strong> expires <strong>tomorrow</strong>! After expiry, you will lose access to the course and must re-enroll.`,
      ctaText: 'Renew Today',
      ctaColor: '#d32f2f',
      urgency: '<p style="font-size: 14px; color: #d32f2f; font-weight: bold;">This is your last chance to renew before losing access!</p>',
    },
    'expired': {
      heading: 'Certificate Expired',
      message: `Your certificate for <strong>${courseName}</strong> has expired. You no longer have access to this course. To regain access and renew your certification, please re-enroll.`,
      ctaText: 'Re-enroll Now',
      ctaColor: '#d32f2f',
      urgency: '',
    },
  };

  const t = templates[type];

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://fhfqjcc.stripocdn.email/content/guids/CABINET_e4cafd70dfbf78cd99f9e36321d47993cd56fe9c5c3482d5a73b875e3956e04b/images/screenshot_20240417_at_164631removebgpreview.png" alt="Ryzolve" style="max-width: 150px;" />
      </div>
      <h2 style="color: #333; text-align: center;">${t.heading}</h2>
      <p style="font-size: 14px; color: #555;">Hi ${userName},</p>
      <p style="font-size: 14px; color: #555;">${t.message}</p>
      ${t.urgency}
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Course</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${courseName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Issued Date</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${cert.issuedDate}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Expiry Date</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${cert.expiryDate}</td>
        </tr>
      </table>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${renewalUrl}" style="display: inline-block; padding: 15px 30px; background-color: ${t.ctaColor}; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">${t.ctaText}</a>
      </div>
      <p style="font-size: 14px; color: #555;">If you have any questions, please contact our support team.</p>
      <p style="font-size: 14px; color: #555;">Best regards,<br />The Ryzolve Team</p>
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
        <p style="font-size: 12px; color: #999;">&copy; 2024 Ryzolve Inc. All rights reserved.</p>
        <p style="font-size: 12px; color: #999;">9309 Highway 75 S Ste 102, New Waverly, TX 77358</p>
      </div>
    </div>
  `;
}
