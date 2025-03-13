import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Define the test property ID as a constant
const TEST_PROPERTY_ID = '123e4567-e89b-12d3-a456-426614174000';

export async function GET(request: NextRequest) {
  try {
    // Get the payment_intent from the URL
    const url = new URL(request.url);
    const payment_intent = url.searchParams.get('payment_intent');
    
    if (!payment_intent) {
      return NextResponse.json({ error: 'Payment intent ID is required' }, { status: 400 });
    }
    
    // Retrieve the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent);
    
    // Check if we have a booking with this payment intent ID
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id, 
        guest_name, 
        guest_email, 
        check_in, 
        check_out, 
        status, 
        property_id, 
        properties:property_id (
          name, 
          address,
          hosts:host_id (
            name,
            email
          )
        )
      `)
      .eq('payment_id', payment_intent)
      .single();
      
    if (bookingError) {
      console.error('Error fetching booking details:', bookingError);
      
      // As a fallback, check if the payment ID is in the metadata
      // This helps in case the booking record wasn't created yet
      const { data: bookingByMeta, error: bookingMetaError } = await supabase
        .from('bookings')
        .select(`
          id, 
          guest_name, 
          guest_email, 
          check_in, 
          check_out, 
          status, 
          property_id, 
          properties:property_id (
            name, 
            address,
            hosts:host_id (
              name,
              email
            )
          )
        `)
        .eq('property_id', paymentIntent.metadata.property_id || '')
        .eq('guest_email', paymentIntent.metadata.guest_email || '')
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (bookingMetaError || !bookingByMeta || bookingByMeta.length === 0) {
        console.error('No booking found for this payment:', payment_intent);
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      
      const bookingById = bookingByMeta[0];
      const isTestProperty = bookingById.property_id === TEST_PROPERTY_ID;
      
      // If payment is successful and booking is still pending, update it
      if (paymentIntent.status === 'succeeded' && bookingById.status === 'pending') {
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ 
            status: 'confirmed',
            payment_id: payment_intent
          })
          .eq('id', bookingById.id);
          
        if (updateError) {
          console.error('Error updating booking status:', updateError);
        } else {
          console.log('Updated booking status to confirmed:', bookingById.id);
          bookingById.status = 'confirmed';
        }
      }
      
      // Format dates and calculate nights
      const checkIn = new Date(bookingById.check_in);
      const checkOut = new Date(bookingById.check_out);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      
      return NextResponse.json({
        paymentStatus: paymentIntent.status,
        bookingStatus: bookingById.status,
        guestName: bookingById.guest_name,
        guestEmail: bookingById.guest_email,
        checkIn: bookingById.check_in,
        checkOut: bookingById.check_out,
        nights,
        amount: paymentIntent.amount / 100, // Convert from cents to full units
        currency: paymentIntent.currency,
        propertyName: bookingById.properties?.[0]?.name || 'Test Property',
        propertyAddress: bookingById.properties?.[0]?.address || '123 Test Street',
        hostName: bookingById.properties?.[0]?.hosts?.[0]?.name || 'Test Host',
        hostEmail: bookingById.properties?.[0]?.hosts?.[0]?.email || 'test@example.com',
        paymentId: payment_intent,
        bookingId: bookingById.id,
        timestamp: new Date().toISOString(),
        isTestBooking: paymentIntent.livemode === false,
        isTestProperty: bookingById.property_id === TEST_PROPERTY_ID
      });
    }
    
    const isTestProperty = booking && booking.property_id === TEST_PROPERTY_ID;
    
    // If payment is successful and booking is still pending, update it
    if (paymentIntent.status === 'succeeded' && booking.status === 'pending') {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', booking.id);
        
      if (updateError) {
        console.error('Error updating booking status:', updateError);
      } else {
        console.log('Updated booking status to confirmed:', booking.id);
        booking.status = 'confirmed';
      }
    }
    
    // Format dates and calculate nights
    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    
    return NextResponse.json({
      paymentStatus: paymentIntent.status,
      bookingStatus: booking.status,
      guestName: booking.guest_name,
      guestEmail: booking.guest_email,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights,
      amount: paymentIntent.amount / 100, // Convert from cents to full units
      currency: paymentIntent.currency,
      propertyName: booking.properties?.[0]?.name || 'Test Property',
      propertyAddress: booking.properties?.[0]?.address || '123 Test Street',
      hostName: booking.properties?.[0]?.hosts?.[0]?.name || 'Test Host',
      hostEmail: booking.properties?.[0]?.hosts?.[0]?.email || 'test@example.com',
      paymentId: payment_intent,
      bookingId: booking.id,
      timestamp: new Date().toISOString(),
      isTestBooking: paymentIntent.livemode === false,
      isTestProperty: booking.property_id === TEST_PROPERTY_ID
    });
  } catch (error) {
    console.error('Payment status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check payment status' },
      { status: 500 }
    );
  }
} 