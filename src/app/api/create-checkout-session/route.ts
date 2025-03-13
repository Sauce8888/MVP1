import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      propertyId,
      checkIn,
      checkOut,
      guestName,
      guestEmail,
      guestPhone,
      guestCount,
      specialRequests,
      totalAmount
    } = body;
    
    // Validate required fields
    if (!propertyId || !checkIn || !checkOut || !guestName || !guestEmail || !totalAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Fetch property details with host info
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select(`
        *,
        host:host_id (
          id,
          email,
          name,
          stripe_publishable_key
        )
      `)
      .eq('id', propertyId)
      .single();
    
    if (propertyError || !property) {
      console.error('Property fetch error:', propertyError);
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }
    
    // Use our application's secret key from environment variables
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY as string;
    
    // Initialize Stripe with the app's secret key
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia'
    });
    
    // Create booking record in pending state
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
      console.error('Booking creation error:', bookingError);
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500 }
      );
    }
    
    // Calculate night count for display
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const nights = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: property.name,
              description: `${nights} night${nights > 1 ? 's' : ''} (${checkIn} to ${checkOut})`,
              images: property.image ? [property.image] : [],
            },
            unit_amount: Math.round(totalAmount * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      customer_email: guestEmail,
      client_reference_id: booking.id,
      metadata: {
        booking_id: booking.id,
        property_id: propertyId,
        check_in: checkIn,
        check_out: checkOut
      },
      mode: 'payment',
      success_url: `${request.nextUrl.origin}/booking/success?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/widget/${propertyId}?canceled=true`,
    });
    
    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Checkout session error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
} 