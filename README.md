# Direct Booking System

A complete booking platform built with Next.js that allows hosts to manage properties and accept direct bookings with Stripe integration.

## Features

- **Property Management**: Hosts can create and manage property listings
- **Booking System**: Calendar-based booking system with date blocking
- **Real-time Payment Processing**: Secure payments via Stripe integration
- **User Authentication**: Secure authentication via Supabase
- **Admin Dashboard**: Complete dashboard for host and booking management
- **Embeddable Widget**: Hosts can embed the booking widget on their own websites

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Payments**: Stripe API with test mode support
- **Deployment**: See TEMPLATE-DEPLOYMENT.md for deployment instructions

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Supabase account
- Stripe account (with test API keys for development)

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Installation

1. Clone the repository
```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Run the development server
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Deployment

See the [TEMPLATE-DEPLOYMENT.md](TEMPLATE-DEPLOYMENT.md) file for detailed deployment instructions.

## License

[MIT](LICENSE)
