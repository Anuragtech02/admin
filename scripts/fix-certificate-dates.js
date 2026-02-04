#!/usr/bin/env node

/**
 * Fix Script: Update user-certificate issuedDate to use quiz-score updatedAt
 *
 * Usage:
 *   node scripts/fix-certificate-dates.js
 *
 * Environment variables:
 *   STRAPI_URL   - e.g. https://admin.ryzolve.com
 *   STRAPI_TOKEN - Full Access API token
 *
 * What it does:
 *   1. Fetches all user-certificates with their quizScore relation
 *   2. For each certificate, gets the quiz-score's updatedAt date
 *   3. Updates issuedDate to use updatedAt, recalculates expiryDate (+1 year)
 *   4. Updates status based on new expiry date
 */

const STRAPI_URL = process.env.STRAPI_URL || "https://admin.ryzolve.com";
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || "";

if (!STRAPI_TOKEN) {
  console.error("ERROR: STRAPI_TOKEN is required.");
  console.error(
    "Usage: STRAPI_URL=https://admin.ryzolve.com STRAPI_TOKEN=your_token node scripts/fix-certificate-dates.js"
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
        `Failed to fetch ${endpoint} page ${page}: ${res.status} ${text}`
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

async function updateUserCertificate(id, data) {
  const res = await fetch(`${STRAPI_URL}/api/user-certificates/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update certificate ${id}: ${res.status} ${text}`);
  }

  return res.json();
}

// ---------- Main ----------

async function main() {
  console.log(`\nFix Script: Update certificate issuedDate to use quiz-score updatedAt`);
  console.log(`Strapi URL: ${STRAPI_URL}\n`);

  // 1. Fetch all user-certificates with quizScore populated
  console.log("Fetching user-certificates with quiz scores...");
  const certificates = await fetchAllPaginated(
    "user-certificates",
    "&populate=quizScore,user,course"
  );
  console.log(`  Found ${certificates.length} user-certificates\n`);

  const results = {
    updated: 0,
    skippedNoQuizScore: 0,
    skippedSameDate: 0,
    errors: [],
  };

  for (const cert of certificates) {
    const certId = cert.id;
    const attrs = cert.attributes;
    const quizScore = attrs.quizScore?.data;

    if (!quizScore) {
      console.log(`  SKIP (no quizScore): cert #${certId}`);
      results.skippedNoQuizScore++;
      continue;
    }

    const quizScoreAttrs = quizScore.attributes;
    const oldIssuedDate = attrs.issuedDate;
    const oldExpiryDate = attrs.expiryDate;

    // Use updatedAt from quiz-score as the new issued date
    const newIssuedDate = new Date(quizScoreAttrs.updatedAt);
    const newIssuedDateStr = newIssuedDate.toISOString().split("T")[0];

    // Calculate new expiry date (+1 year from issued date)
    const newExpiryDate = new Date(quizScoreAttrs.updatedAt);
    newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1);
    const newExpiryDateStr = newExpiryDate.toISOString().split("T")[0];

    // Check if dates are the same (no update needed)
    if (oldIssuedDate === newIssuedDateStr && oldExpiryDate === newExpiryDateStr) {
      console.log(`  SKIP (same dates): cert #${certId}`);
      results.skippedSameDate++;
      continue;
    }

    // Calculate new status
    const now = new Date();
    let newStatus = "active";
    if (newExpiryDate < now) {
      newStatus = "expired";
    } else {
      const daysLeft = Math.ceil((newExpiryDate - now) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 30) newStatus = "expiring_soon";
    }

    try {
      await updateUserCertificate(certId, {
        issuedDate: newIssuedDateStr,
        expiryDate: newExpiryDateStr,
        status: newStatus,
      });

      results.updated++;
      const userName = attrs.user?.data?.attributes?.username || "Unknown";
      const courseTitle = attrs.course?.data?.attributes?.title || "Unknown";
      console.log(
        `  UPDATED: cert #${certId} (${userName} - ${courseTitle})`
      );
      console.log(
        `           issuedDate: ${oldIssuedDate} -> ${newIssuedDateStr}`
      );
      console.log(
        `           expiryDate: ${oldExpiryDate} -> ${newExpiryDateStr}`
      );
      console.log(`           status: ${attrs.status} -> ${newStatus}`);
    } catch (error) {
      results.errors.push({
        certId,
        error: error.message,
      });
      console.error(`  ERROR: cert #${certId} - ${error.message}`);
    }
  }

  // Summary
  console.log("\n========================================");
  console.log("Fix Script Complete");
  console.log("========================================");
  console.log(`  Certificates updated:       ${results.updated}`);
  console.log(`  Skipped (no quiz score):    ${results.skippedNoQuizScore}`);
  console.log(`  Skipped (dates unchanged):  ${results.skippedSameDate}`);
  console.log(`  Errors:                     ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log("\nErrors:");
    for (const err of results.errors) {
      console.log(`  Cert #${err.certId}: ${err.error}`);
    }
  }

  console.log("");
}

main().catch((err) => {
  console.error("Fix script failed:", err);
  process.exit(1);
});
