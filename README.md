# 🎨 Galleri CRM

A modern, mobile-first Customer Relationship Management system built for art galleries to manage their customer contacts, track visits, and monitor sales.

## ✨ Features

- 📱 **Mobile-First Design** - Optimized for smartphones and tablets
- 👥 **Contact Management** - Track chairman, treasurer, and other key contacts
- 🎨 **Sales Tracking** - Monitor art sales with dates, amounts, and descriptions
- 📅 **Visit Scheduling** - Book visits and set follow-up reminders
- 🔍 **Powerful Search** - Find customers by name, number, city, or phone
- 🔐 **Secure Authentication** - Email-based login with Supabase Auth
- ⚡ **Real-time Sync** - Changes sync instantly across all devices
- 💾 **Cloud Storage** - Never lose data, accessible from anywhere

## 🚀 Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **State Management**: TanStack Query
- **Forms**: React Hook Form
- **Icons**: Lucide React
- **Hosting**: Vercel (recommended)

## 📋 Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works great!)
- Git for version control

## 🛠️ Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd galleri-crm
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to be provisioned (~2 minutes)
3. Go to **Project Settings > API** and copy:
   - Project URL
   - Anon public key

### 4. Create Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and click **Run**

### 5. Configure Environment Variables

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 6. Start Development Server

```bash
npm run dev
```

The app will open at `http://localhost:3000`

## 📱 Usage

### First Time Setup

1. Click "Skapa konto" (Create account)
2. Enter your email and password (min 6 characters)
3. Check your email for confirmation link
4. Click the link to verify your account
5. Log in with your credentials

### Adding a Customer

1. Click **"Ny Post"** (New Entry) button
2. Fill in required fields:
   - Kundnr (Customer Number)
   - Företagsnamn (Company Name)
3. Optionally add:
   - Address, postal code, city
   - Company phone
   - Chairman (Ordförande) details
   - Treasurer (Kassör) details
   - Notes
   - Sales history
4. Check "Bokat besök" if visit is scheduled
5. Click **"Spara"** (Save)

### Editing a Customer

1. Click on any customer card in the list
2. Update fields as needed
3. Click **"Spara"** to save changes
4. Click **"Radera"** to delete (with confirmation)

### Searching

Use the search bar to find customers by:
- Company name
- Customer number
- City
- Phone number

## 🗂️ Project Structure

```
galleri-crm/
├── src/
│   ├── components/          # React components
│   │   ├── Auth.tsx        # Login/signup form
│   │   ├── CustomerList.tsx # Customer grid view
│   │   ├── CustomerForm.tsx # Add/edit customer form
│   │   ├── ContactSection.tsx # Contact input section
│   │   └── SalesSection.tsx # Sales tracking section
│   ├── lib/
│   │   └── supabase.ts     # Supabase client config
│   ├── types/
│   │   ├── database.ts     # Database type definitions
│   │   └── index.ts        # Exported types
│   ├── App.tsx             # Main app component
│   ├── main.tsx            # App entry point
│   └── index.css           # Global styles
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql # Database schema
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🚢 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click **"Import Project"**
4. Select your repository
5. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Click **"Deploy"**

Your app will be live in ~2 minutes! 🎉

## 📊 Database Schema

### Tables

**customers**
- Basic customer information
- Company details
- Visit booking status

**contacts**
- Chairman (ordförande)
- Treasurer (kassör)
- Additional contacts (ansvarig)
- Contact dates and follow-ups

**sales**
- Sales history
- Artwork sold
- Dates and amounts

### Security

- Row Level Security (RLS) enabled
- Users can only access their own data
- Authenticated users only

## 🔒 Security Best Practices

1. Never commit `.env` file
2. Use strong passwords
3. Enable 2FA on Supabase account
4. Review RLS policies regularly
5. Keep dependencies updated

## 🎯 Roadmap

- [ ] Email integration (send confirmations, info PDFs, visit proposals)
- [ ] Excel import/export for existing customer data
- [ ] Advanced filtering (Jaa/Ja/Nja/Nej status)
- [ ] Calendar integration for visit scheduling
- [ ] Dashboard with sales analytics
- [ ] PDF generation for reports
- [ ] Multi-user support with roles
- [ ] Dark mode
- [ ] Offline mode (PWA)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this for your gallery!

## 🆘 Support

If you encounter any issues:

1. Check that Supabase credentials are correct in `.env`
2. Verify the database schema was created successfully
3. Check browser console for errors
4. Ensure you're logged in

## 🎨 Credits

Built with ❤️ for art galleries by [Your Name]

---

**Happy gallery management!** 🖼️✨
