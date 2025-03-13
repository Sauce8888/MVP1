'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function BookingCancel() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('booking_id');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    async function cancelBooking() {
      if (!bookingId) {
        setError('No booking ID provided');
        setLoading(false);
        return;
      }

      try {
        // First, check if the booking exists and is pending
        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .select('status')
          .eq('id', bookingId)
          .single();

        if (bookingError) {
          throw new Error('Booking not found');
        }

        // Only cancel if the booking is in a pending state
        if (bookingData.status === 'pending') {
          const { error: updateError } = await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', bookingId);

          if (updateError) {
            throw updateError;
          }
          
          setCancelled(true);
        } else {
          // If it's already confirmed or cancelled, just show appropriate message
          setCancelled(bookingData.status === 'cancelled');
        }
      } catch (err: any) {
        console.error('Error cancelling booking:', err);
        setError(err.message || 'Failed to cancel booking');
      } finally {
        setLoading(false);
      }
    }

    cancelBooking();
  }, [bookingId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg">Processing your cancellation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="mb-6 text-gray-700">
            {error}
          </p>
          <Link
            href="/"
            className="block w-full text-center bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-gray-700 p-4">
          <h1 className="text-2xl font-bold text-white text-center">Booking Cancelled</h1>
        </div>
        
        <div className="p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
            <p className="text-gray-800">
              {cancelled 
                ? 'Your booking has been cancelled. No payment has been processed.'
                : 'Your booking process was interrupted. If you still want to book, please try again.'}
            </p>
          </div>
          
          <div className="space-y-6">
            <p className="text-gray-600">
              If you have any questions or need assistance, please feel free to contact us.
            </p>
            
            <div className="flex flex-col space-y-4">
              <Link
                href="/"
                className="block text-center bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
              >
                Return to Home
              </Link>
              
              <button
                onClick={() => window.history.back()}
                className="block text-center bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300 transition"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 