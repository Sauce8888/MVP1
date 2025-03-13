import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <main className="flex flex-col items-center text-center max-w-3xl">
        <h1 className="text-5xl font-bold mb-6">Airbnb Direct Booking Solution</h1>
        <p className="text-xl mb-8">
          The simplest way for Airbnb hosts to accept direct bookings through their own website.
        </p>
        
        <div className="flex gap-4 mb-12">
          <Link 
            href="/auth/signin" 
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Host Login
          </Link>
          <Link 
            href="/auth/signup" 
            className="px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Create Account
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          <div className="p-6 bg-white rounded-lg shadow">
            <h3 className="text-xl font-bold mb-2">Accept Direct Bookings</h3>
            <p>Save on OTA fees by accepting bookings directly through your website.</p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow">
            <h3 className="text-xl font-bold mb-2">Calendar Sync</h3>
            <p>Seamlessly sync with your Google Calendar to avoid double bookings.</p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow">
            <h3 className="text-xl font-bold mb-2">Manage Pricing</h3>
            <p>Easily update pricing for different dates with our intuitive dashboard.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
