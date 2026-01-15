# Twine Workshop
A collaborative, web-based interactive story editor inspired by Twine. Create, edit, and play branching narrative stories directly in your browser with real-time cloud storage.

A web-based interactive fiction editor with cloud storage. Create branching narrative stories with a visual drag-and-drop interface.

## Features

- **Visual Story Editor** - Drag-and-drop passage nodes on an infinite canvas
- **Real-time Cloud Sync** - Stories automatically saved to Firebase
- **Multiple Export Formats** - Twine Archive, Playable HTML, Twee 3, and JSON
- **Import Support** - Import existing Twine HTML, Twee, or JSON files
- **Play Mode** - Test your stories instantly in the built-in player
- **User Authentication** - Secure login with Email/Password or Google Sign-In

## Setup
### Frontend: Vanilla JavaScript (ES6 modules), HTML5, CSS3
### Backend: Firebase (Firestore, Authentication)

1. Create a project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Firestore Database** and **Authentication**

#### Google Authentication

1. **Firebase Console** → **Authentication** → **Sign-in method**
2. Enable **Google** provider
3. Add your domain to **Authorized domains** (e.g., `your-site.netlify.app`)

### Hosting: Netlify (with serverless functions)

- Import an existing project to Netlify from GitHub
- The function at `netlify/functions/firebaseConfig.js` serves Firebase config from environment variables.

Set these in Environment variables:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

## Local Development

Use any static server, for example VS Code Live Server extension.
