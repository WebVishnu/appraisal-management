import connectDB from '@/lib/mongodb';
import Notification from '@/lib/models/Notification';
import Employee from '@/lib/models/Employee';
import AppraisalCycle from '@/lib/models/AppraisalCycle';
import User from '@/lib/models/User';

export async function createNotification(
  userId: string,
  type: 'cycle_started' | 'cycle_deadline' | 'review_pending' | 'review_submitted' | 'cycle_closed' | 'reminder' | 'onboarding_invited' | 'onboarding_pending' | 'onboarding_submitted' | 'onboarding_approved' | 'onboarding_rejected' | 'onboarding_changes_requested',
  title: string,
  message: string,
  link?: string,
  relatedId?: string
) {
  try {
    await connectDB();
    await Notification.create({
      userId,
      type,
      title,
      message,
      link,
      relatedId,
      isRead: false,
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

export async function notifyCycleStatusChange(cycleId: string, status: string) {
  try {
    await connectDB();
    const cycle = await AppraisalCycle.findById(cycleId);
    if (!cycle) return;

    const employees = await Employee.find({ isActive: true });
    const users = await User.find({
      employeeId: { $in: employees.map((e) => e._id) },
      isActive: true,
    });

    let title = '';
    let message = '';
    let link = '';

    switch (status) {
      case 'open_self_review':
        title = 'New Appraisal Cycle Started';
        message = `The appraisal cycle "${cycle.name}" is now open for self-review. Please submit your self-assessment.`;
        link = '/dashboard/employee/appraisals';
        break;
      case 'open_manager_review':
        title = 'Manager Review Phase Started';
        message = `The appraisal cycle "${cycle.name}" is now open for manager review. Please review your team members.`;
        link = '/dashboard/manager/reviews';
        break;
      case 'closed':
        title = 'Appraisal Cycle Closed';
        message = `The appraisal cycle "${cycle.name}" has been closed. View your final ratings.`;
        link = '/dashboard/employee/appraisals';
        break;
      default:
        return;
    }

    // Create notifications for all active users
    const notificationPromises = users.map((user) =>
      createNotification(
        user._id.toString(),
        status === 'open_self_review'
          ? 'cycle_started'
          : status === 'open_manager_review'
          ? 'review_pending'
          : 'cycle_closed',
        title,
        message,
        link,
        cycleId
      )
    );

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error notifying cycle status change:', error);
  }
}

