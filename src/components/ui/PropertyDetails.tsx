'use client';

import { Property } from '@/lib/types';
import Image from 'next/image';

type PropertyDetailsProps = {
  property: Property;
  images: string[]; // Array of image URLs
};

const PropertyDetails = ({ property, images }: PropertyDetailsProps) => {
  // Placeholder image if no images provided
  const defaultImage = '/window.svg';
  
  return (
    <div className="space-y-8">
      {/* Property images gallery */}
      <div className="relative h-[400px] md:h-[500px] rounded-xl overflow-hidden">
        {images && images.length > 0 ? (
          <Image
            src={images[0]}
            alt={property.name}
            fill
            sizes="(max-width: 768px) 100vw, 80vw"
            priority
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <Image
              src={defaultImage}
              alt="Placeholder"
              width={200}
              height={200}
              className="opacity-30"
            />
          </div>
        )}
      </div>
      
      {/* Property details */}
      <div>
        <h1 className="text-3xl font-bold mb-2">{property.name}</h1>
        
        {property.address && (
          <p className="text-gray-600 mb-4">
            <span className="inline-flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {property.address}
            </span>
          </p>
        )}
        
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v11m0-7h18m0-4v11m-9-7v7m4.5-7v7m-9-7v7"/>
            </svg>
            <span>
              Min stay: <strong>{property.min_stay} {property.min_stay === 1 ? 'night' : 'nights'}</strong>
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <span>
              From <strong>${property.base_rate}</strong> / night
            </span>
          </div>
        </div>
        
        {property.description && (
          <div className="prose max-w-none">
            <h2 className="text-xl font-bold mb-2">About this property</h2>
            <div>
              {property.description.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-4">{paragraph}</p>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Additional images (if any) */}
      {images && images.length > 1 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Property gallery</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.slice(1).map((image, index) => (
              <div key={index} className="relative h-48 rounded-lg overflow-hidden">
                <Image
                  src={image}
                  alt={`${property.name} - Image ${index + 2}`}
                  fill
                  sizes="(max-width: 768px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Property amenities - placeholder for future expansion */}
      <div>
        <h2 className="text-xl font-bold mb-4">Amenities</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {/* These would be dynamically loaded from the property data in a real implementation */}
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 20v-7m0 0V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v8m10 0H7m0 0v7"/>
            </svg>
            <span>Free WiFi</span>
          </div>
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21 12-7-7v4H3v6h11v4z"/>
            </svg>
            <span>Self check-in</span>
          </div>
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 9V5c0-1 .6-2 2-2h16a2 2 0 0 1 2 2v4"/>
              <path d="M2 13v6c0 1 .6 2 2 2h16a2 2 0 0 0 2-2v-6"/>
              <path d="M2 9h20"/>
              <path d="M2 13h20"/>
            </svg>
            <span>Air conditioning</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetails; 