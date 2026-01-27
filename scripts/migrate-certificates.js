#!/usr/bin/env node

/**
 * Migration Script: Backfill user-certificates from existing passing quiz scores.
 *
 * Usage:
 *   node scripts/migrate-certificates.js
 *
 * Environment variables (or edit the constants below):
 *   STRAPI_URL   - e.g. https://admin.ryzolve.com
 *   STRAPI_TOKEN - Full Access API token
 *
 * What it does:
 *   1. Fetches all quiz scores (paginated)
 *   2. Fetches all existing user-certificates (to skip duplicates)
 *   3. Fetches all users and courses (for resolving old scores without relations)
 *   4. For each passing score (>=70%), creates a user-certificate record
 *   5. Uses original quiz createdAt as issuedDate, +1 year for expiryDate
 */

const STRAPI_URL = process.env.STRAPI_URL || "https://admin.ryzolve.com";
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || "";
const PASS_THRESHOLD = Number(process.env.PASS_THRESHOLD) || 70;

if (!STRAPI_TOKEN) {
  console.error("ERROR: STRAPI_TOKEN is required.");
  console.error(
    "Usage: STRAPI_URL=https://admin.ryzolve.com STRAPI_TOKEN=your_token node scripts/migrate-certificates.js",
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
      throw new Error(
        `Failed to fetch ${endpoint} page ${page}: ${res.status} ${text}`,
      );
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
  console.log(`\nMigration: Backfill user-certificates`);
  console.log(`Strapi URL: ${STRAPI_URL}`);
  console.log(`Pass threshold: ${PASS_THRESHOLD}%\n`);

  // 1. Fetch all quiz scores
  console.log("Fetching quiz scores...");
  const quizScores = await fetchAllPaginated(
    "quiz-scores",
    "&populate=user,course",
  );
  console.log(`  Found ${quizScores.length} quiz scores`);

  // 2. Fetch all existing user-certificates
  console.log("Fetching existing user-certificates...");
  const existingCerts = await fetchAllPaginated(
    "user-certificates",
    "&populate=user,course,quizScore",
  );
  console.log(`  Found ${existingCerts.length} existing certificates`);

  // Build set of existing cert keys
  const existingKeys = new Set();
  for (const cert of existingCerts) {
    const userId = cert.attributes?.user?.data?.id;
    const courseId = cert.attributes?.course?.data?.id;
    if (userId && courseId) {
      existingKeys.add(`${userId}-${courseId}`);
    }
  }

  // 3. Fetch all users and courses for resolving old scores
  // Note: /api/users (users-permissions plugin) returns flat objects, not wrapped in attributes
  console.log("Fetching users...");
  const usersRes = await fetch(
    `${STRAPI_URL}/api/users?pagination[pageSize]=1000`,
    { headers },
  );
  if (!usersRes.ok)
    throw new Error(`Failed to fetch users: ${usersRes.status}`);
  const users = await usersRes.json();

  const userByEmail = {};
  const userByUsername = {};
  for (const u of users) {
    if (u.email) userByEmail[u.email.toLowerCase()] = u.id;
    if (u.username) userByUsername[u.username] = u.id;
  }
  console.log(`  Found ${users.length} users`);

  console.log("Fetching courses...");
  const courses = await fetchAllPaginated("courses");
  const courseByTitle = {};
  for (const c of courses) {
    const title = c.attributes?.title;
    if (title) courseByTitle[title] = c.id;
  }
  console.log(`  Found ${courses.length} courses`);

  // 4. Process quiz scores - group by user+course, keep highest
  const results = {
    processed: 0,
    created: 0,
    skippedExisting: 0,
    skippedNotPassing: 0,
    skippedNoUser: 0,
    skippedNoCourse: 0,
    errors: [],
  };

  const bestScores = {};

  for (const score of quizScores) {
    const attrs = score.attributes;
    const totalQuestions = attrs.totalQuestions || 10;
    const percentage = (Number(attrs.score) / totalQuestions) * 100;

    if (percentage < PASS_THRESHOLD) {
      results.skippedNotPassing++;
      continue;
    }

    // Resolve user: try relation first, then email, then username
    let userId = attrs.user?.data?.id;
    if (!userId && attrs.email) {
      userId = userByEmail[attrs.email.toLowerCase()];
    }
    if (!userId && attrs.username) {
      userId = userByUsername[attrs.username];
    }
    if (!userId) {
      console.log(
        `  SKIP (no user): username="${attrs.username}" email="${attrs.email}"`,
      );
      results.skippedNoUser++;
      continue;
    }

    // Resolve course
    let courseId = attrs.course?.data?.id;
    if (!courseId && attrs.courseTitle) {
      courseId = courseByTitle[attrs.courseTitle];
    }
    if (!courseId) {
      results.skippedNoCourse++;
      continue;
    }

    // Keep highest per user+course
    const key = `${userId}-${courseId}`;
    const current = bestScores[key];
    if (!current || Number(attrs.score) > Number(current.attrs.score)) {
      bestScores[key] = { id: score.id, attrs, userId, courseId };
    }
  }

  // 5. Create certificates
  const entries = Object.entries(bestScores);
  console.log(
    `\nProcessing ${entries.length} passing user+course combinations...\n`,
  );

  for (const [key, { id: scoreId, attrs, userId, courseId }] of entries) {
    results.processed++;

    if (existingKeys.has(key)) {
      results.skippedExisting++;
      console.log(`  SKIP (exists): user=${userId} course=${courseId}`);
      continue;
    }

    try {
      const issuedDate = new Date(attrs.createdAt);
      const expiryDate = new Date(attrs.createdAt);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

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

      results.created++;
      console.log(
        `  CREATED: user=${userId} course=${courseId} status=${status} issued=${issuedDate.toISOString().split("T")[0]} expires=${expiryDate.toISOString().split("T")[0]}`,
      );
    } catch (error) {
      results.errors.push({
        scoreId,
        username: attrs.username,
        courseTitle: attrs.courseTitle,
        error: error.message,
      });
      console.error(
        `  ERROR: user=${userId} course=${courseId} - ${error.message}`,
      );
    }
  }

  // 6. Summary
  console.log("\n========================================");
  console.log("Migration Complete");
  console.log("========================================");
  console.log(`  Passing scores processed: ${results.processed}`);
  console.log(`  Certificates created:     ${results.created}`);
  console.log(`  Skipped (already exists): ${results.skippedExisting}`);
  console.log(`  Skipped (not passing):    ${results.skippedNotPassing}`);
  console.log(`  Skipped (no user found):  ${results.skippedNoUser}`);
  console.log(`  Skipped (no course found):${results.skippedNoCourse}`);
  console.log(`  Errors:                   ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log("\nErrors:");
    for (const err of results.errors) {
      console.log(
        `  Score #${err.scoreId} (${err.username} / ${err.courseTitle}): ${err.error}`,
      );
    }
  }

  console.log("");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
