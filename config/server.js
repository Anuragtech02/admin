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
