// =====================================================
// FIREBASE CONFIG & DATABASE SERVICE
// =====================================================

/* global firebase */

let db, auth, googleProvider;
let initPromise = null;

// Initialize Firebase by fetching config from Netlify function
async function initFirebase() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            const response = await fetch('/.netlify/functions/firebaseConfig');
            if (!response.ok) {
                throw new Error('Failed to fetch Firebase config');
            }
            const firebaseConfig = await response.json();

            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            auth = firebase.auth();
            googleProvider = new firebase.auth.GoogleAuthProvider();
        } catch (error) {
            console.error('Firebase initialization error:', error);
            throw error;
        }
    })();

    return initPromise;
}

// Ensure Firebase is initialized before any operation
async function ensureInit() {
    if (!db || !auth) {
        await initFirebase();
    }
}

// =====================================================
// AUTH SERVICE
// =====================================================
export const AuthService = {
    async onAuthStateChanged(callback) {
        await ensureInit();
        return auth.onAuthStateChanged(callback);
    },

    async signInWithEmail(email, password) {
        await ensureInit();
        return auth.signInWithEmailAndPassword(email, password);
    },

    async signUpWithEmail(email, password) {
        await ensureInit();
        return auth.createUserWithEmailAndPassword(email, password);
    },

    async signInWithGoogle() {
        await ensureInit();
        return auth.signInWithPopup(googleProvider);
    },

    async sendPasswordReset(email) {
        await ensureInit();
        return auth.sendPasswordResetEmail(email);
    },

    async signOut() {
        await ensureInit();
        return auth.signOut();
    },

    getErrorMessage(code) {
        const messages = {
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/email-already-in-use': 'An account with this email already exists',
            'auth/weak-password': 'Password should be at least 6 characters',
            'auth/invalid-email': 'Please enter a valid email address',
            'auth/too-many-requests': 'Too many attempts. Please try again later',
            'auth/network-request-failed': 'Network error. Please check your connection',
            'auth/invalid-credential': 'Invalid email or password'
        };
        return messages[code] || 'An error occurred. Please try again';
    }
};

// =====================================================
// STORY DATABASE SERVICE
// =====================================================
export const StoryDB = {
    async getAll() {
        await ensureInit();
        const snap = await db.collection('stories').orderBy('updatedAt', 'desc').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async get(id) {
        await ensureInit();
        const doc = await db.collection('stories').doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },

    async create(data) {
        await ensureInit();
        const ref = await db.collection('stories').add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return ref.id;
    },

    async update(id, data) {
        await ensureInit();
        await db.collection('stories').doc(id).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    async delete(id) {
        await ensureInit();
        await db.collection('stories').doc(id).delete();
    },

    async updatePassage(storyId, passageName, data) {
        await ensureInit();
        const updates = {};
        Object.keys(data).forEach(key => {
            updates[`passages.${passageName}.${key}`] = data[key];
        });
        updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('stories').doc(storyId).update(updates);
    },

    async deletePassage(storyId, passageName) {
        await ensureInit();
        await db.collection('stories').doc(storyId).update({
            [`passages.${passageName}`]: firebase.firestore.FieldValue.delete(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    async setPassages(storyId, passages, startPassage) {
        await ensureInit();
        const update = {
            passages,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (startPassage !== undefined) {
            update.startPassage = startPassage;
        }
        await db.collection('stories').doc(storyId).update(update);
    }
};

// Initialize Firebase when module loads
initFirebase().catch(console.error);
