"use strict";

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
/**
 * A set of functions called "actions" for `stripe-webhook`
 */

module.exports = {
  handleWebhook: async (ctx, next) => {
    // Verify webhook signature
    const sig = ctx.request.headers["stripe-signature"];
    const rawBody = ctx.request.body[Symbol.for("unparsedBody")];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      ctx.response.status = 400;
      return ctx.send({ error: `Webhook Error: ${err.message}` });
    }

    // Handle the event
    switch (event.type) {
      case "payment_intent.succeeded":
        const successfulPaymentIntent = event.data.object;
        await handlePaymentIntentSucceeded(successfulPaymentIntent);
        break;
      case "payment_intent.payment_failed":
        const failedPaymentIntent = event.data.object;
        await handlePaymentIntentFailed(failedPaymentIntent);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    ctx.send({ received: true });
  },
};

async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    const order = await strapi.db.query("api::order.order").findOne({
      where: { stripeRandomNumber: paymentIntent.metadata.randomNumber },
    });

    if (order) {
      // Update the order status to 'paid'
      await strapi.db.query("api::order.order").update({
        where: { id: order.id },
        data: { status: "paid" },
      });

      // Enroll user in purchased courses
      const orderWithUser = await strapi.db.query("api::order.order").findOne({
        where: { id: order.id },
        populate: ["user"],
      });

      if (orderWithUser.user && orderWithUser.products) {
        for (const product of orderWithUser.products) {
          try {
            await strapi.db.query("api::course.course").update({
              where: { id: product.id },
              data: {
                users: {
                  connect: [orderWithUser.user.id],
                },
              },
            });
            console.log(
              `User ${orderWithUser.user.id} enrolled in course ${product.id}`
            );
          } catch (enrollError) {
            console.error(
              `Error enrolling user in course ${product.id}:`,
              enrollError
            );
          }
        }
      }

      const session = await stripe.checkout.sessions.retrieve(
        order.stripeSessionToken
      );
      console.log("Checkout Session:", session);

      // Extract product names from line items
      const lineItems = await stripe.checkout.sessions.listLineItems(
        session.id
      );
      const products = lineItems.data.map((item) => ({
        name: item.description,
        amount: item.amount_total.toFixed(2), // Convert from cents to dollars
      }));

      console.log(`Order ${order.id} status updated to paid`);
      await sendEmail(
        paymentIntent.metadata.email,
        "Payment Successful",
        `Your payment for order was successful`,
        products,
        paymentIntent.metadata.agency,
        paymentIntent.metadata.city
      );
    } else {
      console.log(`Order not found for PaymentIntent ${paymentIntent.id}`);
    }
  } catch (error) {
    console.error("Error updating order status to paid:", error);
  }
}

async function handlePaymentIntentFailed(paymentIntent) {
  try {
    const order = await strapi.db.query("api::order.order").findOne({
      where: { stripeRandomNumber: paymentIntent.metadata.randomNumber },
    });

    if (order) {
      // Update the order status to 'failed'
      await strapi.db.query("api::order.order").update({
        where: { id: order.id },
        data: {
          status: "failed",
        },
      });

      const session = await stripe.checkout.sessions.retrieve(
        order.stripeSessionToken
      );
      console.log("Checkout Session:", session);

      // Extract product names from line items
      const lineItems = await stripe.checkout.sessions.listLineItems(
        session.id
      );
      const products = lineItems.data.map((item) => ({
        name: item.description,
        amount: (item.amount_total / 100).toFixed(2), // Convert from cents to dollars
      }));

      await sendEmail(
        paymentIntent.metadata.email,
        "Payment Failed",
        `Your payment for order has failed.`,
        products,
        paymentIntent.metadata.agency,
        paymentIntent.metadata.city
      );

      console.log(`Order ${order.id} status updated to failed`);
    } else {
      console.log(
        `Order not found for failed PaymentIntent ${paymentIntent.id}`
      );
    }
  } catch (error) {
    console.error("Error updating order status to failed:", error);
  }
}

async function sendEmail(to, subject, message, products, agency, city) {
  try {
    const productDetails = products
      .map(
        (product) =>
          `<tr>
            <td style="padding: 10px; border: 1px solid #ddd;">${
              product.name
            }</td>
            <td style="padding: 10px; border: 1px solid #ddd;">$${(
              product.amount / 100
            ).toFixed(2)}</td>
          </tr>`
      )
      .join("");

    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://fhfqjcc.stripocdn.email/content/guids/CABINET_e4cafd70dfbf78cd99f9e36321d47993cd56fe9c5c3482d5a73b875e3956e04b/images/screenshot_20240417_at_164631removebgpreview.png" alt="Ryzolve" style="max-width: 150px;" />
        </div>
        <p style="font-size: 14px; color: #555;">${message}</p>

        <p style="font-size: 14px; color: #555;">
          <strong>Agency:</strong> ${agency} <br />
          <strong>City:</strong> ${city}
        </p>

        <h3 style="color: #333;">Products Ordered</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr>
              <th style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2; text-align: left;">Product Name</th>
              <th style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${productDetails}
          </tbody>
        </table>

        <p style="font-size: 14px; color: #555; margin-top: 20px;">
          If you have any questions or need further assistance, please don't hesitate to reach out to our support team.
        </p>
        <p style="font-size: 14px; color: #555;">Best regards,<br />The Ryzolve Team</p>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #999;">© 2024 Ryzolve Inc. All rights reserved.</p>
          <p style="font-size: 12px; color: #999;">9309 Highway 75 S Ste 102, New Waverly, TX 77358</p>
        </div>
      </div>
    `;

    // Send email to customer
    await strapi.plugins["email"].services.email.send({
      to: `${to}`,
      subject: subject,
      html: emailContent,
    });

    console.log(`Email sent to customer: ${to} with subject: ${subject}`);

    // Send email to Ryzolve team
    await strapi.plugins["email"].services.email.send({
      to: "pas@ryzolve.com",
      subject: `New Order from ${email} (${agency})`,
      html: emailContent, // Reusing the same content to notify Ryzolve team
    });

    console.log("Email sent to Ryzolve team at pas@ryzolve.com");
  } catch (error) {
    console.error("Error sending email:", error);
  }
}
