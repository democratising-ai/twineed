// =====================================================
// FIREBASE CONFIG & DATABASE SERVICE
// =====================================================

const firebaseConfig = {
    apiKey: "AIzaSyB9ulysv3YQWyLVP1a2lWT70_DBPjMFk8w",
    authDomain: "twineed-26b2f.firebaseapp.com",
    projectId: "twineed-26b2f",
    storageBucket: "twineed-26b2f.firebasestorage.app",
    messagingSenderId: "734189021540",
    appId: "1:734189021540:web:c1b5e2789c2e16385fb271"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

export const AuthService = {
    onAuthStateChanged(callback) {
        auth.onAuthStateChanged(callback);
    },

    getCurrentUserId() {
        return auth?.currentUser?.uid || null;
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
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Not authenticated');
        const snap = await db.collection('stories')
            .where('ownerId', '==', uid)
            .orderBy('updatedAt', 'desc')
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async getAllPublic() {
        if (!auth.currentUser) throw new Error('Not authenticated');
        const snap = await db.collection('stories')
            .orderBy('updatedAt', 'desc')
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async get(id) {
        const doc = await db.collection('stories').doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },

    async create(data) {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Not authenticated');
        const ref = await db.collection('stories').add({
            ...data,
            ownerId: uid,
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
        // Use FieldPath to safely handle passage names with special characters
        const batch = db.batch();
        const docRef = db.collection('stories').doc(storyId);
        Object.keys(data).forEach(key => {
            const fieldPath = new firebase.firestore.FieldPath('passages', passageName, key);
            batch.update(docRef, fieldPath, data[key]);
        });
        batch.update(docRef, 'updatedAt', firebase.firestore.FieldValue.serverTimestamp());
        await batch.commit();
    },

    async deletePassage(storyId, passageName, newStartPassage) {
        const docRef = db.collection('stories').doc(storyId);
        const fieldPath = new firebase.firestore.FieldPath('passages', passageName);
        // Use alternating field/value args for FieldPath support
        const args = [
            fieldPath, firebase.firestore.FieldValue.delete(),
            'updatedAt', firebase.firestore.FieldValue.serverTimestamp()
        ];
        if (newStartPassage !== undefined) {
            args.push('startPassage', newStartPassage);
        }
        await docRef.update(...args);
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
