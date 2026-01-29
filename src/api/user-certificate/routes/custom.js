'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/user-certificates/test-expiry-email',
      handler: 'user-certificate.testExpiryEmail',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      // Log expiring certificates (use with external cron every 5 mins)
      method: 'GET',
      path: '/user-certificates/check-expiring',
      handler: 'user-certificate.checkExpiring',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
