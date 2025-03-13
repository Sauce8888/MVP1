import { CustomPricing, Property, UnavailableDate, Booking } from './types';

// Get price for a specific date
export const getPriceForDate = (
  date: Date, 
  property: Property, 
  customPricing: CustomPricing[]
): number => {
  // Format date to ISO string for comparison
  const dateString = date.toISOString().split('T')[0];
  
  // Check if there's custom pricing for this date
  const customPrice = customPricing.find(pricing => pricing.date === dateString);
  if (customPrice) return customPrice.price;
  
  // Check if it's a weekend (Friday or Saturday)
  const day = date.getDay();
  const isWeekend = day === 5 || day === 6; // Friday or Saturday
  
  // Return weekend rate if available and it's a weekend, otherwise base rate
  return isWeekend && property.weekend_rate 
    ? property.weekend_rate 
    : property.base_rate;
};

// Check if a date is available
export const isDateAvailable = (
  date: Date,
  bookings: Booking[],
  unavailableDates: UnavailableDate[]
): boolean => {
  const dateString = date.toISOString().split('T')[0];
  
  // Check if date is marked as unavailable
  const isUnavailable = unavailableDates.some(
    unavailable => unavailable.date === dateString
  );
  
  if (isUnavailable) return false;
  
  // Check if date falls within any booking period
  const isBooked = bookings.some(booking => {
    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);
    const currentDate = new Date(dateString);
    
    return (
      booking.status === 'confirmed' &&
      currentDate >= checkIn && 
      currentDate < checkOut
    );
  });
  
  return !isBooked;
};

// Format a date to display format (e.g., "Jan 15, 2023")
export const formatDisplayDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Calculate total price for a stay
export const calculateTotalPrice = (
  checkIn: Date, 
  checkOut: Date, 
  property: Property, 
  customPricing: CustomPricing[]
): number => {
  let totalPrice = 0;
  const currentDate = new Date(checkIn);
  
  // Loop through each day of the stay
  while (currentDate < checkOut) {
    totalPrice += getPriceForDate(currentDate, property, customPricing);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return totalPrice;
};

// Generate an array of dates between two dates
export const getDatesBetween = (startDate: Date, endDate: Date): Date[] => {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate < endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}; 