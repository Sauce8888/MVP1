import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

// Initialize Stripe with secret key (in test mode)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Define the test property ID as a constant
const TEST_PROPERTY_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_HOST_ID = '456e6789-e89b-12d3-a456-426614174001';

// Export a new GET route to connect the test property to the authenticated user
export async function GET(request: NextRequest) {
  try {
    // Get the user's session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'You must be signed in to connect a test property' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    // First check if the test property exists
    const { data: existingProperty, error: propertyCheckError } = await supabase
      .from('properties')
      .select('id, host_id')
      .eq('id', TEST_PROPERTY_ID)
      .single();
      
    if (propertyCheckError && propertyCheckError.code !== 'PGRST116') {
      // Error other than "not found"
      return NextResponse.json(
        { error: 'Error checking for test property', details: propertyCheckError.message },
        { status: 500 }
      );
    }
    
    if (!existingProperty) {
      // Test property doesn't exist yet, create it with the user's ID
      // First, check if the user already exists as a host
      const { data: hostData, error: hostCheckError } = await supabase
        .from('hosts')
        .select('id')
        .eq('id', userId)
        .single();
        
      if (hostCheckError && hostCheckError.code !== 'PGRST116') {
        return NextResponse.json(
          { error: 'Error checking host record', details: hostCheckError.message },
          { status: 500 }
        );
      }
      
      // If the user doesn't have a host record, create one
      if (!hostData) {
        const { error: createHostError } = await supabase
          .from('hosts')
          .insert({
            id: userId,
            email: session.user.email,
            name: session.user.email?.split('@')[0] || 'Host',
            created_at: new Date().toISOString(),
            google_calendar_connected: false
          });
          
        if (createHostError) {
          return NextResponse.json(
            { error: 'Failed to create host record', details: createHostError.message },
            { status: 500 }
          );
        }
      }
      
      // Create the test property with the user's ID
      const { error: createPropertyError } = await supabase
        .from('properties')
        .insert({
          id: TEST_PROPERTY_ID,
          host_id: userId,
          name: 'Beach House Retreat',
          description: 'A beautiful beach house with stunning ocean views.',
          address: '123 Oceanview Drive, Seaside Town',
          base_rate: 150,
          weekend_rate: 180,
          min_stay: 2,
          created_at: new Date().toISOString()
        });
        
      if (createPropertyError) {
        return NextResponse.json(
          { error: 'Failed to create test property', details: createPropertyError.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Test property created and connected to your account'
      });
    } else {
      // Property exists, update it to be owned by this user
      const { error: updateError } = await supabase
        .from('properties')
        .update({ host_id: userId })
        .eq('id', TEST_PROPERTY_ID);
        
      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update test property', details: updateError.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Test property connected to your account'
      });
    }
  } catch (error) {
    console.error('Error connecting test property:', error);
    return NextResponse.json(
      { error: 'Server error connecting test property' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('Booking API called');
  
  try {
    const bookingData = await request.json();
    console.log('Booking data received:', bookingData);
    
    // Validate booking data
    if (!bookingData.property_id || !bookingData.guest_name || !bookingData.guest_email ||
        !bookingData.check_in || !bookingData.check_out || !bookingData.guests_count) {
      return NextResponse.json(
        { error: 'Missing required booking information' },
        { status: 400 }
      );
    }
    
    // Development mode handling for test property
    if (process.env.NODE_ENV === 'development' && bookingData.property_id === TEST_PROPERTY_ID) {
      console.log('Development mode with test property ID');
      
      // First, ensure the test property exists in the database
      const { data: existingProperty, error: propertyCheckError } = await supabase
        .from('properties')
        .select('id')
        .eq('id', TEST_PROPERTY_ID)
        .single();
        
      if (propertyCheckError || !existingProperty) {
        console.log('Test property not found, creating it in database');
        
        // Check if test host exists and create if needed
        const { data: existingHost, error: hostCheckError } = await supabase
          .from('hosts')
          .select('id')
          .eq('id', TEST_HOST_ID)
          .single();
          
        if (hostCheckError || !existingHost) {
          console.log('Test host not found, creating it in database');
          // Create the test host
          const { error: hostCreateError } = await supabase
            .from('hosts')
            .insert({
              id: TEST_HOST_ID,
              email: 'test@example.com',
              name: 'Test Host',
              created_at: new Date().toISOString(),
              google_calendar_connected: false
            });
            
          if (hostCreateError) {
            console.error('Error creating test host:', hostCreateError);
            return NextResponse.json(
              { error: 'Failed to create test host', details: hostCreateError.message },
              { status: 500 }
            );
          }
        }
        
        // Create the test property
        const { error: propertyCreateError } = await supabase
          .from('properties')
          .insert({
            id: TEST_PROPERTY_ID,
            host_id: TEST_HOST_ID,
            name: 'Beach House Retreat',
            description: 'A beautiful beach house with stunning ocean views.',
            address: '123 Oceanview Drive, Seaside Town',
            base_rate: 150,
            weekend_rate: 180,
            min_stay: 2,
            created_at: new Date().toISOString()
          });
          
        if (propertyCreateError) {
          console.error('Error creating test property:', propertyCreateError);
          return NextResponse.json(
            { error: 'Failed to create test property', details: propertyCreateError.message },
            { status: 500 }
          );
        }
        
        console.log('Successfully created test property and host in database');
      }
      
      // Calculate total price based on nights
      const checkIn = new Date(bookingData.check_in);
      const checkOut = new Date(bookingData.check_out);
      
      // Generate an array of dates for the stay
      const dates: string[] = [];
      const currentDate = new Date(checkIn);
      
      while (currentDate < checkOut) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Calculate total price accounting for weekend rates (same formula for all bookings)
      let totalPrice = 0;
      for (const dateStr of dates) {
        const date = new Date(dateStr);
        const day = date.getDay();
        const isWeekend = day === 5 || day === 6; // Friday or Saturday
        
        // Use weekend rate for Friday/Saturday, otherwise base rate
        totalPrice += isWeekend ? 180 : 150;
      }
      
      const nights = dates.length;
      console.log(`Booking is for ${nights} night${nights !== 1 ? 's' : ''}`);
      console.log(`Total price: ${totalPrice} EUR`);
      
      // Create a real Stripe payment intent (in test mode)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalPrice * 100, // Convert to cents
        currency: 'eur',
        metadata: {
          property_id: bookingData.property_id,
          guest_name: bookingData.guest_name,
          guest_email: bookingData.guest_email,
          check_in: bookingData.check_in,
          check_out: bookingData.check_out,
          is_test_property: 'true',
          nights: dates.length.toString()
        },
      });
      
      // Generate proper UUID instead of custom string
      const bookingId = uuidv4();
      console.log('Generated UUID for booking:', bookingId);
      
      // Create an actual booking record in the database, matching the schema
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          id: bookingId,
          property_id: bookingData.property_id,
          guest_name: bookingData.guest_name,
          guest_email: bookingData.guest_email,
          guest_phone: bookingData.guest_phone,
          check_in: bookingData.check_in,
          check_out: bookingData.check_out,
          guests_count: bookingData.guests_count,
          special_requests: bookingData.special_requests,
          status: 'confirmed', // Auto-confirm test property bookings
          payment_id: paymentIntent.id
          // Removed currency field as it doesn't exist in schema
        })
        .select()
        .single();
        
      if (bookingError) {
        console.error('Error creating booking:', bookingError);
        return NextResponse.json(
          { error: 'Failed to create booking', details: bookingError.message },
          { status: 500 }
        );
      }
      
      console.log('Created booking:', booking.id);
      
      // Block calendar dates for test property
      const unavailableDates = [];
      const blockDate = new Date(checkIn);
      
      while (blockDate < checkOut) {
        unavailableDates.push({
          property_id: bookingData.property_id,
          date: blockDate.toISOString().split('T')[0],
          reason: `Booking #${booking.id}`,
          booking_id: booking.id
        });
        blockDate.setDate(blockDate.getDate() + 1);
      }
      
      if (unavailableDates.length > 0) {
        const { error: datesError } = await supabase
          .from('unavailable_dates')
          .upsert(unavailableDates, { onConflict: 'property_id,date' });
          
        if (datesError) {
          console.error('Error blocking calendar dates:', datesError);
        } else {
          console.log(`Blocked ${unavailableDates.length} dates for booking ${booking.id}`);
        }
      }
      
      // Return success with real client secret for payment
      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        bookingId: booking.id,
        amount: totalPrice,
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      });
    }
    
    // ---- Real properties (non-test) processing ----
    // Get the property and host details
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('*, hosts(stripe_account_id, stripe_publishable_key, email)')
      .eq('id', bookingData.property_id)
      .single();
    
    console.log('Property query result:', { property, propertyError });
    
    if (propertyError || !property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }
    
    // Get custom pricing if any for these dates
    const checkIn = new Date(bookingData.check_in);
    const checkOut = new Date(bookingData.check_out);
    
    // Generate an array of dates for the stay
    const dates: string[] = [];
    const currentDate = new Date(checkIn);
    
    while (currentDate < checkOut) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Get custom pricing for these dates
    const { data: customPricing } = await supabase
      .from('custom_pricing')
      .select('*')
      .eq('property_id', bookingData.property_id)
      .in('date', dates);
    
    // Calculate total price
    let totalPrice = 0;
    for (const date of dates) {
      const dateObj = new Date(date);
      const day = dateObj.getDay();
      const isWeekend = day === 5 || day === 6; // Friday or Saturday
      
      // Check if there's custom pricing for this date
      const customPrice = customPricing?.find(pricing => pricing.date === date);
      
      if (customPrice) {
        totalPrice += customPrice.price;
      } else {
        // Use weekend rate if available and it's a weekend, otherwise base rate
        totalPrice += isWeekend && property.weekend_rate 
          ? property.weekend_rate 
          : property.base_rate;
      }
    }
    
    // Check for a connected Stripe account
    if (!property.hosts.stripe_account_id || !property.hosts.stripe_publishable_key) {
      return NextResponse.json(
        { error: 'Payment processing is not set up for this property' },
        { status: 400 }
      );
    }
    
    // Create a Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalPrice * 100), // Stripe uses cents
      currency: 'eur',
      // Transfer to the host's Stripe account
      transfer_data: {
        destination: property.hosts.stripe_account_id,
      },
      metadata: {
        property_id: property.id,
        host_id: property.host_id,
        guest_name: bookingData.guest_name,
        guest_email: bookingData.guest_email,
        check_in: bookingData.check_in,
        check_out: bookingData.check_out,
      },
    });
    
    // Create the booking with initial status (will be updated when payment completes)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        property_id: bookingData.property_id,
        guest_name: bookingData.guest_name,
        guest_email: bookingData.guest_email,
        guest_phone: bookingData.guest_phone,
        check_in: bookingData.check_in,
        check_out: bookingData.check_out,
        guests_count: bookingData.guests_count,
        special_requests: bookingData.special_requests,
        status: 'pending', // Will be updated after payment
        payment_id: paymentIntent.id,
      })
      .select()
      .single();
    
    if (bookingError) {
      // If booking creation fails, cancel the payment intent
      await stripe.paymentIntents.cancel(paymentIntent.id);
      
      return NextResponse.json(
        { error: 'Failed to create booking', details: bookingError.message },
        { status: 500 }
      );
    }
    
    // Return success with client secret for payment
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      bookingId: booking.id,
      amount: totalPrice,
      publishableKey: property.hosts.stripe_publishable_key
    });
    
  } catch (error) {
    console.error('Booking creation error:', error);
    return NextResponse.json(
      { error: 'Server error processing booking' },
      { status: 500 }
    );
  }
} 