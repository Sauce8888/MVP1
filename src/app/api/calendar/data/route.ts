'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Enable this flag to bypass auth checks for development
const BYPASS_AUTH = true; // TODO: Set to false in production

// Create a server-side Supabase client using the request cookies
const createServerClient = (request: NextRequest) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  
  // When bypassing auth in development, use the service role key to bypass RLS
  if (BYPASS_AUTH) {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey) {
      console.error('⚠️ SUPABASE_SERVICE_ROLE_KEY is not set. Using admin RLS bypass approach instead.');
      
      // Alternative approach: Create client with anon key but add special headers
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
      return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          headers: {
            // Set a header that your RLS policies can check for admin access
            'x-admin-access': 'true'
          }
        }
      });
    }
    
    console.log('⚠️ Using service role key to bypass RLS');
    return createClient(supabaseUrl, supabaseServiceKey);
  }
  
  // For normal auth flow, use anon key with cookies
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  const cookieHeader = request.headers.get('cookie') || '';
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    },
    global: {
      headers: {
        cookie: cookieHeader
      }
    }
  });
};

export async function GET(request: NextRequest) {
  try {
    // Create a Supabase client that uses cookies from the request headers
    const supabase = createServerClient(request);
    
    // Get property ID from query parameter
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    
    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }
    
    // Fetch calendar connections for this property
    const { data: connections, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('property_id', propertyId)
      .order('source');
      
    if (connectionError) {
      console.error('Error fetching calendar connections:', connectionError);
      throw connectionError;
    }
    
    // Fetch calendar events for this property
    const { data: events, error: eventError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('property_id', propertyId)
      .order('start_date', { ascending: true });
      
    if (eventError) {
      console.error('Error fetching calendar events:', eventError);
      throw eventError;
    }
    
    // Fetch unavailable dates for this property
    const { data: unavailableDates, error: dateError } = await supabase
      .from('unavailable_dates')
      .select('*')
      .eq('property_id', propertyId);
      
    if (dateError) {
      console.error('Error fetching unavailable dates:', dateError);
      throw dateError;
    }
    
    return NextResponse.json({
      connections: connections || [],
      events: events || [],
      unavailableDates: unavailableDates || []
    });
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar data' },
      { status: 500 }
    );
  }
} 