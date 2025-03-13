// For now, we'll just simulate email sending with console logs
// In a production environment, you would integrate with a service like SendGrid, Mailgun, etc.

type BookingDetails = {
  id: string;
  propertyName: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  totalAmount: string;
  currency: string;
};

/**
 * Send a booking confirmation email to the guest
 */
export const sendBookingConfirmationToGuest = async (booking: BookingDetails): Promise<void> => {
  console.log('------------- SENDING EMAIL TO GUEST -------------');
  console.log(`To: ${booking.guestEmail}`);
  console.log(`Subject: Your booking at ${booking.propertyName} is confirmed!`);
  console.log(`Body: 
    Dear ${booking.guestName},
    
    Your booking at ${booking.propertyName} has been confirmed!
    
    Booking Details:
    - Check-in: ${booking.checkIn}
    - Check-out: ${booking.checkOut}
    - Total: ${booking.currency} ${booking.totalAmount}
    - Booking ID: ${booking.id}
    
    Thank you for booking with us!
  `);
  console.log('---------------------------------------------------');
  
  // In production, you would actually send the email here
  // For example, using SendGrid:
  /*
  const msg = {
    to: booking.guestEmail,
    from: 'bookings@yoursite.com',
    subject: `Your booking at ${booking.propertyName} is confirmed!`,
    text: `Dear ${booking.guestName},...`,
    html: `<p>Dear ${booking.guestName},...</p>`,
  };
  await sgMail.send(msg);
  */
};

/**
 * Send a booking notification to the host
 */
export const sendBookingNotificationToHost = async (
  hostEmail: string, 
  booking: BookingDetails, 
  includeCalendarReminder: boolean = true
): Promise<void> => {
  console.log('------------- SENDING EMAIL TO HOST -------------');
  console.log(`To: ${hostEmail}`);
  console.log(`Subject: New booking for ${booking.propertyName}`);
  console.log(`Body: 
    Hello,
    
    You have a new booking for ${booking.propertyName}!
    
    Booking Details:
    - Guest: ${booking.guestName} (${booking.guestEmail})
    - Check-in: ${booking.checkIn}
    - Check-out: ${booking.checkOut}
    - Total: ${booking.currency} ${booking.totalAmount}
    - Booking ID: ${booking.id}
    
    ${includeCalendarReminder ? `
    IMPORTANT: Please remember to refresh your Airbnb calendar to sync this booking
    and prevent double bookings. You can do this by:
    1. Log into your Airbnb host account
    2. Go to your calendar
    3. Click "Refresh" on your imported calendar
    
    Alternatively, you can sync now from your property dashboard.
    ` : ''}
    
    Thank you!
  `);
  console.log('---------------------------------------------------');
  
  // In production, implement actual email sending
};

/**
 * Send a calendar sync reminder to the host
 */
export const sendCalendarSyncReminder = async (
  hostEmail: string,
  propertyName: string,
  propertyId: string,
  baseUrl: string
): Promise<void> => {
  const dashboardUrl = `${baseUrl}/dashboard/properties/${propertyId}`;
  
  console.log('------------- SENDING CALENDAR REMINDER -------------');
  console.log(`To: ${hostEmail}`);
  console.log(`Subject: Reminder: Sync your Airbnb calendar for ${propertyName}`);
  console.log(`Body: 
    Hello,
    
    This is a reminder to sync your Airbnb calendar for ${propertyName}.
    
    Recently, there have been new bookings that need to be reflected in your Airbnb calendar
    to prevent double bookings.
    
    You can sync your calendar in two ways:
    
    1. Log into your Airbnb host account and refresh your imported calendar
    2. Visit your property dashboard (${dashboardUrl}) and click "Sync Now" in the Calendar tab
    
    Thank you!
  `);
  console.log('---------------------------------------------------');
  
  // In production, implement actual email sending
}; 