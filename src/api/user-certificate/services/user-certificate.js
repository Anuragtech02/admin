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

  const templates = {
    "30-day": {
      subject: "Certificate Expiring Soon - 30 Days Remaining",
      heading: "Certificate Expiry Reminder",
      message: `Your certificate for <strong>${courseName}</strong> will expire in <strong>30 days</strong>.`,
      ctaText: "Renew Now",
      ctaColor: "#FF774B",
      urgency: "",
    },
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
    subject: template.subject,
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
            <td style="padding: 10px; border: 1px solid #ddd;">${userCert.issuedDate}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Expiry Date</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${userCert.expiryDate}</td>
          </tr>
        </table>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${renewalUrl}" style="display: inline-block; padding: 15px 30px; background-color: ${template.ctaColor}; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">${template.ctaText}</a>
        </div>
        <p style="font-size: 14px; color: #555;">If you have any questions, please contact our support team.</p>
        <p style="font-size: 14px; color: #555;">Best regards,<br />The Ryzolve Team</p>
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #999;">© 2024 Ryzolve Inc. All rights reserved.</p>
          <p style="font-size: 12px; color: #999;">9309 Highway 75 S Ste 102, New Waverly, TX 77358</p>
        </div>
      </div>
    `,
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

      console.log("User certificate expiry check completed");
    },
  })
);
