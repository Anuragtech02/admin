"use strict";

/**
 * certificate service
 */

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService(
  "api::certificate.certificate",
  ({ strapi }) => ({
    async checkExpiringCertificates() {
      const today = new Date();
      const notificationDays = [30, 7, 1];

      console.log("Running certificate expiry check...");

      for (const days of notificationDays) {
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + days);
        const dateString = targetDate.toISOString().split("T")[0];

        // Find certificates expiring on this date
        const certificates = await strapi.db
          .query("api::certificate.certificate")
          .findMany({
            where: {
              expiryDate: dateString,
              status: { $ne: "expired" },
            },
            populate: ["user", "course"],
          });

        console.log(
          `Found ${certificates.length} certificates expiring in ${days} days`
        );

        for (const cert of certificates) {
          const notificationKey = `${days}-day`;
          const notificationsSent = cert.notificationsSent || [];

          // Skip if already notified for this interval
          if (notificationsSent.includes(notificationKey)) {
            continue;
          }

          if (cert.user) {
            try {
              // Send email to user
              await strapi.plugins["email"].services.email.send({
                to: cert.user.email,
                subject: `Certificate Expiring in ${days} Day(s) - Action Required`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
                    <div style="text-align: center; margin-bottom: 20px;">
                      <img src="https://fhfqjcc.stripocdn.email/content/guids/CABINET_e4cafd70dfbf78cd99f9e36321d47993cd56fe9c5c3482d5a73b875e3956e04b/images/screenshot_20240417_at_164631removebgpreview.png" alt="Ryzolve" style="max-width: 150px;" />
                    </div>
                    <h2 style="color: #333;">Certificate Expiry Notice</h2>
                    <p style="font-size: 14px; color: #555;">
                      Hi ${cert.user.username},
                    </p>
                    <p style="font-size: 14px; color: #555;">
                      Your certificate for <strong>${cert.course?.title || "your course"}</strong> will expire in <strong>${days} day(s)</strong>.
                    </p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                      <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Course</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${cert.course?.title || "N/A"}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Expiry Date</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${cert.expiryDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Issued Date</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${cert.issuedDate}</td>
                      </tr>
                    </table>
                    <p style="font-size: 14px; color: #555; margin-top: 20px;">
                      Please take the necessary steps to renew your certificate before it expires.
                    </p>
                    <p style="font-size: 14px; color: #555;">Best regards,<br />The Ryzolve Team</p>
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                      <p style="font-size: 12px; color: #999;">© 2024 Ryzolve Inc. All rights reserved.</p>
                    </div>
                  </div>
                `,
              });

              // Send email to admin
              await strapi.plugins["email"].services.email.send({
                to: "pas@ryzolve.com",
                subject: `Certificate Expiring: ${cert.user.username} - ${days} Day(s) Notice`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
                    <div style="text-align: center; margin-bottom: 20px;">
                      <img src="https://fhfqjcc.stripocdn.email/content/guids/CABINET_e4cafd70dfbf78cd99f9e36321d47993cd56fe9c5c3482d5a73b875e3956e04b/images/screenshot_20240417_at_164631removebgpreview.png" alt="Ryzolve" style="max-width: 150px;" />
                    </div>
                    <h2 style="color: #333;">Certificate Expiry Alert</h2>
                    <p style="font-size: 14px; color: #555;">
                      A user's certificate is expiring in <strong>${days} day(s)</strong>:
                    </p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                      <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>User</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${cert.user.username}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Email</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${cert.user.email}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Course</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${cert.course?.title || "N/A"}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Expiry Date</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${cert.expiryDate}</td>
                      </tr>
                    </table>
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                      <p style="font-size: 12px; color: #999;">© 2024 Ryzolve Inc. All rights reserved.</p>
                    </div>
                  </div>
                `,
              });

              // Mark notification as sent
              await strapi.db.query("api::certificate.certificate").update({
                where: { id: cert.id },
                data: {
                  notificationsSent: [...notificationsSent, notificationKey],
                  status: days <= 7 ? "expiring_soon" : cert.status,
                },
              });

              console.log(
                `Sent ${days}-day expiry notification for certificate ${cert.id}`
              );
            } catch (emailError) {
              console.error(
                `Error sending expiry notification for certificate ${cert.id}:`,
                emailError
              );
            }
          }
        }
      }

      // Mark expired certificates
      const expiredCerts = await strapi.db
        .query("api::certificate.certificate")
        .findMany({
          where: {
            expiryDate: { $lt: today.toISOString().split("T")[0] },
            status: { $ne: "expired" },
          },
        });

      for (const cert of expiredCerts) {
        await strapi.db.query("api::certificate.certificate").update({
          where: { id: cert.id },
          data: { status: "expired" },
        });
        console.log(`Certificate ${cert.id} marked as expired`);
      }

      console.log("Certificate expiry check completed");
    },
  })
);
