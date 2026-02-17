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
      // Daily certificate expiry check at 9:15 AM CST (15:15 UTC)
      "15 15 * * *": async ({ strapi }) => {
        console.log("Starting daily user certificate expiry check...");
        await strapi
          .service("api::user-certificate.user-certificate")
          .checkExpiringCertificates();
      },
      // Daily incomplete course reminder at 4:00 PM CST
      '0 16 * * *': {
        task: async ({ strapi }) => {
          strapi.log.info('[Cron] Running incomplete course reminder check');
          await strapi.service('api::order.order').checkIncompleteCourses();
        },
        options: {
          tz: 'America/Chicago',
        },
      },
    },
  },
});
