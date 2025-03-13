import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      propertyId, 
      hostStripeKey, // We'll still receive this but not use it for the Stripe instance
      checkIn, 
      checkOut, 
      guestName, 
      guestEmail,
      guestPhone,
      guestCount,
      specialRequests,
      totalAmount 
    } = body;
    
    if (!propertyId || !checkIn || !checkOut || !guestName || !guestEmail || !totalAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create a new Stripe instance with the app's secret key instead of the host's key
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { 
      apiVersion: '2025-02-24.acacia',
      typescript: true 
    });
    
    // Store the booking in the database with pending status
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        property_id: propertyId,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone || null,
        check_in: checkIn,
        check_out: checkOut,
        guests_count: guestCount,
        special_requests: specialRequests || null,
        status: 'pending'
      })
      .select()
      .single();
      
    if (bookingError) {
      console.error('Error creating booking:', bookingError);
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
    }
    
    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Property Booking',
              description: `${checkIn} to ${checkOut}`,
            },
            unit_amount: Math.round(totalAmount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/booking/success?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/widget/${propertyId}`,
      customer_email: guestEmail,
      metadata: {
        booking_id: booking.id,
        property_id: propertyId
      },
    });
    
    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ 
      error: 'Failed to create checkout session',
      details: error.message 
    }, { status: 500 });
  }
} 