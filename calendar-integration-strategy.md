# Calendar Integration Strategy Document

## Overview: Hybrid Google Calendar + Database Approach

This document outlines a comprehensive strategy for implementing a booking calendar system that integrates your application database with Google Calendar and Airbnb.

## 1. System Architecture

### Core Components:
- **Your Application Database**: Stores detailed booking information
- **Google Calendar**: Serves as real-time availability manager and connection to Airbnb
- **Airbnb Calendar**: Connected to Google Calendar via Airbnb's built-in integration

### Data Flow:
1. **Primary Direction**: Your System → Google Calendar → Airbnb
   - Changes in your system propagate to Google Calendar
   - Airbnb reads availability from Google Calendar

2. **Secondary Direction**: Airbnb → Google Calendar → Your System
   - Airbnb bookings appear in Google Calendar
   - Your system periodically imports these bookings

### Architecture Benefits:
- Real-time availability display for customers
- Comprehensive booking data in your database
- Lower chance of double bookings
- Familiar Google Calendar interface for manual management

## 2. Google Calendar OAuth Implementation

### Registration Process:
1. Register application in Google Cloud Console
2. Configure OAuth consent screen
3. Create OAuth credentials with calendar scopes
4. Set authorized redirect URIs

### Authentication Flow:
```typescript
// Redirect to Google auth
function startGoogleAuth(hostId: string) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state: hostId
  });
  return authUrl;
}

// Handle OAuth callback
async function handleAuthCallback(code: string, hostId: string) {
  // Exchange code for tokens
  const { tokens } = await oauth2Client.getToken(code);
  
  // Store tokens in database
  await storeTokensForHost(hostId, tokens);
  
  return true;
}
```

### Token Management:
- Store refresh_token (long-lived) and access_token (short-lived)
- Implement automatic token refresh when access tokens expire
- Handle token revocation scenarios

## 3. Calendar Event Operations

### Creating Calendar Events:
```typescript
async function createCalendarEvent(booking) {
  // Get host's Google credentials
  const { googleTokens } = await getHostCredentials(booking.property.host_id);
  
  // Set up Google Calendar client
  const calendar = getCalendarClient(googleTokens);
  
  // Create event
  const event = {
    summary: `Booking: ${booking.guest_name}`,
    description: `Booking ID: ${booking.id}\nGuests: ${booking.guests_count}`,
    start: { date: booking.check_in.split('T')[0] },
    end: { date: booking.check_out.split('T')[0] },
    extendedProperties: {
      private: {
        bookingId: booking.id,
        source: 'your_application'
      }
    }
  };
  
  // Insert event
  const response = await calendar.events.insert({
    calendarId: booking.property.google_calendar_id,
    resource: event
  });
  
  // Store event ID in booking record
  await updateBookingWithEventId(booking.id, response.data.id);
  
  return response.data;
}
```

### Updating and Cancelling Events:
```typescript
async function cancelCalendarEvent(booking) {
  // Similar setup as creation
  const calendar = getCalendarClient(hostTokens);
  
  // Delete the event
  await calendar.events.delete({
    calendarId: booking.property.google_calendar_id,
    eventId: booking.google_calendar_event_id
  });
  
  // Update booking record
  await markEventDeleted(booking.id);
}
```

## 4. Synchronization Mechanisms

### Exporting Your Bookings:
- Create events in Google Calendar when bookings are confirmed
- Update events when booking details change
- Delete events when bookings are cancelled

### Importing Airbnb Bookings:
```typescript
async function importAirbnbBookings(propertyId) {
  // Get property and calendar details
  const property = await getProperty(propertyId);
  const calendar = getCalendarClient(property.host.googleTokens);
  
  // Get events from calendar (created by Airbnb)
  const response = await calendar.events.list({
    calendarId: property.google_calendar_id,
    timeMin: new Date().toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  });
  
  // Process events
  for (const event of response.data.items) {
    // Check if this is an Airbnb booking (based on event properties)
    if (isAirbnbEvent(event) && !isTrackedEvent(event)) {
      // Create external booking record
      await createExternalBooking({
        property_id: propertyId,
        source: 'airbnb',
        google_event_id: event.id,
        check_in: event.start.date,
        check_out: event.end.date,
        // Other details extracted from event
      });
    }
  }
}
```

### Sync Frequency:
- **Your Bookings → Google**: Immediate (after confirmation)
- **Google → Your System**: Regular intervals (every 15-30 minutes)

## 5. Property Management

### Calendar Setup:
```typescript
async function setupPropertyCalendar(propertyId) {
  // Get property and host details
  const property = await getProperty(propertyId);
  const calendar = getCalendarClient(property.host.googleTokens);
  
  // Create a dedicated calendar for this property
  const newCalendar = await calendar.calendars.insert({
    resource: {
      summary: `${property.name} Bookings`,
      description: `Booking calendar for ${property.name}`
    }
  });
  
  // Store calendar ID
  await updatePropertyCalendarId(propertyId, newCalendar.data.id);
  
  // Set calendar sharing with Airbnb (via iCal export)
  const calendarUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(newCalendar.data.id)}/public/basic.ics`;
  
  return {
    calendarId: newCalendar.data.id,
    icalUrl: calendarUrl
  };
}
```

### Manual Blocking:
- Allow hosts to block dates in your system
- Push these blocks to Google Calendar as events
- Tag events with metadata to distinguish blocks from bookings

## 6. User Interface Considerations

### Host Dashboard:
- "Connect to Google Calendar" button with OAuth flow
- Calendar connection status indicators
- Manual sync button for peace of mind
- Calendar sharing instructions for Airbnb

### Booking Interface:
- Real-time availability checks via Google Calendar API
- Clear loading states during availability checks
- Fallback to database if Google Calendar API fails

## 7. Costs and Technical Considerations

### Costs:
- **Google Calendar API**: Free tier (1M queries/day) sufficient for most uses
- **Development**: 20-40 hours for integration
- **Ongoing**: Minimal API costs, some maintenance time

### Technical Considerations:
- OAuth token security and refresh management
- Error handling for API failures
- Handling time zone differences
- Unique identifiers across systems
- Conflict resolution strategy

## 8. Implementation Roadmap

### Phase 1: Foundation
- Set up Google Cloud project and credentials
- Implement OAuth flow
- Create calendar management endpoints

### Phase 2: Core Integration
- Build booking → calendar event creation
- Implement cancellation flow
- Develop basic sync mechanisms

### Phase 3: Enhanced Functionality
- Add Airbnb booking import
- Implement manual date blocking
- Build conflict detection and resolution

### Phase 4: Optimization
- Add webhook-based updates
- Implement caching strategy
- Create admin tools for troubleshooting

## 9. Fallback Strategies

- Local availability caching in case of Google API outages
- Database-first checks before Google Calendar to reduce API calls
- Progressive degradation when services are unavailable

## 10. Database Schema Additions

To implement this integration, you'll need to add these fields to your database:

### Host Table Additions:
```sql
ALTER TABLE hosts 
ADD COLUMN google_refresh_token TEXT,
ADD COLUMN google_access_token TEXT,
ADD COLUMN google_token_expiry TIMESTAMP;
```

### Property Table Additions:
```sql
ALTER TABLE properties
ADD COLUMN google_calendar_id TEXT,
ADD COLUMN airbnb_ical_url TEXT;
```

### Booking Table Additions:
```sql
ALTER TABLE bookings
ADD COLUMN google_event_id TEXT,
ADD COLUMN source VARCHAR(50) DEFAULT 'direct'; -- Options: 'direct', 'airbnb', etc.
```

This will allow you to track which bookings have corresponding Google Calendar events and where each booking originated from. 