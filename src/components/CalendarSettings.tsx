import { useState, useEffect } from 'react';
import { CalendarConnection, CalendarEvent } from '@/lib/types';
import { supabase } from '@/lib/supabase';

type CalendarSettingsProps = {
  propertyId: string;
};

const CalendarSettings = ({ propertyId }: CalendarSettingsProps) => {
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [airbnbUrl, setAirbnbUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [eventLoading, setEventLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [processLoading, setProcessLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'sync' | 'manual'>('sync');
  
  // New form state for manual events
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [eventSummary, setEventSummary] = useState('');
  const [eventSource, setEventSource] = useState<'airbnb' | 'other'>('other');
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  
  // Get export URL without direct dependency on the server-side function
  const exportUrl = `${window.location.origin}/api/calendar/${propertyId}/export`;
  
  // Fetch existing connections and events
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch calendar connections
      const { data: connectionData, error: connectionError } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('property_id', propertyId)
        .order('source');
      
      if (connectionError) throw connectionError;
      setConnections(connectionData || []);
      
      // If there's an Airbnb connection, set the URL
      const airbnbConnection = connectionData?.find(conn => conn.source === 'airbnb');
      if (airbnbConnection) {
        setAirbnbUrl(airbnbConnection.ical_url);
      }
      
      // Fetch calendar events
      const { data: eventData, error: eventError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('property_id', propertyId)
        .order('start_date', { ascending: true });
        
      if (eventError) throw eventError;
      setCalendarEvents(eventData || []);
      
    } catch (err) {
      setError('Failed to load calendar data');
      if (err instanceof Error) {
        console.error('Error fetching calendar data:', err.message);
      } else {
        console.error('Unknown error fetching calendar data');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Call fetchData on component mount
  useEffect(() => {
    fetchData();
  }, [propertyId]);
  
  // Force refresh data from server bypassing RLS
  const handleForceRefresh = async () => {
    try {
      setRefreshLoading(true);
      setError(null);
      setSuccess(null);
      
      // Call the server to get data directly
      const response = await fetch(`/api/calendar/data?propertyId=${propertyId}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to refresh calendar data');
      }
      
      const result = await response.json();
      
      // Update connections and events with data from server
      setConnections(result.connections || []);
      setCalendarEvents(result.events || []);
      
      // If there's an Airbnb connection, set the URL
      const airbnbConnection = result.connections?.find((conn: CalendarConnection) => conn.source === 'airbnb');
      if (airbnbConnection) {
        setAirbnbUrl(airbnbConnection.ical_url);
      }
      
      setSuccess('Calendar data refreshed successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh calendar data');
      console.error('Refresh error:', err);
    } finally {
      setRefreshLoading(false);
    }
  };
  
  // Import Airbnb calendar
  const handleImportAirbnb = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!airbnbUrl.trim()) {
      setError('Please enter a valid iCal URL');
      return;
    }
    
    try {
      setImportLoading(true);
      setError(null);
      setSuccess(null);
      
      // Ensure the session is fresh
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('Authentication error:', sessionError);
        setError('You must be signed in to import calendar. Please refresh the page and try again.');
        return;
      }
      
      // Log cookies to help debug
      console.log('Cookies in document:', document.cookie);
      
      // Proceed with the API call with credentials included
      const response = await fetch('/api/calendar/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId,
          source: 'airbnb',
          icalUrl: airbnbUrl
        }),
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to import calendar');
      }
      
      // Update connections list
      const { data, error } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('property_id', propertyId)
        .order('source');
      
      if (error) throw error;
      
      setConnections(data || []);
      
      // Refresh calendar events
      const { data: eventData, error: eventError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('property_id', propertyId)
        .order('start_date', { ascending: true });
        
      if (eventError) throw eventError;
      setCalendarEvents(eventData || []);
      
      setSuccess(`Successfully imported Airbnb calendar with ${result.syncResult.added} events`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import calendar');
      if (err instanceof Error) {
        console.error('Import error:', err.message);
      } else {
        console.error('Unknown import error');
      }
    } finally {
      setImportLoading(false);
    }
  };
  
  // Manually sync calendars
  const handleSyncCalendars = async () => {
    try {
      setSyncLoading(true);
      setError(null);
      setSuccess(null);
      
      // Ensure the session is fresh
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('Authentication error:', sessionError);
        setError('You must be signed in to sync calendars. Please refresh the page and try again.');
        return;
      }
      
      // Log cookies to help debug
      console.log('Cookies in document for sync:', document.cookie);
      
      const response = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId,
        }),
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync calendars');
      }
      
      // Update connections list to get the latest sync time
      const { data, error } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('property_id', propertyId)
        .order('source');
      
      if (error) throw error;
      
      setConnections(data || []);
      
      // Refresh calendar events
      const { data: eventData, error: eventError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('property_id', propertyId)
        .order('start_date', { ascending: true });
        
      if (eventError) throw eventError;
      setCalendarEvents(eventData || []);
      
      // Build success message
      let summaryMsg = 'Calendar sync complete: ';
      const summaryParts = result.results.map((res: any) => {
        if (res.error) return `${res.source} failed`;
        return `${res.source} (${res.result.added} added, ${res.result.updated} updated, ${res.result.removed} removed)`;
      });
      
      setSuccess(summaryMsg + summaryParts.join(', '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync calendars');
      if (err instanceof Error) {
        console.error('Sync error:', err.message);
      } else {
        console.error('Unknown sync error');
      }
    } finally {
      setSyncLoading(false);
    }
  };
  
  // Copy export URL to clipboard
  const handleCopyExportUrl = () => {
    navigator.clipboard.writeText(exportUrl)
      .then(() => {
        setSuccess('Export URL copied to clipboard');
        setTimeout(() => setSuccess(null), 3000);
      })
      .catch((err) => {
        setError('Failed to copy URL');
        console.error('Clipboard error:', err);
      });
  };
  
  // Handle creating or updating a manual calendar event
  const handleManualEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submitted!');
    console.log('Start date:', eventStartDate);
    console.log('End date:', eventEndDate);
    console.log('Summary:', eventSummary);
    console.log('Source:', eventSource);
    
    // Validate form
    if (!eventStartDate || !eventEndDate || !eventSummary) {
      setError('Please fill in all required fields');
      console.log('Validation failed: missing required fields');
      return;
    }
    
    if (new Date(eventEndDate) < new Date(eventStartDate)) {
      setError('End date cannot be before start date');
      console.log('Validation failed: end date before start date');
      return;
    }
    
    try {
      setEventLoading(true);
      setError(null);
      setSuccess(null);
      
      const eventData = {
        property_id: propertyId,
        source: eventSource,
        summary: eventSummary,
        start_date: eventStartDate,
        end_date: eventEndDate,
        external_id: null
      };
      
      console.log('Event data to save:', eventData);
      
      let eventId;
      
      if (isEditingEvent && editingEventId) {
        // Update existing event
        console.log('Updating existing event with ID:', editingEventId);
        const { error: updateError } = await supabase
          .from('calendar_events')
          .update(eventData)
          .eq('id', editingEventId);
          
        if (updateError) {
          console.error('Supabase update error:', updateError);
          throw updateError;
        }
        eventId = editingEventId;
        setSuccess('Calendar event updated successfully');
      } else {
        // Insert new event
        console.log('Inserting new event');
        const { data, error: insertError } = await supabase
          .from('calendar_events')
          .insert(eventData)
          .select();
          
        if (insertError) {
          console.error('Supabase insert error:', insertError);
          console.error('Error details:', JSON.stringify(insertError, null, 2));
          throw insertError;
        }
        
        console.log('Inserted event data:', data);
        console.log('Inserted event count:', data ? data.length : 0);
        
        if (!data || data.length === 0) {
          console.warn('No data returned after insert - this may indicate a policy issue');
        } else {
          eventId = data[0].id;
        }
        
        setSuccess('Calendar event created successfully');
      }
      
      // Now add or update corresponding unavailable_dates
      // Generate an array of dates between start and end date
      const startDate = new Date(eventStartDate);
      const endDate = new Date(eventEndDate);
      const unavailableDates = [];
      const currentDate = new Date(startDate);
      
      // Loop through all days in the range
      while (currentDate < endDate) {
        unavailableDates.push({
          property_id: propertyId,
          date: currentDate.toISOString().split('T')[0],
          reason: eventSummary,
          event_id: eventId
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // If we're editing, first delete old unavailable dates linked to this event
      if (isEditingEvent && editingEventId) {
        await supabase
          .from('unavailable_dates')
          .delete()
          .eq('event_id', editingEventId);
      }
      
      // Insert all the unavailable dates
      if (unavailableDates.length > 0) {
        const { error: datesError } = await supabase
          .from('unavailable_dates')
          .upsert(unavailableDates, { onConflict: 'property_id,date' });
          
        if (datesError) {
          console.error('Error adding unavailable dates:', datesError);
          setError('Event created but failed to block dates in calendar');
        } else {
          console.log(`Blocked ${unavailableDates.length} dates for event`);
          setSuccess('Calendar event created and dates blocked successfully');
        }
      }
      
      // Reset form
      setEventStartDate('');
      setEventEndDate('');
      setEventSummary('');
      setEventSource('other');
      setIsEditingEvent(false);
      setEditingEventId(null);
      
      // Refresh calendar events
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('property_id', propertyId)
        .order('start_date', { ascending: true });
        
      if (error) throw error;
      setCalendarEvents(data || []);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save calendar event');
      console.error('Event save error:', err);
    } finally {
      setEventLoading(false);
    }
  };
  
  // Edit an existing event
  const handleEditEvent = (event: CalendarEvent) => {
    // Format dates for the date input fields (YYYY-MM-DD format)
    const formatDateForInput = (dateString: string) => {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    };
    
    setEventStartDate(formatDateForInput(event.start_date));
    setEventEndDate(formatDateForInput(event.end_date));
    setEventSummary(event.summary || '');
    setEventSource(event.source as 'airbnb' | 'other');
    setIsEditingEvent(true);
    setEditingEventId(event.id);
  };
  
  // Delete an event
  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return;
    }
    
    try {
      setError(null);
      
      // First delete any associated unavailable dates
      const { error: unavailableDatesError } = await supabase
        .from('unavailable_dates')
        .delete()
        .eq('event_id', eventId);
        
      if (unavailableDatesError) {
        console.error('Error deleting unavailable dates:', unavailableDatesError);
      }
      
      // Then delete the calendar event
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId);
        
      if (error) throw error;
      
      // Update local state
      setCalendarEvents(calendarEvents.filter(event => event.id !== eventId));
      setSuccess('Event deleted successfully');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
      console.error('Delete error:', err);
    }
  };
  
  // Process calendar events into unavailable dates
  const handleProcessEvents = async () => {
    try {
      setProcessLoading(true);
      setError(null);
      setSuccess(null);
      
      // Call the process API
      const response = await fetch('/api/calendar/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId,
          source: 'airbnb'  // Focus on Airbnb events
        }),
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to process calendar events');
      }
      
      setSuccess(`Successfully processed calendar events: ${result.message}`);
      
      // Refresh the data
      await fetchData();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process calendar events');
      console.error('Process error:', err);
    } finally {
      setProcessLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Calendar Settings</h2>
        <div className="flex space-x-2">
          <button 
            onClick={() => setActiveTab('sync')}
            className={`py-1 px-3 text-sm rounded ${activeTab === 'sync' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}
            aria-current={activeTab === 'sync' ? 'page' : undefined}
          >
            Sync Settings
          </button>
          <button 
            onClick={() => setActiveTab('manual')}
            className={`py-1 px-3 text-sm rounded ${activeTab === 'manual' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}
            aria-current={activeTab === 'manual' ? 'page' : undefined}
          >
            Manual Events
          </button>
        </div>
      </div>
      
      {error && (
        <div className="p-4 text-sm rounded-md bg-red-50 text-red-600 border border-red-200">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 text-sm rounded-md bg-green-50 text-green-600 border border-green-200">
          {success}
        </div>
      )}
      
      <div className="flex justify-end">
        <button 
          onClick={handleForceRefresh}
          disabled={refreshLoading}
          className="px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-purple-300"
          aria-label="Force refresh calendar data"
          tabIndex={0}
        >
          {refreshLoading ? 'Refreshing...' : 'Force Refresh Data'}
        </button>
      </div>
      
      {activeTab === 'sync' && (
        <>
          <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
            <h3 className="text-md font-medium text-blue-800 mb-2">How to use calendar sync</h3>
            <ol className="list-decimal pl-5 text-sm text-blue-700 space-y-1">
              <li>Import your Airbnb calendar using the iCal URL from your Airbnb host dashboard</li>
              <li>Copy your property's export URL and import it to your Airbnb calendar</li>
              <li>Each time a booking is made on our platform, you'll need to manually refresh the calendar on Airbnb</li>
              <li>You can also manually sync here to import new bookings from Airbnb</li>
            </ol>
          </div>
          
          {/* Import Calendar Section */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-4">Import Airbnb Calendar</h3>
            <form onSubmit={handleImportAirbnb} className="space-y-3">
              <div>
                <label htmlFor="airbnb-url" className="block text-sm font-medium text-gray-700 mb-1">
                  Airbnb iCal URL
                </label>
                <input
                  id="airbnb-url"
                  type="text"
                  value={airbnbUrl}
                  onChange={(e) => setAirbnbUrl(e.target.value)}
                  placeholder="webcal://www.airbnb.com/calendar/ical/XXXXX.ics"
                  className="border rounded-md w-full px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  Find this in your Airbnb host dashboard under Calendar → Availability settings → Export Calendar
                </p>
              </div>
              
              <button
                type="submit"
                disabled={importLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-300"
              >
                {importLoading ? 'Importing...' : 'Import Calendar'}
              </button>
            </form>
          </div>
          
          {/* Export Calendar Section */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-4">Your Calendar Export URL</h3>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={exportUrl}
                readOnly
                className="border rounded-md flex-1 px-3 py-2 text-gray-700 bg-gray-50"
              />
              <button
                onClick={handleCopyExportUrl}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                aria-label="Copy export URL"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCopyExportUrl();
                  }
                }}
              >
                Copy
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Import this URL in your Airbnb calendar to sync bookings from our platform
            </p>
          </div>
          
          {/* Process Calendar Events Section - NEW */}
          <div className="border rounded-lg p-4 mt-6">
            <h3 className="font-medium mb-4">Process Calendar Events</h3>
            <p className="text-sm text-gray-600 mb-4">
              If calendar events were imported but dates are not showing as unavailable on the customer calendar, 
              use this button to convert the events into unavailable dates.
            </p>
            
            <button
              onClick={handleProcessEvents}
              disabled={processLoading || calendarEvents.length === 0}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:bg-orange-300"
            >
              {processLoading ? 'Processing...' : 'Process Calendar Events to Unavailable Dates'}
            </button>
            
            <p className="mt-2 text-xs text-gray-500">
              You have {calendarEvents.filter(e => e.source === 'airbnb').length} Airbnb calendar events that can be processed.
            </p>
          </div>
          
          {/* Connected Calendars */}
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Connected Calendars</h3>
              <button
                onClick={handleSyncCalendars}
                disabled={syncLoading || connections.length === 0}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-green-300"
                aria-label="Sync calendars"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!syncLoading && connections.length > 0) {
                      handleSyncCalendars();
                    }
                  }
                }}
              >
                {syncLoading ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
            
            {loading ? (
              <p className="text-gray-500 text-sm">Loading connections...</p>
            ) : connections.length === 0 ? (
              <p className="text-gray-500 text-sm">No calendar connections yet</p>
            ) : (
              <div className="space-y-2">
                {connections.map((conn) => (
                  <div key={conn.id} className="p-3 bg-gray-50 rounded-md">
                    <div className="flex justify-between">
                      <div>
                        <span className="font-medium capitalize">{conn.source}</span>
                        <p className="text-xs text-gray-500 mt-1 truncate">{conn.ical_url}</p>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        {conn.last_synced ? (
                          <>Last synced: {new Date(conn.last_synced).toLocaleString()}</>
                        ) : (
                          <>Never synced</>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      
      {activeTab === 'manual' && (
        <>
          {/* Add/Edit Manual Event Form */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-4">
              {isEditingEvent ? 'Edit Calendar Event' : 'Add Manual Calendar Event'}
            </h3>
            <form onSubmit={handleManualEvent} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="event-start" className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    id="event-start"
                    type="date"
                    value={eventStartDate}
                    onChange={(e) => setEventStartDate(e.target.value)}
                    className="border rounded-md w-full px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="event-end" className="block text-sm font-medium text-gray-700 mb-1">
                    End Date *
                  </label>
                  <input
                    id="event-end"
                    type="date"
                    value={eventEndDate}
                    onChange={(e) => setEventEndDate(e.target.value)}
                    className="border rounded-md w-full px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="event-summary" className="block text-sm font-medium text-gray-700 mb-1">
                  Event Description *
                </label>
                <input
                  id="event-summary"
                  type="text"
                  value={eventSummary}
                  onChange={(e) => setEventSummary(e.target.value)}
                  placeholder="e.g., Blocked for maintenance, Personal use"
                  className="border rounded-md w-full px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="event-source" className="block text-sm font-medium text-gray-700 mb-1">
                  Event Source
                </label>
                <select
                  id="event-source"
                  value={eventSource}
                  onChange={(e) => setEventSource(e.target.value as 'airbnb' | 'other')}
                  className="border rounded-md w-full px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="other">Manual Entry</option>
                  <option value="airbnb">Airbnb</option>
                </select>
              </div>
              
              <div className="flex space-x-2">
                <button
                  type="submit"
                  disabled={eventLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300"
                >
                  {eventLoading ? 'Saving...' : isEditingEvent ? 'Update Event' : 'Add Event'}
                </button>
                
                {isEditingEvent && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingEvent(false);
                      setEditingEventId(null);
                      setEventStartDate('');
                      setEventEndDate('');
                      setEventSummary('');
                      setEventSource('other');
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
          
          {/* Calendar Events List */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-4">Calendar Events</h3>
            
            {loading ? (
              <p className="text-gray-500 text-sm">Loading events...</p>
            ) : calendarEvents.length === 0 ? (
              <p className="text-gray-500 text-sm">No calendar events yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date Range
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Source
                      </th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {calendarEvents.map((event) => (
                      <tr key={event.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {event.summary || 'No description'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 capitalize">
                          {event.source}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          <button
                            onClick={() => handleEditEvent(event)}
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                            aria-label={`Edit event ${event.summary || ''}`}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="text-red-600 hover:text-red-900"
                            aria-label={`Delete event ${event.summary || ''}`}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CalendarSettings; 