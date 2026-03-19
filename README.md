# Twine Workshop
A collaborative, web-based interactive story editor inspired by Twine. Create, edit, and play branching narrative stories directly in your browser with real-time cloud storage.

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

## Local Development

Use any static server, for example VS Code Live Server extension.

## License

This project is licensed under the MIT License.
