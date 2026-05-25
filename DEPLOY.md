# Deploy Colorado Quest to Vercel (Phone-Friendly, from GitHub)

These steps deploy the Vite app to Vercel without changing app functionality.

## 1) Push code to GitHub
1. Make sure your latest code is pushed to a GitHub repository.
2. Keep the repo public or private as needed.

## 2) Sign in to Vercel with GitHub
1. On your phone, open https://vercel.com in a mobile browser.
2. Tap **Sign Up / Log In**.
3. Choose **Continue with GitHub**.
4. Authorize Vercel to access your repositories.

## 3) Import the repository
1. In Vercel, tap **Add New Project**.
2. Under GitHub repos, find and select your Colorado Quest repo.
3. Tap **Import**.

## 4) Set project build configuration
When prompted, use these exact values:

- **Framework Preset:** `Vite`
- **Install Command:** `npm install`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

Then tap **Deploy**.

## 5) Open the preview link on phone
1. Wait for deployment to finish.
2. Vercel will show a deployment URL (for example: `https://your-project.vercel.app`).
3. Tap the URL directly in Vercel to open the live preview on your phone.
4. Optional: tap the browser share menu and **Add to Home Screen** for app-like access.

## Offline phone install
After the site is deployed, open it once on the phone while online.

- **iPhone:** Safari → Share → Add to Home Screen.
- **Android:** Chrome → menu → Install app or Add to Home screen.

The app shell and visited assets are cached for offline use. Discoveries are still stored locally on that specific phone/browser.

## Notes
- This app is static/local-first and does not require a backend.
- Discovery data is stored in each phone/browser locally.
- Map tiles may need an internet connection unless they were already cached by the browser.
