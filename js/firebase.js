// =====================================================
// FIREBASE CONFIG & DATABASE SERVICE
// =====================================================

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
            // Reset so next call retries instead of returning the rejected promise
            initPromise = null;
            console.error('Firebase initialization error:', error);
            throw error;
        }
    })();

    return initPromise;
}
async function ensureInit() {
    if (!db || !auth) {
        await initFirebase();
    }
}

export const AuthService = {
    onAuthStateChanged(callback) {
        ensureInit().then(() => auth.onAuthStateChanged(callback))
            .catch(err => {
                console.error('Auth init failed:', err);
                callback(null);
            });
    },

    getCurrentUserId() {
        return auth?.currentUser?.uid || null;
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
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Not authenticated');
        const snap = await db.collection('stories')
            .where('ownerId', '==', uid)
            .orderBy('updatedAt', 'desc')
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async get(id) {
        await ensureInit();
        const doc = await db.collection('stories').doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },

    async create(data) {
        await ensureInit();
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
        await ensureInit();
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

initFirebase().catch(console.error);
