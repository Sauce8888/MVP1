'use server';

import { NextRequest, NextResponse } from 'next/server';
import { addAirbnbCalendarConnection, syncCalendarEvents } from '@/lib/ical-utils';
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

export async function POST(request: NextRequest) {
  try {
    // Create a Supabase client that uses cookies from the request headers
    const supabase = createServerClient(request);
    
    // Get authenticated user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    console.log('Session check result:', { 
      hasSession: !!session, 
      userId: session?.user?.id,
      sessionError,
      cookieHeader: request.headers.get('cookie')?.substring(0, 50) + '...' // Log a partial cookie for debugging
    });
    
    // Use the bypass option during development if enabled
    let userId: string;
    
    if (BYPASS_AUTH) {
      // If bypassing auth, use a known test ID or fetch first host
      const { data: firstHost } = await supabase
        .from('hosts')
        .select('id')
        .limit(1)
        .single();
        
      userId = firstHost?.id || '00000000-0000-0000-0000-000000000000';
      console.log('⚠️ BYPASSING AUTH - Using host ID:', userId);
    } else {
      // Normal authentication flow
      if (sessionError || !session) {
        console.error('Authentication error:', sessionError);
        return NextResponse.json(
          { error: 'You must be signed in to import calendar' },
          { status: 401 }
        );
      }
      
      userId = session.user.id;
    }
    
    // Parse request body
    const body = await request.json();
    const { propertyId, source, icalUrl } = body;

    // Validate request
    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    if (!icalUrl) {
      return NextResponse.json(
        { error: 'iCal URL is required' },
        { status: 400 }
      );
    }

    if (source !== 'airbnb' && source !== 'other') {
      return NextResponse.json(
        { error: 'Source must be "airbnb" or "other"' },
        { status: 400 }
      );
    }

    // Verify property exists and belongs to authenticated user (skip host_id check if bypassing auth)
    let propertyQuery = supabase
      .from('properties')
      .select('id, host_id')
      .eq('id', propertyId);
      
    if (!BYPASS_AUTH) {
      propertyQuery = propertyQuery.eq('host_id', userId);
    }
    
    const { data: property, error } = await propertyQuery.single();

    if (error || !property) {
      console.error('Property verification error:', error);
      return NextResponse.json(
        { error: 'Property not found or not owned by you' },
        { status: 404 }
      );
    }

    // Add calendar connection using the server supabase client
    let connection;
    try {
      // Use our wrapper function with the authenticated client
      connection = await addAirbnbCalendarConnection(propertyId, icalUrl, supabase);
    } catch (insertError) {
      console.error('Error creating calendar connection:', insertError);
      return NextResponse.json(
        { error: 'Failed to create calendar connection', details: insertError instanceof Error ? insertError.message : 'Unknown error' },
        { status: 500 }
      );
    }

    // Sync calendar events with the server supabase client 
    try {
      const syncResult = await syncCalendarEvents(connection, supabase);
      
      return NextResponse.json({
        success: true,
        connection,
        syncResult
      });
    } catch (syncError) {
      console.error('Error syncing calendar:', syncError);
      // We still return success for the connection, but note the sync error
      return NextResponse.json({
        success: true,
        connection,
        syncError: syncError instanceof Error ? syncError.message : 'Failed to sync calendar events'
      });
    }
  } catch (error) {
    console.error('Error importing calendar:', error);
    let errorMsg = 'Failed to import calendar';
    if (error instanceof Error) {
      errorMsg = error.message;
    }
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
} 