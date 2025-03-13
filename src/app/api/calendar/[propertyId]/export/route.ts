'use server';

import { NextRequest, NextResponse } from 'next/server';
import { generatePropertyIcal } from '@/lib/ical-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { propertyId: string } }
) {
  try {
    const propertyId = params.propertyId;
    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Generate iCal for the property
    const icalContent = await generatePropertyIcal(propertyId);

    // Return the iCal as a downloadable file
    return new NextResponse(icalContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="property-${propertyId}.ics"`,
      },
    });
  } catch (error) {
    console.error('Error exporting calendar:', error);
    return NextResponse.json(
      { error: 'Failed to generate calendar' },
      { status: 500 }
    );
  }
} 