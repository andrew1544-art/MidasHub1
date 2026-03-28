# ⚡ MidasHub

**All your socials. One place. Zero limits.**

MidasHub is a universal social media hub where every post from every platform lives in one feed. No friend requests needed to see content. No restrictions. Post, repost, chat, go viral — all in one place.

![MidasHub](https://img.shields.io/badge/MidasHub-Social%20Hub-gold?style=for-the-badge)

## Features

- **🌍 Universal Feed** — See posts from Facebook, Instagram, Snapchat, TikTok, X, WhatsApp, YouTube, LinkedIn — all in one feed
- **🔥 Viral Discovery** — Posts automatically go viral at 100+ likes. Everyone sees everything
- **👥 Friends & People** — Add friends, discover people, accept requests
- **💬 Real-time Chat** — Direct messaging with instant delivery via WebSockets
- **✏️ Post & Repost** — Create original posts or repost from any platform with source tagging
- **🌐 Cross-Post Buttons** — One-click buttons to jump to any platform and post there too
- **📤 Share Anywhere** — Share posts to Twitter, Facebook, WhatsApp, LinkedIn directly
- **🔖 Bookmarks** — Save posts for later
- **🔔 Live Notifications** — Real-time notifications for likes, comments, friend requests, viral posts
- **📧 Email Verification** — Secure signup with email confirmation
- **🔍 Search** — Find people and posts instantly
- **📱 Mobile Responsive** — Works perfectly on all devices with bottom nav on mobile
- **15+ Age Requirement** — Age verification on signup
- **♾️ No Limits** — No character limits, no daily caps, no content restrictions

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **State**: Zustand
- **Hosting**: Vercel

---

## 🚀 Deployment Guide (GitHub → Vercel)

### Step 1: Set Up Supabase (Free)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** — give it a name (e.g., `midashub`)
3. Set a **database password** (save this somewhere!)
4. Wait for the project to initialize (~2 minutes)

### Step 2: Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy the ENTIRE contents of `supabase/schema.sql` and paste it
4. Click **Run** — this creates all tables, policies, triggers, and storage

### Step 3: Enable Email Auth

1. Go to **Authentication** → **Providers** in Supabase
2. Make sure **Email** is enabled
3. Go to **Authentication** → **URL Configuration**
4. Set **Site URL** to your Vercel domain (e.g., `https://midashub.vercel.app`)
5. Add **Redirect URLs**: `https://midashub.vercel.app/auth/callback`
6. (Optional) Go to **Email Templates** to customize the verification email

### Step 4: Get Your API Keys

1. Go to **Project Settings** → **API** in Supabase
2. Copy:
   - **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → this is `SUPABASE_SERVICE_ROLE_KEY`

### Step 5: Enable Realtime

1. Go to **Database** → **Replication** in Supabase
2. Enable realtime for these tables:
   - `messages`
   - `notifications`
   - `posts`

### Step 6: Push to GitHub

```bash
# In the midashub directory
git init
git add .
git commit -m "Initial commit - MidasHub"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/midashub.git
git push -u origin main
```

### Step 7: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **New Project**
3. Import your `midashub` repository
4. In **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL (e.g., `https://midashub.vercel.app`) |

5. Click **Deploy** — Vercel builds and deploys automatically
6. Your site is live! 🎉

### Step 8: Update Supabase URLs

After deploy, go back to Supabase:
1. **Authentication** → **URL Configuration**
2. Update **Site URL** to your Vercel domain
3. Add your Vercel domain to **Redirect URLs**

---

## 🛠️ Local Development

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/midashub.git
cd midashub

# Install
npm install

# Set up environment
cp .env.example .env
# Edit .env with your Supabase keys

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
midashub/
├── src/
│   ├── app/
│   │   ├── page.js              # Landing page
│   │   ├── layout.js            # Root layout
│   │   ├── globals.css          # Global styles
│   │   ├── feed/page.js         # Main feed
│   │   ├── viral/page.js        # Viral/trending posts
│   │   ├── people/page.js       # Discover & friends
│   │   ├── chat/page.js         # Real-time chat
│   │   ├── profile/[username]/  # User profiles
│   │   ├── settings/page.js     # Account settings
│   │   ├── bookmarks/page.js    # Saved posts
│   │   └── auth/callback/       # Email verification handler
│   ├── components/
│   │   ├── AppShell.js          # App wrapper
│   │   ├── Header.js            # Navigation
│   │   ├── AuthModal.js         # Signup/Login
│   │   ├── ComposeModal.js      # Create post
│   │   └── PostCard.js          # Post component
│   ├── lib/
│   │   ├── supabase-browser.js  # Client-side Supabase
│   │   ├── supabase-server.js   # Server-side Supabase
│   │   ├── store.js             # Zustand state
│   │   └── constants.js         # Platform data & utils
│   └── middleware.js             # Auth session refresh
├── supabase/
│   └── schema.sql               # Complete database schema
├── .env.example
├── next.config.js
├── tailwind.config.js
└── package.json
```

## Database Schema

- **profiles** — User accounts with social links and avatar
- **posts** — All posts with platform source tagging
- **likes** — Post likes (auto-updates count)
- **comments** — Threaded comments
- **friendships** — Friend requests and connections
- **conversations** — Chat conversations
- **messages** — Real-time chat messages
- **notifications** — All notification types
- **reposts** — Repost tracking
- **bookmarks** — Saved posts

All tables have Row Level Security (RLS) enabled.

---

## License

MIT — Use it however you want. No restrictions. Free world. ⚡
