"use strict";

/**
 * Quiz Score Lifecycle Hooks
 * Automatically creates user certificates when users pass with 90%+ score
 */

module.exports = {
  async afterCreate(event) {
    const { result } = event;

    // Skip if no user or course relation
    if (!result.user || !result.course) {
      console.log("Quiz score created without user or course relation, skipping certificate check");
      return;
    }

    // Calculate percentage
    const score = parseInt(result.score, 10);
    const totalQuestions = result.totalQuestions;

    if (!totalQuestions || totalQuestions === 0) {
      console.log("Quiz score missing totalQuestions, cannot calculate percentage");
      return;
    }

    const percentage = (score / totalQuestions) * 100;
    console.log(`Quiz score: ${score}/${totalQuestions} = ${percentage}%`);

    // Check if passing (90%+)
    if (percentage < 90) {
      console.log(`Score ${percentage}% is below 90%, no certificate issued`);

      // Update isPassing field
      await strapi.db.query("api::quiz-score.quiz-score").update({
        where: { id: result.id },
        data: { isPassing: false },
      });
      return;
    }

    // Update isPassing field
    await strapi.db.query("api::quiz-score.quiz-score").update({
      where: { id: result.id },
      data: { isPassing: true },
    });

    // Get user and course IDs
    const userId = typeof result.user === "object" ? result.user.id : result.user;
    const courseId = typeof result.course === "object" ? result.course.id : result.course;

    // Check if user certificate already exists for this user and course
    const existingUserCertificate = await strapi.db
      .query("api::user-certificate.user-certificate")
      .findOne({
        where: {
          user: userId,
          course: courseId,
          status: { $ne: "expired" },
        },
      });

    if (existingUserCertificate) {
      console.log(
        `User certificate already exists for user ${userId} and course ${courseId}, skipping`
      );
      return;
    }

    // Fetch course details
    const course = await strapi.db.query("api::course.course").findOne({
      where: { id: courseId },
    });

    if (!course) {
      console.log(`Course ${courseId} not found, cannot issue certificate`);
      return;
    }

    // Calculate dates - use quiz score createdAt as issue date
    const issuedDate = new Date(result.createdAt).toISOString().split("T")[0];
    const expiryDate = new Date(result.createdAt);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    const expiryDateString = expiryDate.toISOString().split("T")[0];

    // Get user details for email
    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({
        where: { id: userId },
      });

    try {
      // Create user certificate for expiry tracking
      const userCertificate = await strapi.db
        .query("api::user-certificate.user-certificate")
        .create({
          data: {
            user: userId,
            course: courseId,
            quizScore: result.id,
            issuedDate: issuedDate,
            expiryDate: expiryDateString,
            status: "active",
            notificationsSent: [],
            publishedAt: new Date(),
          },
        });

      console.log(
        `User certificate ${userCertificate.id} created for user ${userId} on course ${courseId}`
      );

      // Send congratulations email to user
      if (user && user.email) {
        const courseName = course.title || "your course";
        const userName = user.firstname || user.username || "Student";

        await strapi.plugins["email"].services.email.send({
          to: user.email,
          subject: `Congratulations! You've Earned Your ${courseName} Certificate`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://fhfqjcc.stripocdn.email/content/guids/CABINET_e4cafd70dfbf78cd99f9e36321d47993cd56fe9c5c3482d5a73b875e3956e04b/images/screenshot_20240417_at_164631removebgpreview.png" alt="Ryzolve" style="max-width: 150px;" />
              </div>
              <h2 style="color: #4CAF50; text-align: center;">Congratulations!</h2>
              <p style="font-size: 14px; color: #555;">Hi ${userName},</p>
              <p style="font-size: 14px; color: #555;">
                You've successfully completed <strong>${courseName}</strong> with a score of <strong>${percentage.toFixed(0)}%</strong>!
              </p>
              <p style="font-size: 14px; color: #555;">
                Your certificate has been issued and is now available in your account.
              </p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                  <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Course</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${courseName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Score</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${score}/${totalQuestions} (${percentage.toFixed(0)}%)</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Issued Date</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${issuedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Valid Until</strong></td>
                  <td style="padding: 10px; border: 1px solid #ddd;">${expiryDateString}</td>
                </tr>
              </table>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL || "https://training.ryzolve.com"}/account/certificates" style="display: inline-block; padding: 15px 30px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">View Your Certificate</a>
              </div>
              <p style="font-size: 14px; color: #555;">If you have any questions, please contact our support team.</p>
              <p style="font-size: 14px; color: #555;">Best regards,<br />The Ryzolve Team</p>
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                <p style="font-size: 12px; color: #999;">© 2024 Ryzolve Inc. All rights reserved.</p>
                <p style="font-size: 12px; color: #999;">9309 Highway 75 S Ste 102, New Waverly, TX 77358</p>
              </div>
            </div>
          `,
        });

        console.log(`Certificate email sent to ${user.email}`);
      }

      // Send notification to admin
      await strapi.plugins["email"].services.email.send({
        to: "pas@ryzolve.com",
        subject: `New Certificate Issued: ${user?.username || "User"} - ${course.title || "Course"}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="https://fhfqjcc.stripocdn.email/content/guids/CABINET_e4cafd70dfbf78cd99f9e36321d47993cd56fe9c5c3482d5a73b875e3956e04b/images/screenshot_20240417_at_164631removebgpreview.png" alt="Ryzolve" style="max-width: 150px;" />
            </div>
            <h2 style="color: #333;">New Certificate Issued</h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>User</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${user?.username || "N/A"}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Email</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${user?.email || "N/A"}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Course</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${course.title || "N/A"}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Score</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${score}/${totalQuestions} (${percentage.toFixed(0)}%)</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Issued Date</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${issuedDate}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Expiry Date</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${expiryDateString}</td>
              </tr>
            </table>
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p style="font-size: 12px; color: #999;">© 2024 Ryzolve Inc. All rights reserved.</p>
            </div>
          </div>
        `,
      });

      console.log("Admin notification sent for new certificate");
    } catch (error) {
      console.error("Error creating user certificate:", error);
    }
  },
};
