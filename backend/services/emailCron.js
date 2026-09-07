import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { User, Attempt } from '../models/Schemas.js';

// Setup email transporter using Gmail SMTP
const getTransporter = () => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  
  if (!user || !pass) {
    return null;
  }

  // Uses configurable SMTP settings
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: { user, pass }
  });
};

export const startWeeklyEmailCron = () => {
  // Cron schedule: '0 0 * * 0' (Every Sunday at midnight)
  cron.schedule('0 0 * * 0', async () => {
    console.log('Running weekly student placement preparation summary email cron...');
    const transporter = getTransporter();
    if (!transporter) {
      console.warn('EmailCron: SMTP credentials missing in env. Skipping weekly summary mailouts.');
      return;
    }

    try {
      const users = await User.find();
      for (const user of users) {
        // Skip guest user
        if (user.email === 'guest@college.edu') continue;

        const completedCount = user.completedRoadmapTopics ? user.completedRoadmapTopics.length : 0;
        
        // Count total score attempts
        const attemptsCount = await Attempt.countDocuments({ userId: user._id });

        const mailOptions = {
          from: process.env.SMTP_USER,
          to: user.email,
          subject: 'Weekly Placement Preparation Report — THE_PlacementGRID',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #ece7db; background-color: #fdfbf7; border-radius: 12px;">
              <h2 style="color: #3a6053; font-family: Georgia, serif; border-bottom: 2px solid #3a6053; padding-bottom: 10px;">THE_PlacementGRID Summary</h2>
              <p style="color: #2d2d2d; font-size: 14px;">Hi ${user.name},</p>
              <p style="color: #2d2d2d; font-size: 14px; line-height: 1.5;">Here is your weekly progress report card tracking your placement readiness stats:</p>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="border-bottom: 1px solid #ece7db;">
                  <td style="padding: 12px 0; font-weight: bold; color: #2d2d2d; font-size: 13px;">Daily Study Streak</td>
                  <td style="padding: 12px 0; text-align: right; color: #c26d4b; font-weight: bold; font-size: 14px;">🔥 ${user.streakCount || 0} Days</td>
                </tr>
                <tr style="border-bottom: 1px solid #ece7db;">
                  <td style="padding: 12px 0; font-weight: bold; color: #2d2d2d; font-size: 13px;">Roadmap Topics Completed</td>
                  <td style="padding: 12px 0; text-align: right; color: #3a6053; font-weight: bold; font-size: 14px;">✔️ ${completedCount} Topics</td>
                </tr>
                <tr style="border-bottom: 1px solid #ece7db;">
                  <td style="padding: 12px 0; font-weight: bold; color: #2d2d2d; font-size: 13px;">Practice Tests Attempted</td>
                  <td style="padding: 12px 0; text-align: right; color: #3a6053; font-weight: bold; font-size: 14px;">📝 ${attemptsCount} attempts</td>
                </tr>
                <tr style="border-bottom: 1px solid #ece7db;">
                  <td style="padding: 12px 0; font-weight: bold; color: #2d2d2d; font-size: 13px;">Pinned Target Company</td>
                  <td style="padding: 12px 0; text-align: right; color: #2d2d2d; font-weight: bold; font-size: 13px;">${user.targetCompany || 'Not set'}</td>
                </tr>
              </table>
              
              <p style="font-size: 12px; color: #8e8e8e; text-align: center; margin-top: 25px; font-style: italic;">
                “Consistent practice is the difference between demoing a product and landing a job.”
              </p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log(`EmailCron: Sent weekly summary report to ${user.email}`);
      }
    } catch (error) {
      console.error('EmailCron: Failed running cron job:', error.message);
    }
  });

  console.log('EmailCron: Weekly progress summary cron task registered successfully.');
};
