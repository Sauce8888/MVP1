import axios from 'axios';
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { CalendarConnection, CalendarEvent } from './types';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

/**
 * Fetches iCal feed from a URL
 */
export const fetchIcalFeed = async (url: string): Promise<string> => {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching iCal feed:', error);
    throw new Error(`Failed to fetch iCal feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Adds Airbnb calendar connection for a property
 */
export const addAirbnbCalendarConnection = async (
  propertyId: string, 
  icalUrl: string,
  customSupabase?: any
): Promise<CalendarConnection> => {
  console.log('Starting Airbnb calendar connection for property:', propertyId);
  
  // Use the provided supabase client or fall back to the default one
  const dbClient = customSupabase || supabase;
  
  try {
    // First check if connection already exists
    const { data: existingConnection, error: findError } = await dbClient
      .from('calendar_connections')
      .select('*')
      .eq('property_id', propertyId)
      .eq('source', 'airbnb')
      .single();
      
    if (findError && findError.code !== 'PGRST116') {
      // Error other than "not found"
      console.error('Error checking for existing connection:', findError);
      throw findError;
    }

    if (existingConnection) {
      console.log('Updating existing Airbnb connection:', existingConnection.id);
      // Update existing connection
      const { data, error } = await dbClient
        .from('calendar_connections')
        .update({
          ical_url: icalUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConnection.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating connection:', error);
        throw error;
      }
      return data;
    } else {
      console.log('Creating new Airbnb connection for property:', propertyId);
      // Create new connection
      const { data, error } = await dbClient
        .from('calendar_connections')
        .insert({
          property_id: propertyId,
          source: 'airbnb',
          ical_url: icalUrl,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating new connection:', error);
        throw error;
      }
      return data;
    }
  } catch (error) {
    console.error('Failed to add Airbnb calendar connection:', error);
    throw error;
  }
};

// Define an interface for iCal events to help with type safety
interface ICalEvent {
  summary?: string;
  start: Date;
  end: Date;
  [key: string]: any;
}

/**
 * Syncs calendar events from iCal to the database - SERVER SIDE ONLY
 */
export const syncCalendarEvents = async (
  connection: CalendarConnection, 
  customSupabase?: any
): Promise<{ added: number, updated: number, removed: number }> => {
  // Immediately return a placeholder result if in browser
  if (isBrowser) {
    console.warn('Calendar sync attempted in browser environment - this is a server-side only operation');
    return { added: 0, updated: 0, removed: 0 };
  }

  // Use the provided supabase client or fall back to the default one
  const dbClient = customSupabase || supabase;

  try {
    // Dynamically import node-ical only on the server
    const nodeIcal = await import('node-ical');
    
    // Track operation counts
    const result = { added: 0, updated: 0, removed: 0 };

    // Fetch the iCal feed
    const icalData = await fetchIcalFeed(connection.ical_url);
    
    // Parse the iCal data
    const parsedEvents = nodeIcal.parseICS(icalData);
    
    // Get existing events for this property/source
    const { data: existingEvents } = await dbClient
      .from('calendar_events')
      .select('*')
      .eq('property_id', connection.property_id)
      .eq('source', connection.source);
    
    // Create a map of existing events by external ID
    const existingEventsMap = new Map<string, CalendarEvent>();
    if (existingEvents) {
      existingEvents.forEach(event => {
        if (event.external_id) {
          existingEventsMap.set(event.external_id, event);
        }
      });
    }
    
    // Process each event from the iCal feed
    const eventsToUpsert: any[] = [];
    const processedIds = new Set<string>();
    
    for (const [uid, eventData] of Object.entries(parsedEvents)) {
      const event = eventData as ICalEvent;
      
      if (event.type === 'VEVENT' && event.start && event.end) {
        const externalId = uid || uuidv4();
        processedIds.add(externalId);
        
        const calendarEvent: any = {
          property_id: connection.property_id,
          source: connection.source,
          external_id: externalId,
          summary: event.summary || null,
          start_date: event.start.toISOString(),
          end_date: event.end.toISOString(),
          updated_at: new Date().toISOString()
        };
        
        if (existingEventsMap.has(externalId)) {
          // Update existing event
          calendarEvent.id = existingEventsMap.get(externalId)!.id;
          result.updated++;
        } else {
          // Add new event
          result.added++;
        }
        
        eventsToUpsert.push(calendarEvent);
      }
    }
    
    // Upsert events into the database
    if (eventsToUpsert.length > 0) {
      const { error, data: upsertedEvents } = await dbClient
        .from('calendar_events')
        .upsert(eventsToUpsert)
        .select();
      
      if (error) throw error;
      
      // Process the upserted events to create unavailable dates
      if (upsertedEvents && upsertedEvents.length > 0) {
        await processCalendarEventsToUnavailableDates(connection.property_id, upsertedEvents, dbClient);
      }
    }
    
    // Remove events that are no longer in the iCal feed
    const idsToRemove: string[] = [];
    existingEventsMap.forEach((event, externalId) => {
      if (!processedIds.has(externalId)) {
        idsToRemove.push(event.id);
        result.removed++;
      }
    });
    
    if (idsToRemove.length > 0) {
      // First, remove any associated unavailable dates
      await dbClient
        .from('unavailable_dates')
        .delete()
        .in('event_id', idsToRemove);
        
      // Then delete the calendar events
      const { error } = await dbClient
        .from('calendar_events')
        .delete()
        .in('id', idsToRemove);
      
      if (error) throw error;
    }
    
    // Update the last_synced timestamp
    await dbClient
      .from('calendar_connections')
      .update({ last_synced: new Date().toISOString() })
      .eq('id', connection.id);
    
    return result;
  } catch (error) {
    console.error('Error syncing calendar events:', error);
    throw error;
  }
};

/**
 * Processes calendar events into unavailable dates
 * This ensures that calendar events block dates in the customer-facing calendar
 */
export const processCalendarEventsToUnavailableDates = async (
  propertyId: string,
  events: CalendarEvent[],
  customSupabase?: any
): Promise<void> => {
  if (isBrowser) {
    console.warn('Calendar event processing attempted in browser - this is a server-side only operation');
    return;
  }

  const dbClient = customSupabase || supabase;
  
  try {
    // Process each event
    for (const event of events) {
      // First delete any existing unavailable dates for this event
      await dbClient
        .from('unavailable_dates')
        .delete()
        .eq('event_id', event.id);
        
      // Generate an array of dates between start and end date
      const startDate = new Date(event.start_date);
      const endDate = new Date(event.end_date);
      const unavailableDates = [];
      const currentDate = new Date(startDate);
      
      // Loop through all days in the range
      while (currentDate < endDate) {
        unavailableDates.push({
          property_id: propertyId,
          date: currentDate.toISOString().split('T')[0],
          reason: event.summary || `Calendar event from ${event.source}`,
          event_id: event.id
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Insert all the unavailable dates
      if (unavailableDates.length > 0) {
        const { error } = await dbClient
          .from('unavailable_dates')
          .upsert(unavailableDates, { onConflict: 'property_id,date' });
          
        if (error) {
          console.error('Error adding unavailable dates for event:', error);
        } else {
          console.log(`Blocked ${unavailableDates.length} dates for event ID ${event.id}`);
        }
      }
    }
  } catch (error) {
    console.error('Error processing calendar events to unavailable dates:', error);
    throw error;
  }
};

/**
 * Generate iCal feed for property's bookings and blocked dates - SERVER SIDE ONLY
 */
export const generatePropertyIcal = async (propertyId: string): Promise<string> => {
  // Immediately return an empty calendar if in browser
  if (isBrowser) {
    console.warn('Calendar generation attempted in browser - this is a server-side only operation');
    return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR';
  }

  try {
    // Fetch property details
    const { data: property } = await supabase
      .from('properties')
      .select('name')
      .eq('id', propertyId)
      .single();
    
    // Fetch bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', 'confirmed');
    
    // Fetch blocked dates
    const { data: blockedDates } = await supabase
      .from('unavailable_dates')
      .select('*')
      .eq('property_id', propertyId);
    
    // Fetch calendar events
    const { data: calendarEvents } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('property_id', propertyId);
    
    // Generate iCal content
    let icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MVP1//Property Calendar//EN',
      `X-WR-CALNAME:${property?.name || 'Property'} Calendar`
    ];
    
    // Add bookings to iCal
    if (bookings) {
      bookings.forEach(booking => {
        const startDate = new Date(booking.check_in);
        const endDate = new Date(booking.check_out);
        const uid = booking.id;
        
        icalContent = [
          ...icalContent,
          'BEGIN:VEVENT',
          `UID:booking-${uid}`,
          `SUMMARY:Booking: ${booking.guest_name}`,
          `DTSTART:${formatDate(startDate)}`,
          `DTEND:${formatDate(endDate)}`,
          `DESCRIPTION:Booking for ${booking.guest_name} (${booking.guest_email}).`,
          'STATUS:CONFIRMED',
          `CREATED:${formatDate(new Date(booking.created_at))}`,
          'END:VEVENT'
        ];
      });
    }
    
    // Add blocked dates to iCal
    if (blockedDates) {
      blockedDates.forEach(blockedDate => {
        const startDate = new Date(blockedDate.date);
        const endDate = new Date(blockedDate.date);
        endDate.setDate(endDate.getDate() + 1); // End date is exclusive in iCal
        
        icalContent = [
          ...icalContent,
          'BEGIN:VEVENT',
          `UID:blocked-${blockedDate.id}`,
          `SUMMARY:Not Available${blockedDate.reason ? ': ' + blockedDate.reason : ''}`,
          `DTSTART:${formatDate(startDate)}`,
          `DTEND:${formatDate(endDate)}`,
          'STATUS:CONFIRMED',
          'END:VEVENT'
        ];
      });
    }
    
    // Add calendar events to iCal
    if (calendarEvents) {
      calendarEvents.forEach(event => {
        const startDate = new Date(event.start_date);
        const endDate = new Date(event.end_date);
        // Add a day to end_date since iCal uses exclusive end dates
        endDate.setDate(endDate.getDate() + 1);
        
        icalContent = [
          ...icalContent,
          'BEGIN:VEVENT',
          `UID:event-${event.id}`,
          `SUMMARY:${event.summary || 'Calendar Event'}`,
          `DTSTART:${formatDate(startDate)}`,
          `DTEND:${formatDate(endDate)}`,
          `DESCRIPTION:Calendar event from ${event.source}`,
          'STATUS:CONFIRMED',
          `CREATED:${formatDate(new Date(event.created_at))}`,
          'END:VEVENT'
        ];
      });
    }
    
    // Close the calendar
    icalContent.push('END:VCALENDAR');
    
    // Join with CRLF as required by iCal spec
    return icalContent.join('\r\n');
  } catch (error) {
    console.error('Error generating iCal feed:', error);
    throw error;
  }
};

/**
 * Helper to format dates for iCal
 */
const formatDate = (date: Date): string => {
  return date.toISOString().replace(/-|:|\.\d+/g, '');
};

/**
 * Get the iCal export URL for a property
 */
export const getPropertyIcalUrl = (propertyId: string, baseUrl: string): string => {
  return `${baseUrl}/api/calendar/${propertyId}/export`;
};

/**
 * Sync all property calendars from external sources - SERVER SIDE ONLY
 */
export const syncAllCalendars = async (customSupabase?: any): Promise<void> => {
  // Exit early if in browser 
  if (isBrowser) {
    console.warn('Calendar sync attempted in browser - this is a server-side only operation');
    return;
  }

  // Use the provided supabase client or fall back to the default one
  const dbClient = customSupabase || supabase;

  try {
    // Get all calendar connections
    const { data: connections, error } = await dbClient
      .from('calendar_connections')
      .select('*');
    
    if (error) throw error;
    
    if (connections && connections.length > 0) {
      for (const connection of connections) {
        try {
          await syncCalendarEvents(connection, dbClient);
        } catch (syncError) {
          console.error(`Error syncing calendar for property ${connection.property_id}:`, syncError);
          // Continue with next connection even if one fails
        }
      }
    }
  } catch (error) {
    console.error('Error syncing all calendars:', error);
    throw error;
  }
};
