module.exports = ({ env }) => ({
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1337),
  url: "https://admin.ryzolve.com/",
  app: {
    keys: env.array("APP_KEYS", ["key1", "key2"]),
  },
  cron: {
    enabled: true,
    tasks: {
      // TEST CRON - runs at 14:00 UTC to test email for pas@ryzolve.com
      // REMOVE THIS AFTER TESTING
      "0 14 * * *": async ({ strapi }) => {
        console.log("[TEST CRON] Starting test email for pas@ryzolve.com...");

        // Find user by email
        const user = await strapi.db.query("plugin::users-permissions.user").findOne({
          where: { email: "pas@ryzolve.com" },
        });

        if (!user) {
          console.log("[TEST CRON] User pas@ryzolve.com not found!");
          return;
        }

        // Find their expired certificate
        const cert = await strapi.db.query("api::user-certificate.user-certificate").findOne({
          where: { user: user.id, status: "expired" },
          populate: ["user", "course"],
        });

        if (!cert) {
          console.log("[TEST CRON] No expired certificate found for pas@ryzolve.com");
          return;
        }

        console.log(`[TEST CRON] Found expired cert ID=${cert.id}, course=${cert.course?.title}, expiry=${cert.expiryDate}`);

        try {
          // Build the REAL expired email template
          const renewalUrl = `https://training.ryzolve.com/renewal?course=${cert.course?.id}`;
          const courseName = cert.course?.title || "your course";
          const userName = cert.user?.firstname || cert.user?.username || "Student";
          const expiryDate = cert.expiryDate;

          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://fhfqjcc.stripocdn.email/content/guids/CABINET_e4cafd70dfbf78cd99f9e36321d47993cd56fe9c5c3482d5a73b875e3956e04b/images/screenshot_20240417_at_164631removebgpreview.png" alt="Ryzolve" style="max-width: 150px;" />
              </div>
              <p style="font-size: 14px; color: #555;">Hi ${userName},</p>
              <p style="font-size: 14px; color: #555;">Your <strong>${courseName}</strong> certificate expired on <strong>${expiryDate}</strong>.</p>
              <p style="font-size: 14px; color: #555;">To stay compliant and keep your records audit-ready, renew now. Once completed, your updated certificate is available immediately in Ryzolve.</p>
              <p style="font-size: 14px; color: #555; font-weight: bold;">Why renew with Ryzolve</p>
              <ul style="font-size: 14px; color: #555; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Instant certificate download after completion</li>
                <li style="margin-bottom: 8px;">Training history stored in one place for audits</li>
                <li style="margin-bottom: 8px;">Automated reminders before expiry</li>
                <li style="margin-bottom: 8px;">Support available if you need help</li>
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${renewalUrl}" style="display: inline-block; padding: 15px 30px; background-color: #FF774B; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Renew Certificate</a>
              </div>
              <p style="font-size: 14px; color: #555;">If you have questions, contact our support team anytime.</p>
              <p style="font-size: 14px; color: #555;">Best regards,<br />The Ryzolve Team</p>
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                <p style="font-size: 12px; color: #999;">© 2024 Ryzolve Inc. All rights reserved.</p>
                <p style="font-size: 12px; color: #999;">9309 Highway 75 S Ste 102, New Waverly, TX 77358</p>
              </div>
            </div>
          `;

          await strapi.plugins["email"].services.email.send({
            to: "pas@ryzolve.com",
            subject: `Renew your certificate to stay compliant`,
            html: html,
          });

          console.log("[TEST CRON] Expired email sent successfully to pas@ryzolve.com!");
        } catch (error) {
          console.error("[TEST CRON] Failed to send email:", error.message);
        }
      },
      // Debug cron - logs certificate counts including unnotified expired ones
      "*/5 * * * *": async ({ strapi }) => {
        const today = new Date();
        const todayStr = today.toISOString().split("T")[0];

        // Calculate target dates
        const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const in1Day = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        // Count certificates for each category (not yet expired status)
        const count30Day = await strapi.db.query("api::user-certificate.user-certificate").count({
          where: { expiryDate: in30Days, status: { $ne: "expired" } },
        });
        const count7Day = await strapi.db.query("api::user-certificate.user-certificate").count({
          where: { expiryDate: in7Days, status: { $ne: "expired" } },
        });
        const count1Day = await strapi.db.query("api::user-certificate.user-certificate").count({
          where: { expiryDate: in1Day, status: { $ne: "expired" } },
        });
        const countNewlyExpired = await strapi.db.query("api::user-certificate.user-certificate").count({
          where: { expiryDate: { $lt: todayStr }, status: { $ne: "expired" } },
        });

        // Count already-expired but never notified
        const allExpired = await strapi.db.query("api::user-certificate.user-certificate").findMany({
          where: { status: "expired" },
        });
        const unnotifiedExpired = allExpired.filter(c => !(c.notificationsSent || []).includes("expired"));

        console.log(`[CRON DRY-RUN] ${today.toISOString()}`);
        console.log(`  Today: ${todayStr}`);
        console.log(`  30-day (${in30Days}): ${count30Day} certificates`);
        console.log(`  7-day (${in7Days}): ${count7Day} certificates`);
        console.log(`  1-day (${in1Day}): ${count1Day} certificates`);
        console.log(`  Newly expired (before ${todayStr}, not yet marked): ${countNewlyExpired} certificates`);
        console.log(`  Already expired but NEVER NOTIFIED: ${unnotifiedExpired.length} certificates`);
        console.log(`  TOTAL emails that would be sent: ${count30Day + count7Day + count1Day + countNewlyExpired + unnotifiedExpired.length}`);
      },
      // Run daily at 9:15 AM Central (14:15 UTC)
      "15 14 * * *": async ({ strapi }) => {
        console.log("Starting daily user certificate expiry check...");
        await strapi
          .service("api::user-certificate.user-certificate")
          .checkExpiringCertificates();
      },
    },
  },
});
