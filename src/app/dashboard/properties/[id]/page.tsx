import { Suspense } from 'react';
import PropertyDetailsClient from './PropertyDetailsClient';

// Define the params type properly
type PageParams = Promise<{ id: string }>;

// This is a server component that handles dynamic route params
export default async function PropertyDetailsPage({ params }: { params: PageParams }) {
  // Properly await the params to access id
  const { id } = await params;
  
  // Pass the ID to the client component with Suspense for better loading experience
  return (
    <Suspense fallback={<div>Loading property details...</div>}>
      <PropertyDetailsClient propertyId={id} />
    </Suspense>
  );
} 