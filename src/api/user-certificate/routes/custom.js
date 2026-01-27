'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/user-certificates/migrate',
      handler: 'user-certificate.migrate',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
