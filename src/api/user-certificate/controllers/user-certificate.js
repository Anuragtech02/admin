'use strict';

/**
 * user-certificate controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::user-certificate.user-certificate', ({ strapi }) => ({

  /**
   * One-time migration: backfill user-certificate records from existing passing quiz scores.
   * Call via: POST /api/user-certificates/migrate
   *
   * For each passing quiz score (>=90%), creates a user-certificate record if one
   * doesn't already exist for that user+course combination.
   *
   * Handles old quiz scores that may not have user/course relations by looking them up
   * via username and courseTitle strings.
   */
  async migrate(ctx) {
    const PASS_THRESHOLD = 90;

    // 1. Fetch all quiz scores with relations
    const allScores = await strapi.db.query('api::quiz-score.quiz-score').findMany({
      populate: ['user', 'course'],
    });

    // 2. Fetch all existing user-certificates to avoid duplicates
    const existingCerts = await strapi.db.query('api::user-certificate.user-certificate').findMany({
      populate: ['user', 'course', 'quizScore'],
    });

    // Build a set of existing cert keys: "userId-courseId"
    const existingCertKeys = new Set();
    for (const cert of existingCerts) {
      if (cert.user?.id && cert.course?.id) {
        existingCertKeys.add(`${cert.user.id}-${cert.course.id}`);
      }
    }

    // 3. Cache for user/course lookups (for old scores without relations)
    const userCache = {};
    const courseCache = {};

    const results = {
      processed: 0,
      created: 0,
      skippedExisting: 0,
      skippedNotPassing: 0,
      skippedNoUser: 0,
      skippedNoCourse: 0,
      errors: [],
    };

    // 4. Group scores by user+course, keep highest score per combination
    const bestScores = {};

    for (const score of allScores) {
      const totalQuestions = score.totalQuestions || 10;
      const percentage = (Number(score.score) / totalQuestions) * 100;

      if (percentage < PASS_THRESHOLD) {
        results.skippedNotPassing++;
        continue;
      }

      // Resolve user
      let userId = score.user?.id;
      if (!userId && score.username) {
        if (!userCache[score.username]) {
          const found = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { username: score.username },
          });
          userCache[score.username] = found;
        }
        userId = userCache[score.username]?.id;
      }

      if (!userId) {
        results.skippedNoUser++;
        continue;
      }

      // Resolve course
      let courseId = score.course?.id;
      if (!courseId && score.courseTitle) {
        if (!courseCache[score.courseTitle]) {
          const found = await strapi.db.query('api::course.course').findOne({
            where: { title: score.courseTitle },
          });
          courseCache[score.courseTitle] = found;
        }
        courseId = courseCache[score.courseTitle]?.id;
      }

      if (!courseId) {
        results.skippedNoCourse++;
        continue;
      }

      // Keep only the highest passing score per user+course
      const key = `${userId}-${courseId}`;
      if (!bestScores[key] || Number(score.score) > Number(bestScores[key].score)) {
        bestScores[key] = {
          ...score,
          _userId: userId,
          _courseId: courseId,
        };
      }
    }

    // 5. Create user-certificate records for each best passing score
    for (const [key, score] of Object.entries(bestScores)) {
      results.processed++;

      // Skip if certificate already exists
      if (existingCertKeys.has(key)) {
        results.skippedExisting++;
        continue;
      }

      try {
        const issuedDate = new Date(score.createdAt);
        const expiryDate = new Date(score.createdAt);
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        // Determine status based on dates
        const now = new Date();
        let status = 'active';
        if (expiryDate < now) {
          status = 'expired';
        } else {
          const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry <= 30) {
            status = 'expiring_soon';
          }
        }

        await strapi.db.query('api::user-certificate.user-certificate').create({
          data: {
            user: score._userId,
            course: score._courseId,
            quizScore: score.id,
            issuedDate: issuedDate.toISOString().split('T')[0],
            expiryDate: expiryDate.toISOString().split('T')[0],
            status,
            notificationsSent: [],
            publishedAt: new Date(),
          },
        });

        results.created++;
      } catch (error) {
        results.errors.push({
          scoreId: score.id,
          username: score.username,
          courseTitle: score.courseTitle,
          error: error.message,
        });
      }
    }

    return {
      success: true,
      message: `Migration complete. Created ${results.created} certificates.`,
      results,
    };
  },
}));
