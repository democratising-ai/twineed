// =====================================================
// FIREBASE CONFIG & DATABASE SERVICE
// =====================================================

// Import config from separate file (git-ignored)
import { firebaseConfig } from './config.js';

/* global firebase */

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// =====================================================
// AUTH SERVICE
// =====================================================
export const AuthService = {
    onAuthStateChanged(callback) {
        return auth.onAuthStateChanged(callback);
    },

    async signInWithEmail(email, password) {
        return auth.signInWithEmailAndPassword(email, password);
    },

    async signUpWithEmail(email, password) {
        return auth.createUserWithEmailAndPassword(email, password);
    },

    async signInWithGoogle() {
        return auth.signInWithPopup(googleProvider);
    },

    async sendPasswordReset(email) {
        return auth.sendPasswordResetEmail(email);
    },

    async signOut() {
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
        const snap = await db.collection('stories').orderBy('updatedAt', 'desc').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async get(id) {
        const doc = await db.collection('stories').doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },

    async create(data) {
        const ref = await db.collection('stories').add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return ref.id;
    },

    async update(id, data) {
        await db.collection('stories').doc(id).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    async delete(id) {
        await db.collection('stories').doc(id).delete();
    },

    async updatePassage(storyId, passageName, data) {
        const updates = {};
        Object.keys(data).forEach(key => {
            updates[`passages.${passageName}.${key}`] = data[key];
        });
        updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('stories').doc(storyId).update(updates);
    },

    async deletePassage(storyId, passageName) {
        await db.collection('stories').doc(storyId).update({
            [`passages.${passageName}`]: firebase.firestore.FieldValue.delete(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    async setPassages(storyId, passages, startPassage) {
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
