'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::order.order', ({ strapi }) => ({
  async checkIncompleteCourses() {
    const now = new Date();
    const reminderDays = [3, 7, 14, 30];
    
    // Get all paid orders with user info
    const orders = await strapi.entityService.findMany('api::order.order', {
      filters: { status: 'paid' },
      populate: ['user'],
    });
    
    for (const order of orders) {
      if (!order.user) continue;
      
      const daysSincePurchase = Math.floor((now - new Date(order.createdAt)) / (1000 * 60 * 60 * 24));
      const remindersSent = order.remindersSent || [];
      const products = order.products || [];
      
      if (products.length === 0) continue;
      
      // Find which reminder threshold we've reached
      for (const days of reminderDays) {
        if (daysSincePurchase >= days && !remindersSent.includes(days)) {
          // Check if user has any quiz scores for ordered courses
          let hasCompletedQuiz = false;
          
          for (const product of products) {
            const scores = await strapi.entityService.findMany('api::quiz-score.quiz-score', {
              filters: {
                user: order.user.id,
                course: product.id,
              },
            });
            if (scores.length > 0) {
              hasCompletedQuiz = true;
              break;
            }
          }
          
          if (!hasCompletedQuiz) {
            // Send reminder email
            await this.sendReminderEmail(order, days);
            
            // Update remindersSent
            await strapi.entityService.update('api::order.order', order.id, {
              data: { remindersSent: [...remindersSent, days] },
            });
          }
          break; // Only send one reminder per check
        }
      }
    }
    
    strapi.log.info('[Reminder] Course completion reminder check completed');
  },
  
  async sendReminderEmail(order, days) {
    const products = order.products || [];
    const courseNames = products.map(p => p.title || p.name || 'Course').join(', ');
    const userName = order.user.firstname || order.user.username || 'there';
    
    const urgencyText = days >= 14 
      ? "Don't miss out on your certification!"
      : days >= 7 
        ? "Your certification is waiting for you!"
        : "Start your training today!";
    
    try {
      await strapi.plugins["email"].services.email.send({
        to: order.user.email,
        subject: `Complete your training - ${courseNames}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF774B;">Complete Your Training</h2>
            <p>Hi ${userName},</p>
            <p>You enrolled in <strong>${courseNames}</strong> ${days} days ago but haven't completed the final quiz yet.</p>
            <p>${urgencyText}</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="https://training.ryzolve.com/my-learning" 
                 style="background: #FF774B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Continue Learning
              </a>
            </p>
            <p>If you have any questions, reply to this email or use the chat on our website.</p>
            <p>Best regards,<br><strong>The Ryzolve Team</strong></p>
            <hr style="border: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">© 2026 Ryzolve Inc. | 9309 Highway 75 S Ste 102, New Waverly, TX 77358</p>
          </div>
        `,
      });
      
      strapi.log.info(`[Reminder] Sent ${days}-day reminder to ${order.user.email} for order ${order.id}`);
    } catch (error) {
      strapi.log.error(`[Reminder] Failed to send email to ${order.user.email}:`, error);
    }
  },
}));
