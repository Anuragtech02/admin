"use strict";

/**
 * user-certificate service
 */

const { createCoreService } = require("@strapi/strapi").factories;

const RENEWAL_BASE_URL = process.env.CLIENT_URL || "https://training.ryzolve.com";

function getEmailTemplate(type, userCert) {
  const renewalUrl = `${RENEWAL_BASE_URL}/renewal?course=${userCert.course?.id}`;
  const courseName = userCert.course?.title || "your course";
  const userName = userCert.user?.firstname || userCert.user?.username || "Student";
  const expiryDate = userCert.expiryDate;

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
        <p style="font-size: 12px; color: #999;">© 2024 Ryzolve Inc. All rights reserved.</p>
        <p style="font-size: 12px; color: #999;">9309 Highway 75 S Ste 102, New Waverly, TX 77358</p>
      </div>
    </div>
  `;

  // 30-day template - friendly reminder with benefits
  if (type === "30-day") {
    return {
      subject: `30-day reminder: Renew your ${courseName} certificate`,
      html: wrapEmail(`
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
      `, "Renew now (recommended)", "#FF774B"),
    };
  }

  // 7-day template - urgent, emphasize deadline
  if (type === "7-day") {
    return {
      subject: `Urgent: Your ${courseName} certificate expires in 7 days`,
      html: wrapEmail(`
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
      `, "Renew now — 7 days left", "#FF5722"),
    };
  }

  // 1-day template - final warning, very urgent
  if (type === "1-day") {
    return {
      subject: `Final notice: Your ${courseName} certificate expires tomorrow`,
      html: wrapEmail(`
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
      `, "Renew now — expires tomorrow", "#d32f2f"),
    };
  }

  // Expired template - certificate has expired
  if (type === "expired") {
    return {
      subject: `Your ${courseName} certificate has expired`,
      html: wrapEmail(`
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
      `, "Re-enroll now", "#d32f2f"),
    };
  }

  // Fallback (should not happen)
  return {
    subject: `Certificate update for ${courseName}`,
    html: wrapEmail(`
      <p style="font-size: 14px; color: #555;">Hi ${userName},</p>
      <p style="font-size: 14px; color: #555;">This is a notification about your <strong>${courseName}</strong> certificate.</p>
    `, "View certificate", "#FF774B"),
  };
}

function getAdminEmailTemplate(type, userCert) {
  const courseName = userCert.course?.title || "N/A";
  const userName = userCert.user?.username || "Unknown";
  const userEmail = userCert.user?.email || "Unknown";

  const headings = {
    "30-day": "Certificate Expiring in 30 Days",
    "7-day": "Certificate Expiring in 7 Days",
    "1-day": "Certificate Expires Tomorrow",
    expired: "Certificate Has Expired - Access Revoked",
  };

  return {
    subject: `${headings[type]}: ${userName} - ${courseName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://fhfqjcc.stripocdn.email/content/guids/CABINET_e4cafd70dfbf78cd99f9e36321d47993cd56fe9c5c3482d5a73b875e3956e04b/images/screenshot_20240417_at_164631removebgpreview.png" alt="Ryzolve" style="max-width: 150px;" />
        </div>
        <h2 style="color: #333;">${headings[type]}</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>User</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${userName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Email</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${userEmail}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Course</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${courseName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Issued Date</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${userCert.issuedDate}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Expiry Date</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${userCert.expiryDate}</td>
          </tr>
          ${type === "expired" ? '<tr><td style="padding: 10px; border: 1px solid #ddd; background-color: #ffebee;"><strong>Status</strong></td><td style="padding: 10px; border: 1px solid #ddd; color: #d32f2f;"><strong>Course access has been revoked</strong></td></tr>' : ""}
        </table>
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #999;">© 2024 Ryzolve Inc. All rights reserved.</p>
        </div>
      </div>
    `,
  };
}

module.exports = createCoreService(
  "api::user-certificate.user-certificate",
  ({ strapi }) => ({
    async checkExpiringCertificates() {
      const today = new Date();
      const todayString = today.toISOString().split("T")[0];
      const notificationDays = [30, 7, 1];

      console.log("Running user certificate expiry check...");

      // Process expiring certificates (30, 7, 1 days before)
      for (const days of notificationDays) {
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + days);
        const dateString = targetDate.toISOString().split("T")[0];

        const userCertificates = await strapi.db
          .query("api::user-certificate.user-certificate")
          .findMany({
            where: {
              expiryDate: dateString,
              status: { $ne: "expired" },
            },
            populate: ["user", "course"],
          });

        console.log(
          `Found ${userCertificates.length} user certificates expiring in ${days} days`
        );

        for (const userCert of userCertificates) {
          const notificationKey = `${days}-day`;
          const notificationsSent = userCert.notificationsSent || [];

          if (notificationsSent.includes(notificationKey)) {
            continue;
          }

          if (userCert.user && userCert.course) {
            try {
              const userEmail = getEmailTemplate(notificationKey, userCert);
              const adminEmail = getAdminEmailTemplate(notificationKey, userCert);

              // Send email to user
              await strapi.plugins["email"].services.email.send({
                to: userCert.user.email,
                subject: userEmail.subject,
                html: userEmail.html,
              });

              // Send email to admin
              await strapi.plugins["email"].services.email.send({
                to: "pas@ryzolve.com",
                subject: adminEmail.subject,
                html: adminEmail.html,
              });

              // Mark notification as sent
              await strapi.db.query("api::user-certificate.user-certificate").update({
                where: { id: userCert.id },
                data: {
                  notificationsSent: [...notificationsSent, notificationKey],
                  status: days <= 7 ? "expiring_soon" : userCert.status,
                },
              });

              console.log(
                `Sent ${days}-day expiry notification for user certificate ${userCert.id}`
              );
            } catch (emailError) {
              console.error(
                `Error sending expiry notification for user certificate ${userCert.id}:`,
                emailError
              );
            }
          }
        }
      }

      // Process expired certificates
      const expiredCerts = await strapi.db
        .query("api::user-certificate.user-certificate")
        .findMany({
          where: {
            expiryDate: { $lt: todayString },
            status: { $ne: "expired" },
          },
          populate: ["user", "course"],
        });

      console.log(`Found ${expiredCerts.length} newly expired user certificates`);

      for (const userCert of expiredCerts) {
        try {
          // Revoke course access - disconnect user from course
          if (userCert.user && userCert.course) {
            await strapi.db.query("api::course.course").update({
              where: { id: userCert.course.id },
              data: {
                users: {
                  disconnect: [userCert.user.id],
                },
              },
            });
            console.log(
              `Revoked course access for user ${userCert.user.id} from course ${userCert.course.id}`
            );

            // Send expired notification to user
            const userEmail = getEmailTemplate("expired", userCert);
            await strapi.plugins["email"].services.email.send({
              to: userCert.user.email,
              subject: userEmail.subject,
              html: userEmail.html,
            });

            // Send expired notification to admin
            const adminEmail = getAdminEmailTemplate("expired", userCert);
            await strapi.plugins["email"].services.email.send({
              to: "pas@ryzolve.com",
              subject: adminEmail.subject,
              html: adminEmail.html,
            });
          }

          // Update certificate status to expired
          await strapi.db.query("api::user-certificate.user-certificate").update({
            where: { id: userCert.id },
            data: {
              status: "expired",
              notificationsSent: [
                ...(userCert.notificationsSent || []),
                "expired",
              ],
            },
          });

          console.log(`User certificate ${userCert.id} marked as expired`);
        } catch (error) {
          console.error(
            `Error processing expired user certificate ${userCert.id}:`,
            error
          );
        }
      }

      // Process certificates already marked as expired but never notified
      // (catches migrated/manually-updated certificates that bypassed normal flow)
      const unnotifiedExpiredCerts = await strapi.db
        .query("api::user-certificate.user-certificate")
        .findMany({
          where: {
            status: "expired",
          },
          populate: ["user", "course"],
        });

      // Filter to only those missing "expired" in notificationsSent
      const needsNotification = unnotifiedExpiredCerts.filter(cert => {
        const sent = cert.notificationsSent || [];
        return !sent.includes("expired");
      });

      console.log(`Found ${needsNotification.length} expired certificates that were never notified`);

      for (const userCert of needsNotification) {
        try {
          if (userCert.user && userCert.course) {
            // Send expired notification to user
            const userEmail = getEmailTemplate("expired", userCert);
            await strapi.plugins["email"].services.email.send({
              to: userCert.user.email,
              subject: userEmail.subject,
              html: userEmail.html,
            });

            // Send expired notification to admin
            const adminEmail = getAdminEmailTemplate("expired", userCert);
            await strapi.plugins["email"].services.email.send({
              to: "pas@ryzolve.com",
              subject: adminEmail.subject,
              html: adminEmail.html,
            });

            // Mark notification as sent
            await strapi.db.query("api::user-certificate.user-certificate").update({
              where: { id: userCert.id },
              data: {
                notificationsSent: [
                  ...(userCert.notificationsSent || []),
                  "expired",
                ],
              },
            });

            console.log(`Sent expired notification for previously-unnotified certificate ${userCert.id} (user: ${userCert.user.email})`);
          }
        } catch (error) {
          console.error(
            `Error sending notification for unnotified expired certificate ${userCert.id}:`,
            error
          );
        }
      }

      console.log("User certificate expiry check completed");
    },
  })
);
