'use client';

import { useState, useEffect } from 'react';
import { CustomPricing, Property, Booking, UnavailableDate } from '@/lib/types';
import { isDateAvailable, getPriceForDate, formatDisplayDate } from '@/lib/template-utils';

type CalendarProps = {
  property: Property;
  bookings: Booking[];
  unavailableDates: UnavailableDate[];
  customPricing: CustomPricing[];
  onSelectDates: (checkIn: Date | null, checkOut: Date | null) => void;
};

const Calendar = ({ 
  property, 
  bookings, 
  unavailableDates, 
  customPricing, 
  onSelectDates 
}: CalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCheckIn, setSelectedCheckIn] = useState<Date | null>(null);
  const [selectedCheckOut, setSelectedCheckOut] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Generate calendar data for the current month
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Get the first day of the month
    const firstDay = new Date(year, month, 1);
    // Get the last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Get the day of the week for the first day (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = firstDay.getDay();
    
    // Create an array to hold all calendar days including padding
    const calendarDays = [];
    
    // Add padding days for the start of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      const paddingDate = new Date(year, month, -firstDayOfWeek + i + 1);
      calendarDays.push({
        date: paddingDate,
        isPadding: true,
        isAvailable: false,
        price: 0,
      });
    }
    
    // Add actual days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const available = isDateAvailable(date, bookings, unavailableDates);
      const price = getPriceForDate(date, property, customPricing);
      
      calendarDays.push({
        date,
        isPadding: false,
        isAvailable: available,
        price,
      });
    }
    
    return calendarDays;
  };

  const calendarDays = generateCalendarDays();

  // Handle date selection
  const handleDateClick = (date: Date, isAvailable: boolean) => {
    if (!isAvailable || date < new Date()) return;
    
    if (!selectedCheckIn || (selectedCheckIn && selectedCheckOut)) {
      // Start new selection
      setSelectedCheckIn(date);
      setSelectedCheckOut(null);
      onSelectDates(date, null);
    } else {
      // Complete the selection
      if (date < selectedCheckIn) {
        setSelectedCheckIn(date);
        setSelectedCheckOut(selectedCheckIn);
      } else {
        setSelectedCheckOut(date);
      }
      onSelectDates(selectedCheckIn, date > selectedCheckIn ? date : selectedCheckIn);
    }
  };

  // Check if a date is within the selected range
  const isInRange = (date: Date) => {
    if (!selectedCheckIn) return false;
    if (!selectedCheckOut && !hoverDate) return false;
    
    const endDate = selectedCheckOut || hoverDate;
    
    if (!endDate) return false;
    
    return date > selectedCheckIn && date <= endDate;
  };

  // Handle mouse hover for date range preview
  const handleDateHover = (date: Date) => {
    if (selectedCheckIn && !selectedCheckOut) {
      setHoverDate(date);
    }
  };

  // Navigate to previous month
  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Format the month display
  const formatMonth = () => {
    return currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <button 
          onClick={previousMonth}
          className="p-2 rounded-full hover:bg-gray-100 transition"
          aria-label="Previous month"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && previousMonth()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <h3 className="text-lg font-medium">{formatMonth()}</h3>
        <button 
          onClick={nextMonth}
          className="p-2 rounded-full hover:bg-gray-100 transition"
          aria-label="Next month"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && nextMonth()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="text-center font-medium text-sm py-2">
            {day}
          </div>
        ))}
        
        {calendarDays.map((day, index) => {
          const isCheckIn = selectedCheckIn && day.date.toDateString() === selectedCheckIn.toDateString();
          const isCheckOut = selectedCheckOut && day.date.toDateString() === selectedCheckOut.toDateString();
          const inRange = isInRange(day.date);
          
          return (
            <div 
              key={index}
              onClick={() => handleDateClick(day.date, day.isAvailable)}
              onMouseEnter={() => handleDateHover(day.date)}
              onKeyDown={(e) => e.key === 'Enter' && handleDateClick(day.date, day.isAvailable)}
              tabIndex={day.isAvailable && !day.isPadding ? 0 : -1}
              aria-label={`${day.date.getDate()} ${day.date.toLocaleDateString('en-US', { month: 'long' })}, ${day.isAvailable ? 'available' : 'unavailable'}`}
              className={`
                relative h-16 p-1 cursor-pointer border rounded-md
                ${day.isPadding ? 'text-gray-300 bg-gray-50' : ''}
                ${!day.isPadding && !day.isAvailable ? 'text-gray-300 bg-gray-100 cursor-not-allowed' : ''}
                ${isCheckIn ? 'bg-blue-600 text-white' : ''}
                ${isCheckOut ? 'bg-blue-600 text-white' : ''}
                ${inRange && !isCheckIn && !isCheckOut ? 'bg-blue-100' : ''}
                ${!day.isPadding && day.isAvailable && !isCheckIn && !isCheckOut && !inRange ? 'hover:bg-gray-100' : ''}
              `}
            >
              <div className="text-xs">{day.date.getDate()}</div>
              {!day.isPadding && day.isAvailable && (
                <div className="text-xs mt-1 font-medium">
                  ${day.price}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-sm">
        {selectedCheckIn && (
          <div>
            <span className="font-medium">Check-in:</span> {formatDisplayDate(selectedCheckIn)}
          </div>
        )}
        {selectedCheckOut && (
          <div>
            <span className="font-medium">Check-out:</span> {formatDisplayDate(selectedCheckOut)}
          </div>
        )}
      </div>
    </div>
  );
};

export default Calendar; 