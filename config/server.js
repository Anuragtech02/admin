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
      // Run daily at 9:00 AM UTC
      "0 9 * * *": async ({ strapi }) => {
        console.log("Starting daily certificate expiry check...");
        await strapi
          .service("api::certificate.certificate")
          .checkExpiringCertificates();
      },
    },
  },
});
