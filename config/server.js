module.exports = ({ env }) => ({
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1337),
  url: "https://admin.ryzolve.com/",
  app: {
    keys: env.array("APP_KEYS", ["key1", "key2"]),
  },
  cron: {
    enabled: false,
    tasks: {
      // Run daily at 9:15 AM CST (15:15 UTC) - DISABLED FOR NOW
      // "15 15 * * *": async ({ strapi }) => {
      //   console.log("Starting daily user certificate expiry check...");
      //   await strapi
      //     .service("api::user-certificate.user-certificate")
      //     .checkExpiringCertificates();
      // },
    },
  },
});
