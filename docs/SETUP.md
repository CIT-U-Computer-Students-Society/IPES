# Setup and Installation Guide

This guide details the steps to set up, configure, and run the Individual Performance Evaluation System (IPES) locally on your development machine.

---

## 📦 Requirements

### Backend
- Python 3.13+
- Virtual environment (`venv`)
- Database (PostgreSQL / Supabase Postgres)

### Frontend
- Node.js 24 and npm (the dependency audit used Node.js 24.14.0)
- Modern web browser

---

## 🛠️ Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/CIT-U-Computer-Students-Society/IPES.git
cd IPES
```

### 2. Create Virtual Environment

Navigate to the `backend` directory first:
```bash
cd backend
```

Create virtual environment inside `backend`:
```bash
python -m venv .venv
```

Activate it:
- **Windows (PowerShell):**
  ```bash
  .venv\Scripts\Activate.ps1
  ```
- **Windows (Command Prompt)**
  ```cmd
  .venv\Scripts\activate.bat
  ```
- **macOS/Linux:**
  ```bash
  source .venv/bin/activate
  ```

### 3. Install Backend Dependencies

With your virtual environment active and inside the `backend` directory:
```bash
pip install -r requirements.txt
```

### 4. Setup Frontend

Navigate to the frontend directory from the project root:
```bash
cd frontend
```

Install frontend dependencies:
```bash
npm install
```

`frontend/package-lock.json` is the maintained dependency lockfile. Use npm for
dependency changes and commit both `package.json` and `package-lock.json`.
See the [dependency audit](DEPENDENCIES.md) for the retained UI stack and known
installation/build compatibility issues.

Create frontend environment file:
```bash
cp .env.example .env.local
```

Edit `frontend/.env.local` and set your API base URL (default: `http://localhost:8000/api`):
```env
VITE_API_BASE_URL=http://localhost:8000/api
```

Return to project root:
```bash
cd ..
```

---

## 🔑 Environment Variables

### Backend Setup (`.env` in the repository root)

From the repository root, copy the example environment file:
```bash
cp sample.env .env
```

Edit the root `.env` and update it with your local secrets (e.g. database, secret key, debug mode). Django discovers it through python-decouple's parent-directory search. Your `.env` file should look like this:

```env
SECRET_KEY=mysecretkey
DEBUG=True
DB_NAME=IPES
DB_USER=root
DB_PASSWORD=12345
DB_HOST=127.0.0.1
DB_PORT=5432
```

> [!WARNING]
> Never commit `.env` or `.env.local` — they contain sensitive credentials and keys.

### Profile picture storage

Create a **private** Supabase Storage bucket named `avatars`. Restrict uploads to
2 MB and MIME types `image/jpeg,image/png,image/webp`. Under Storage's S3
configuration, generate server-only access keys and copy the endpoint and region.
Set these variables in the root `.env` (or in the backend hosting environment):

```env
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_ENDPOINT_URL=https://your-project-ref.storage.supabase.co/storage/v1/s3
AWS_S3_REGION_NAME=your-region
AWS_STORAGE_BUCKET_NAME=avatars
```

Install the updated backend requirements, run `python manage.py migrate` from
`backend/`, and restart Django. The existing `display_picture` column stores the
object path; the migration updates its storage and allowed formats. Existing
local profile images must be copied to the private bucket under their existing
paths before switching storage. Organization pictures use their original storage.

Open **My Profile → Edit** to upload, replace, or remove a picture. Django validates
the decoded image, limits dimensions to 16 million pixels, crops to 256 × 256,
and re-encodes as WebP without the original metadata. Replaced files are removed
after a successful database commit. Authenticated profile responses and scoped
admin user listings return signed image URLs valid for one hour; open frontend
views refresh them every 45 minutes. Anyone holding a signed URL can use it until
expiry, so keep credentials and signed URLs out of public logs. Supabase S3 keys
bypass storage RLS; Django checks who may update and view profiles. No browser
storage key or public bucket policy is needed.

---

## 🗄️ Database Setup

Supabase uses PostgreSQL. Navigate to the `backend` directory, connect to your database instance, and run:

1. Apply migrations:
   ```bash
   python manage.py migrate
   ```
2. Create a superuser:
   ```bash
   python manage.py createsuperuser
   ```

---

## ▶️ Running the Application

### Development Mode

You need to run both the Django backend and React frontend development servers simultaneously.

#### Terminal 1 - Django Backend
Navigate to the `backend` directory and run:
```bash
cd backend
python manage.py runserver
```
Backend will be available at: [http://127.0.0.1:8000](http://127.0.0.1:8000)

#### Terminal 2 - React Frontend
Navigate to the `frontend` directory and run:
```bash
cd frontend
npm run dev
```
Frontend will be available at: [http://localhost:8080](http://localhost:8080)

### Production Build

To compile the frontend for production:
```bash
cd frontend
npm run build
```

The compiled files will be located in `frontend/dist/` and can be served by Django static files configurations or a dedicated web server.
