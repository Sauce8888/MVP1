'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function BookingSuccessPage() {
  const searchParams = useSearchParams();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bookingId = searchParams.get('booking_id');
    const sessionId = searchParams.get('session_id');
    
    if (!bookingId) {
      setError('Booking information not found');
      setLoading(false);
      return;
    }
    
    const loadBookingDetails = async () => {
      try {
        // Fetch the booking details
        const { data, error: fetchError } = await supabase
          .from('bookings')
          .select(`
            *,
            property:property_id (
              name,
              address
            )
          `)
          .eq('id', bookingId)
          .single();
          
        if (fetchError) throw fetchError;
        if (!data) throw new Error('Booking not found');
        
        // If the booking status is still 'pending' but we have a session ID,
        // try to update the status to 'confirmed' as a fallback in case the webhook failed
        if (data.status === 'pending' && sessionId) {
          const { error: updateError } = await supabase
            .from('bookings')
            .update({ 
              status: 'confirmed',
              payment_id: sessionId
            })
            .eq('id', bookingId);
            
          if (!updateError) {
            // Reload the booking data to get the updated status
            const { data: refreshedData } = await supabase
              .from('bookings')
              .select(`
                *,
                property:property_id (
                  name,
                  address
                )
              `)
              .eq('id', bookingId)
              .single();
              
            if (refreshedData) {
              setBooking(refreshedData);
              setLoading(false);
              return;
            }
          }
        }
        
        setBooking(data);
      } catch (err: any) {
        console.error('Error loading booking:', err);
        setError('Could not load booking details');
      } finally {
        setLoading(false);
      }
    };
    
    loadBookingDetails();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-700 mb-4">{error || 'Booking information not found'}</p>
          <a 
            href="/"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  // Format dates
  const checkInDate = new Date(booking.check_in).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const checkOutDate = new Date(booking.check_out).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-green-600 px-6 py-4">
            <div className="flex items-center justify-center">
              <svg className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mt-2 text-center text-3xl font-extrabold text-white">
              Booking Confirmed!
            </h1>
          </div>
          
          <div className="px-6 py-8">
            <div className="text-center mb-8">
              <p className="text-sm text-gray-500">Booking Reference</p>
              <p className="text-lg font-semibold">{booking.id}</p>
            </div>
            
            <div className="border-t border-gray-200 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Property Details</h2>
                  <p className="text-gray-700">{booking.property.name}</p>
                  {booking.property.address && (
                    <p className="text-gray-700">{booking.property.address}</p>
                  )}
                </div>
                
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Stay Details</h2>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Check-in:</span>
                    <span className="text-gray-900">{checkInDate}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Check-out:</span>
                    <span className="text-gray-900">{checkOutDate}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Guests:</span>
                    <span className="text-gray-900">{booking.guests_count}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-200 mt-6 pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Guest Information</h2>
              <p className="text-gray-700"><span className="font-medium">Name:</span> {booking.guest_name}</p>
              <p className="text-gray-700"><span className="font-medium">Email:</span> {booking.guest_email}</p>
              {booking.guest_phone && (
                <p className="text-gray-700"><span className="font-medium">Phone:</span> {booking.guest_phone}</p>
              )}
              {booking.special_requests && (
                <div className="mt-4">
                  <p className="font-medium text-gray-700">Special Requests:</p>
                  <p className="text-gray-700">{booking.special_requests}</p>
                </div>
              )}
            </div>
            
            <div className="text-center mt-8">
              <a
                href="/"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Return to Home
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 