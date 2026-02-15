#!/usr/bin/env node

/**
 * Backfill Script: Fix quiz-scores missing course relation and create certificates.
 *
 * Usage:
 *   STRAPI_TOKEN=your_token node scripts/backfill-quiz-scores.js
 *
 * Environment variables:
 *   STRAPI_URL   - e.g. https://admin.ryzolve.com (default)
 *   STRAPI_TOKEN - Full Access API token (required)
 *
 * What it does:
 *   1. Fetches all quiz scores (paginated)
 *   2. Finds scores missing the course relation
 *   3. Matches course by courseTitle field
 *   4. Updates quiz-score with course relation and isPassing flag
 *   5. Creates user-certificate for passing scores (90%+) that don't have one
 */

const STRAPI_URL = process.env.STRAPI_URL || "https://admin.ryzolve.com";
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || "";
const PASS_THRESHOLD = Number(process.env.PASS_THRESHOLD) || 90;

if (!STRAPI_TOKEN) {
  console.error("ERROR: STRAPI_TOKEN is required.");
  console.error(
    "Usage: STRAPI_URL=https://admin.ryzolve.com STRAPI_TOKEN=your_token node scripts/backfill-quiz-scores.js"
  );
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${STRAPI_TOKEN}`,
};

// ---------- Helpers ----------

async function fetchAllPaginated(endpoint, populate = "") {
  const all = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const url = `${STRAPI_URL}/api/${endpoint}?pagination[page]=${page}&pagination[pageSize]=${pageSize}${populate}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch ${endpoint} page ${page}: ${res.status} ${text}`);
    }

    const json = await res.json();
    const items = json.data || [];
    all.push(...items);

    const pagination = json.meta?.pagination;
    if (!pagination || page >= pagination.pageCount) break;
    page++;
  }

  return all;
}

async function updateQuizScore(id, data) {
  const res = await fetch(`${STRAPI_URL}/api/quiz-scores/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update quiz-score ${id}: ${res.status} ${text}`);
  }

  return res.json();
}

async function createUserCertificate(data) {
  const res = await fetch(`${STRAPI_URL}/api/user-certificates`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create certificate: ${res.status} ${text}`);
  }

  return res.json();
}

// ---------- Main ----------

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("Backfill Script: Fix Quiz Scores Missing Course Relation");
  console.log("=".repeat(60));
  console.log(`Strapi URL: ${STRAPI_URL}`);
  console.log(`Pass threshold: ${PASS_THRESHOLD}%\n`);

  // 1. Fetch all quiz scores with relations
  console.log("Fetching quiz scores...");
  const quizScores = await fetchAllPaginated("quiz-scores", "&populate=user,course");
  console.log(`  Found ${quizScores.length} total quiz scores`);

  // 2. Filter quiz-scores missing course relation
  const scoresMissingCourse = quizScores.filter((qs) => !qs.attributes?.course?.data);
  console.log(`  Found ${scoresMissingCourse.length} quiz scores missing course relation`);

  if (scoresMissingCourse.length === 0) {
    console.log("\nNo quiz scores need fixing. Exiting.");
    return;
  }

  // 3. Fetch all courses for lookup
  console.log("Fetching courses...");
  const courses = await fetchAllPaginated("courses");
  const courseByTitle = {};
  const courseByTitleLower = {};
  for (const c of courses) {
    const title = c.attributes?.title;
    if (title) {
      courseByTitle[title] = c.id;
      courseByTitleLower[title.toLowerCase()] = c.id;
    }
  }
  console.log(`  Found ${courses.length} courses for lookup`);

  // 4. Fetch all users for lookup (in case user relation is also missing)
  console.log("Fetching users...");
  const usersRes = await fetch(`${STRAPI_URL}/api/users?pagination[pageSize]=1000`, { headers });
  if (!usersRes.ok) throw new Error(`Failed to fetch users: ${usersRes.status}`);
  const users = await usersRes.json();

  const userByEmail = {};
  const userByUsername = {};
  for (const u of users) {
    if (u.email) userByEmail[u.email.toLowerCase()] = u.id;
    if (u.username) userByUsername[u.username] = u.id;
  }
  console.log(`  Found ${users.length} users for lookup`);

  // 5. Fetch existing user-certificates to avoid duplicates
  console.log("Fetching existing user-certificates...");
  const existingCerts = await fetchAllPaginated("user-certificates", "&populate=user,course");
  const existingCertKeys = new Set();
  for (const cert of existingCerts) {
    const userId = cert.attributes?.user?.data?.id;
    const courseId = cert.attributes?.course?.data?.id;
    if (userId && courseId) {
      existingCertKeys.add(`${userId}-${courseId}`);
    }
  }
  console.log(`  Found ${existingCerts.length} existing certificates`);

  // 6. Process quiz scores
  const results = {
    fixed: 0,
    certificatesCreated: 0,
    skippedNoCourse: 0,
    skippedNoUser: 0,
    skippedCertExists: 0,
    skippedNotPassing: 0,
    errors: [],
  };

  console.log(`\nProcessing ${scoresMissingCourse.length} quiz scores...\n`);

  for (const score of scoresMissingCourse) {
    const attrs = score.attributes;
    const scoreId = score.id;

    console.log(`--- Quiz Score ID: ${scoreId} ---`);
    console.log(`  Username: ${attrs.username}`);
    console.log(`  Course Title: ${attrs.courseTitle}`);
    console.log(`  Score: ${attrs.score}/${attrs.totalQuestions || 10}`);

    try {
      // Find course by title (exact match first, then case-insensitive)
      let courseId = courseByTitle[attrs.courseTitle];
      if (!courseId && attrs.courseTitle) {
        courseId = courseByTitleLower[attrs.courseTitle.toLowerCase()];
      }
      // Try partial match if still not found
      if (!courseId && attrs.courseTitle) {
        for (const [title, id] of Object.entries(courseByTitle)) {
          if (
            title.toLowerCase().includes(attrs.courseTitle.toLowerCase()) ||
            attrs.courseTitle.toLowerCase().includes(title.toLowerCase())
          ) {
            courseId = id;
            break;
          }
        }
      }

      if (!courseId) {
        console.log(`  ❌ Could not find course matching: "${attrs.courseTitle}"`);
        results.skippedNoCourse++;
        results.errors.push({
          scoreId,
          error: `Course not found: ${attrs.courseTitle}`,
        });
        continue;
      }

      console.log(`  ✓ Found course ID: ${courseId}`);

      // Find user (from relation or by username/email)
      let userId = attrs.user?.data?.id;
      if (!userId && attrs.email) {
        userId = userByEmail[attrs.email.toLowerCase()];
      }
      if (!userId && attrs.username) {
        userId = userByUsername[attrs.username];
      }

      if (!userId) {
        console.log(`  ❌ Could not find user: ${attrs.username} / ${attrs.email}`);
        results.skippedNoUser++;
        results.errors.push({
          scoreId,
          error: `User not found: ${attrs.username}`,
        });
        continue;
      }

      console.log(`  ✓ Found user ID: ${userId}`);

      // Calculate isPassing
      const scoreNum = parseInt(attrs.score, 10) || 0;
      const totalQuestions = attrs.totalQuestions || 10;
      const percentage = (scoreNum / totalQuestions) * 100;
      const isPassing = percentage >= PASS_THRESHOLD;

      console.log(`  Score: ${scoreNum}/${totalQuestions} = ${percentage}% - isPassing: ${isPassing}`);

      // Update quiz-score with course relation and isPassing
      await updateQuizScore(scoreId, {
        course: courseId,
        user: userId,
        isPassing: isPassing,
      });

      console.log(`  ✓ Updated quiz-score with course relation`);
      results.fixed++;

      // If passing, create user-certificate if doesn't exist
      if (isPassing) {
        const certKey = `${userId}-${courseId}`;
        if (existingCertKeys.has(certKey)) {
          console.log(`  ℹ User-certificate already exists, skipping`);
          results.skippedCertExists++;
        } else {
          // Calculate dates
          const issuedDate = new Date(attrs.createdAt);
          const expiryDate = new Date(attrs.createdAt);
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);

          // Determine status
          const now = new Date();
          let status = "active";
          if (expiryDate < now) {
            status = "expired";
          } else {
            const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 30) status = "expiring_soon";
          }

          await createUserCertificate({
            user: userId,
            course: courseId,
            quizScore: scoreId,
            issuedDate: issuedDate.toISOString().split("T")[0],
            expiryDate: expiryDate.toISOString().split("T")[0],
            status,
            notificationsSent: [],
            publishedAt: new Date().toISOString(),
          });

          existingCertKeys.add(certKey); // Prevent duplicates in this run
          results.certificatesCreated++;
          console.log(`  ✓ Created user-certificate (status: ${status})`);
        }
      } else {
        results.skippedNotPassing++;
        console.log(`  ℹ Score below ${PASS_THRESHOLD}%, no certificate created`);
      }
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      results.errors.push({ scoreId, error: error.message });
    }
  }

  // 7. Summary
  console.log("\n" + "=".repeat(60));
  console.log("Backfill Complete!");
  console.log("=".repeat(60));
  console.log(`  Quiz scores fixed:        ${results.fixed}`);
  console.log(`  Certificates created:     ${results.certificatesCreated}`);
  console.log(`  Skipped (no course):      ${results.skippedNoCourse}`);
  console.log(`  Skipped (no user):        ${results.skippedNoUser}`);
  console.log(`  Skipped (cert exists):    ${results.skippedCertExists}`);
  console.log(`  Skipped (not passing):    ${results.skippedNotPassing}`);
  console.log(`  Errors:                   ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log("\nErrors:");
    for (const err of results.errors) {
      console.log(`  Score #${err.scoreId}: ${err.error}`);
    }
  }

  console.log("");
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
