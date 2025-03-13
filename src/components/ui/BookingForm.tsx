'use client';

import { useState } from 'react';
import { Property, CustomPricing } from '@/lib/types';
import { calculateTotalPrice, formatDisplayDate } from '@/lib/template-utils';

type BookingFormProps = {
  property: Property;
  customPricing: CustomPricing[];
  checkIn: Date | null;
  checkOut: Date | null;
  stripePublishableKey: string;
  onBookingSubmit: (formData: BookingFormData) => Promise<void>;
};

export type BookingFormData = {
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  guests_count: number;
  special_requests?: string;
  check_in: string;
  check_out: string;
};

const BookingForm = ({
  property,
  customPricing,
  checkIn,
  checkOut,
  stripePublishableKey,
  onBookingSubmit
}: BookingFormProps) => {
  const [formData, setFormData] = useState<BookingFormData>({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    guests_count: 1,
    special_requests: '',
    check_in: checkIn ? checkIn.toISOString() : '',
    check_out: checkOut ? checkOut.toISOString() : ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Calculate the total price
  const totalPrice = checkIn && checkOut 
    ? calculateTotalPrice(checkIn, checkOut, property, customPricing)
    : 0;
  
  // Calculate the number of nights
  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0;
    const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  
  const nights = calculateNights();
  
  // Count weekend nights
  const calculateWeekendNights = () => {
    if (!checkIn || !checkOut) return 0;
    let weekendNights = 0;
    const currentDate = new Date(checkIn);
    
    while (currentDate < checkOut) {
      const day = currentDate.getDay();
      if (day === 5 || day === 6) { // Friday or Saturday
        weekendNights++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return weekendNights;
  };
  
  const weekendNights = calculateWeekendNights();
  const regularNights = nights - weekendNights;
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!checkIn || !checkOut) {
      setError('Please select check-in and check-out dates');
      return;
    }
    
    if (!formData.guest_name || !formData.guest_email) {
      setError('Please fill in all required fields');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Update dates with the selected dates
      const bookingData = {
        ...formData,
        check_in: checkIn.toISOString(),
        check_out: checkOut.toISOString(),
      };
      
      await onBookingSubmit(bookingData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing your booking');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg border p-6 shadow-sm">
      <h3 className="text-xl font-bold mb-4">Book Your Stay</h3>
      
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4">
          {error}
        </div>
      )}
      
      <div className="mb-4">
        <div className="flex justify-between mb-2">
          <div>
            <div className="text-sm text-gray-600">Dates</div>
            <div className="font-medium">
              {checkIn && checkOut 
                ? `${formatDisplayDate(checkIn)} — ${formatDisplayDate(checkOut)}`
                : 'Select dates on the calendar'}
            </div>
          </div>
          {nights > 0 && (
            <div className="text-right">
              <div className="text-sm text-gray-600">Duration</div>
              <div className="font-medium">{nights} {nights === 1 ? 'night' : 'nights'}</div>
            </div>
          )}
        </div>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="guest_name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              id="guest_name"
              name="guest_name"
              type="text"
              required
              value={formData.guest_name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Full name"
            />
          </div>
          
          <div>
            <label htmlFor="guest_email" className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              id="guest_email"
              name="guest_email"
              type="email"
              required
              value={formData.guest_email}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Email address"
            />
          </div>
          
          <div>
            <label htmlFor="guest_phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              id="guest_phone"
              name="guest_phone"
              type="tel"
              value={formData.guest_phone}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Phone number"
            />
          </div>
          
          <div>
            <label htmlFor="guests_count" className="block text-sm font-medium text-gray-700 mb-1">
              Number of Guests *
            </label>
            <select
              id="guests_count"
              name="guests_count"
              value={formData.guests_count}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Number of guests"
            >
              {[...Array(10)].map((_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1} {i === 0 ? 'guest' : 'guests'}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="special_requests" className="block text-sm font-medium text-gray-700 mb-1">
              Special Requests
            </label>
            <textarea
              id="special_requests"
              name="special_requests"
              rows={3}
              value={formData.special_requests}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Special requests"
            />
          </div>
          
          {totalPrice > 0 && (
            <div className="border-t pt-4 mt-4">
              {regularNights > 0 && (
                <div className="flex justify-between mb-2">
                  <span>€{property.base_rate} × {regularNights} {regularNights === 1 ? 'regular night' : 'regular nights'}</span>
                  <span>€{property.base_rate * regularNights}</span>
                </div>
              )}
              {weekendNights > 0 && (
                <div className="flex justify-between mb-2">
                  <span>€{property.weekend_rate || property.base_rate} × {weekendNights} {weekendNights === 1 ? 'weekend night' : 'weekend nights'}</span>
                  <span>€{(property.weekend_rate || property.base_rate) * weekendNights}</span>
                </div>
              )}
              
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span>€{totalPrice}</span>
              </div>
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading || !checkIn || !checkOut}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            aria-label="Book now"
          >
            {loading ? 'Processing...' : 'Book Now'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BookingForm; 