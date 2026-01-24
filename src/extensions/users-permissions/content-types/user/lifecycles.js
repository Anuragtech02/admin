module.exports = {
  async afterCreate(event) {
    const { result } = event;

    try {
      // Send email notification to admin
      await strapi.plugins["email"].services.email.send({
        to: "pas@ryzolve.com",
        subject: `New User Registration: ${result.username}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="https://fhfqjcc.stripocdn.email/content/guids/CABINET_e4cafd70dfbf78cd99f9e36321d47993cd56fe9c5c3482d5a73b875e3956e04b/images/screenshot_20240417_at_164631removebgpreview.png" alt="Ryzolve" style="max-width: 150px;" />
            </div>
            <h2 style="color: #333;">New User Registration</h2>
            <p style="font-size: 14px; color: #555;">A new user has registered on Ryzolve:</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Username</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${result.username}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Email</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${result.email}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Agency</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${result.agency || "N/A"}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>City</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${result.city || "N/A"}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Country</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${result.country || "N/A"}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;"><strong>Phone</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${result.phone || "N/A"}</td>
              </tr>
            </table>
            <p style="font-size: 14px; color: #555; margin-top: 20px;">
              Registered at: ${new Date().toISOString()}
            </p>
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p style="font-size: 12px; color: #999;">© 2024 Ryzolve Inc. All rights reserved.</p>
            </div>
          </div>
        `,
      });

      console.log(`Admin notification sent for new user: ${result.username}`);
    } catch (err) {
      console.error("Error sending registration notification:", err);
    }
  },
};
