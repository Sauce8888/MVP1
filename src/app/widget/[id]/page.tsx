'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Property, CustomPricing, UnavailableDate } from '@/lib/types';
import { loadStripe } from '@stripe/stripe-js';
import { useParams } from 'next/navigation';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string);

// Since this is a client component, we can use useParams instead
export default function BookingWidget() {
  const params = useParams();
  const id = params.id as string;
  
  const [property, setProperty] = useState<Property | null>(null);
  const [customPricing, setCustomPricing] = useState<CustomPricing[]>([]);
  const [unavailableDates, setUnavailableDates] = useState<UnavailableDate[]>([]);
  const [bookings, setBookings] = useState<string[]>([]); // Array of dates that are already booked
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [hostStripeKey, setHostStripeKey] = useState<string | null>(null);

  // Form state
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestCount, setGuestCount] = useState('1');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  // Booking summary
  const [totalNights, setTotalNights] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [priceBreakdown, setPriceBreakdown] = useState<{ date: string; price: number }[]>([]);

  async function fetchPropertyData() {
    try {
      // Fetch property details with host info
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select(`
          *,
          hosts:host_id (
            id,
            name,
            email,
            stripe_publishable_key
          )
        `)
        .eq('id', id)
        .single();

      if (propertyError) throw propertyError;
      if (!propertyData) throw new Error('Property not found');
      
      setProperty(propertyData);
      
      // Set host's Stripe publishable key if available
      if (propertyData.hosts?.stripe_publishable_key) {
        setHostStripeKey(propertyData.hosts.stripe_publishable_key);
      }
      
      // Fetch custom pricing
      const { data: pricingData, error: pricingError } = await supabase
        .from('custom_pricing')
        .select('*')
        .eq('property_id', id);
        
      if (pricingError) throw pricingError;
      setCustomPricing(pricingData || []);
      
      // Fetch unavailable dates
      const { data: unavailableData, error: unavailableError } = await supabase
        .from('unavailable_dates')
        .select('*')
        .eq('property_id', id);
        
      if (unavailableError) throw unavailableError;
      setUnavailableDates(unavailableData || []);
      
      // Fetch bookings to determine unavailable dates
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('check_in, check_out')
        .eq('property_id', id)
        .eq('status', 'confirmed');
        
      if (bookingsError) throw bookingsError;
      
      // Convert bookings to array of dates
      const bookedDates: string[] = [];
      bookingsData?.forEach(booking => {
        const start = new Date(booking.check_in);
        const end = new Date(booking.check_out);
        
        // For each day of the booking, add to bookedDates
        const currentDate = new Date(start);
        while (currentDate < end) {
          bookedDates.push(currentDate.toISOString().split('T')[0]);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });
      
      setBookings(bookedDates);
      
    } catch (err: any) {
      console.error('Error fetching property data:', err);
      setError('Unable to load property information');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPropertyData();
  }, [id]);
  
  // Calculate price for a specific date
  const getPriceForDate = (date: Date): number => {
    const dateString = date.toISOString().split('T')[0];
    
    // Check if there's custom pricing for this date
    const customPrice = customPricing.find(p => p.date === dateString);
    if (customPrice) return customPrice.price;
    
    // Check if it's a weekend (Friday or Saturday)
    const day = date.getDay();
    if ((day === 5 || day === 6) && property?.weekend_rate) {
      return property.weekend_rate;
    }
    
    // Otherwise use base rate
    return property?.base_rate || 0;
  };
  
  // Calculate total price when dates change
  useEffect(() => {
    if (!checkIn || !checkOut || !property) return;
    
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    
    // Calculate nights
    const nights = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    setTotalNights(nights);
    
    // Calculate price breakdown
    const breakdown: { date: string; price: number }[] = [];
    let total = 0;
    
    const currentDate = new Date(startDate);
    while (currentDate < endDate) {
      const price = getPriceForDate(currentDate);
      breakdown.push({
        date: currentDate.toISOString().split('T')[0],
        price
      });
      total += price;
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    setPriceBreakdown(breakdown);
    setTotalPrice(total);
    
  }, [checkIn, checkOut, property, customPricing]);
  
  // Check if a date is unavailable
  const isDateUnavailable = (dateStr: string): boolean => {
    // Check if it's in unavailable_dates
    if (unavailableDates.some(d => d.date === dateStr)) return true;
    
    // Check if it's in bookings
    if (bookings.includes(dateStr)) return true;
    
    return false;
  };
  
  // Form validation
  const isFormValid = (): boolean => {
    if (!checkIn || !checkOut || !guestCount || !guestName || !guestEmail) return false;
    
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    
    // Check if dates are valid
    if (startDate >= endDate) return false;
    
    // Check if stay meets minimum nights
    const nights = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (property && nights < property.min_stay) return false;
    
    // Check if any selected date is unavailable
    const currentDate = new Date(startDate);
    while (currentDate < endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (isDateUnavailable(dateStr)) return false;
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return true;
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid() || !property) return;
    
    setProcessingPayment(true);
    setError(null);
    
    try {
      // Create a checkout session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId: property.id,
          checkIn,
          checkOut,
          guestName,
          guestEmail,
          guestPhone,
          guestCount: parseInt(guestCount),
          specialRequests,
          totalAmount: totalPrice,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Payment processing failed');
      }
      
      const { url } = await response.json();
      
      // Check if running in an iframe
      const isInIframe = window !== window.parent;
      
      if (isInIframe) {
        // If in iframe, redirect the parent window instead
        window.parent.location.href = url;
      } else {
        // If not in iframe, redirect current window
        window.location.href = url;
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Unable to process payment. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 h-full">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (error || !property) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-600">
          {error || 'Property not found'}
        </p>
      </div>
    );
  }
  
  return (
    <div className="font-sans max-w-full bg-white rounded-lg shadow p-4 text-gray-800">
      <h2 className="text-xl font-semibold mb-4">{property.name}</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="checkIn" className="block text-sm font-medium text-gray-700 mb-1">
              Check-in Date *
            </label>
            <input
              type="date"
              id="checkIn"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
              className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="checkOut" className="block text-sm font-medium text-gray-700 mb-1">
              Check-out Date *
            </label>
            <input
              type="date"
              id="checkOut"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              min={checkIn || new Date().toISOString().split('T')[0]}
              required
              className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
        </div>
        
        {/* Guest count */}
        <div>
          <label htmlFor="guestCount" className="block text-sm font-medium text-gray-700 mb-1">
            Number of Guests *
          </label>
          <select
            id="guestCount"
            value={guestCount}
            onChange={(e) => setGuestCount(e.target.value)}
            required
            className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
              <option key={num} value={num}>
                {num} {num === 1 ? 'Guest' : 'Guests'}
              </option>
            ))}
          </select>
        </div>
        
        {/* Guest information */}
        <div className="space-y-4">
          <div>
            <label htmlFor="guestName" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              id="guestName"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              required
              className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label htmlFor="guestEmail" className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              id="guestEmail"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              required
              className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label htmlFor="guestPhone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              id="guestPhone"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label htmlFor="specialRequests" className="block text-sm font-medium text-gray-700 mb-1">
              Special Requests
            </label>
            <textarea
              id="specialRequests"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows={3}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
        </div>
        
        {/* Price breakdown */}
        {totalNights > 0 && (
          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="font-semibold mb-2">Price Summary</h3>
            
            <div className="space-y-1 mb-3 text-sm">
              {priceBreakdown.map((item, index) => (
                <div key={index} className="flex justify-between">
                  <span>{new Date(item.date).toLocaleDateString()}</span>
                  <span>${item.price}</span>
                </div>
              ))}
            </div>
            
            <div className="flex justify-between font-bold pt-2 border-t border-gray-200">
              <span>Total ({totalNights} nights)</span>
              <span>${totalPrice}</span>
            </div>
            
            {property.min_stay > 1 && totalNights < property.min_stay && (
              <p className="text-red-600 mt-2 text-sm">
                This property requires a minimum stay of {property.min_stay} nights.
              </p>
            )}
          </div>
        )}
        
        {/* Validation error messages */}
        {checkIn && checkOut && new Date(checkIn) >= new Date(checkOut) && (
          <p className="text-red-600 text-sm">
            Check-out date must be after check-in date.
          </p>
        )}
        
        {/* Submit button */}
        <button
          type="submit"
          disabled={!isFormValid() || processingPayment}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300"
        >
          {processingPayment ? 'Processing...' : 'Book Now'}
        </button>
      </form>
    </div>
  );
} 