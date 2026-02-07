# Backend Deployment Instructions

## Deploy to Render (Free)

### Option 1: Using Render Dashboard (Recommended)

1. Go to https://dashboard.render.com/
2. Click "New +" → "Web Service"
3. Connect your GitHub repo or use "Public Git Repository"
4. If using public repo, enter: `https://github.com/YOUR_USERNAME/YOUR_REPO`
5. Configure:
   - **Name**: cmat-backend
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free
6. Click "Create Web Service"

### Option 2: Using Render Blueprint (render.yaml)

The `render.yaml` file is already created in the backend folder. To use it:

1. Push your code to GitHub
2. Go to https://dashboard.render.com/blueprints
3. Click "New Blueprint Instance"
4. Connect your repo
5. Render will automatically detect the `render.yaml` file

### After Deployment

Once deployed, Render will give you a URL like:
`https://cmat-backend.onrender.com`

Update the frontend API URL in `frontend/src/lib/api.js`:
```javascript
const API_BASE = "https://cmat-backend.onrender.com";
```

Then redeploy the frontend to Vercel.

## Current Setup

- **Frontend URL**: https://frontend-7alr0wjz2-jainit-sonis-projects.vercel.app
- **Backend Status**: Needs deployment to Render
- **Backend Code**: Ready in `/backend` folder

## API Endpoints Available

- `GET /api/health` - Health check
- `GET /api/colleges` - Get all colleges (with pagination, filters)
- `GET /api/college/:id` - Get specific college
- `GET /api/exams` - Get all exams
- `GET /api/exam/:id` - Get specific exam
- `GET /api/search` - Search colleges and exams
- `GET /api/states/stats` - Get state-wise college counts

## Database

The backend uses JSON files in `/backend/models/` containing 1,750+ real colleges across all Indian states.
