"use client";

// Lazy-loaded Firestore instance
let firestoreDb = null;

// Get or initialize Firestore lazily
async function getFirestoreDb() {
    if (firestoreDb) return firestoreDb;

    const [{ initializeApp, getApps }, { getFirestore }] = await Promise.all([
        import("firebase/app"),
        import("firebase/firestore")
    ]);

    const firebaseConfig = (await import("./firebase.config")).default;
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    firestoreDb = getFirestore(app);
    return firestoreDb;
}

// Save a favorite item (college or exam)
export async function saveFavorite(userId, item) {
    if (!userId || !item?.id) return;

    const { doc, setDoc, arrayUnion } = await import("firebase/firestore");
    const db = await getFirestoreDb();
    const userRef = doc(db, "users", userId);
    const type = item.type === "exam" ? "favoriteExams" : "favoriteColleges";

    try {
        await setDoc(userRef, {
            [type]: arrayUnion(item)
        }, { merge: true });
        return true;
    } catch (error) {
        console.error("Error saving favorite:", error);
        throw error;
    }
}

// Remove a favorite item
export async function removeFavorite(userId, itemId, type) {
    if (!userId || !itemId) return;

    const { doc, getDoc, updateDoc, arrayRemove } = await import("firebase/firestore");
    const db = await getFirestoreDb();
    const userRef = doc(db, "users", userId);
    const fieldName = type === "exam" ? "favoriteExams" : "favoriteColleges";

    try {
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const list = data[fieldName] || [];
            const itemToRemove = list.find(i => i.id === itemId);

            if (itemToRemove) {
                await updateDoc(userRef, {
                    [fieldName]: arrayRemove(itemToRemove)
                });
            }
        }
        return true;
    } catch (error) {
        console.error("Error removing favorite:", error);
        throw error;
    }
}

// Get all user favorites
export async function getUserFavorites(userId) {
    if (!userId) return { colleges: [], exams: [] };

    const { doc, getDoc } = await import("firebase/firestore");
    const db = await getFirestoreDb();
    const userRef = doc(db, "users", userId);

    try {
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                colleges: data.favoriteColleges || [],
                exams: data.favoriteExams || []
            };
        }
        return { colleges: [], exams: [] };
    } catch (error) {
        console.error("Error fetching favorites:", error);
        return { colleges: [], exams: [] };
    }
}

// Subscribe to user favorites (Real-time)
export async function subscribeToFavorites(userId, callback) {
    if (!userId) return () => { };

    const { doc, onSnapshot } = await import("firebase/firestore");
    const db = await getFirestoreDb();
    const userRef = doc(db, "users", userId);

    return onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            callback({
                colleges: data.favoriteColleges || [],
                exams: data.favoriteExams || []
            });
        } else {
            callback({ colleges: [], exams: [] });
        }
    }, (error) => {
        console.error("Error subscribing to favorites:", error);
    });
}

// Sync local favorites to Firestore
export async function syncLocalFavorites(userId) {
    if (!userId) return;

    const localFavorites = JSON.parse(localStorage.getItem("cei_favorites") || '{"colleges":[],"exams":[]}');
    const hasLocalData = localFavorites.colleges.length > 0 || localFavorites.exams.length > 0;

    if (hasLocalData) {
        const { doc, setDoc, arrayUnion } = await import("firebase/firestore");
        const db = await getFirestoreDb();
        const userRef = doc(db, "users", userId);

        const batch = {};
        if (localFavorites.colleges.length > 0) {
            batch.favoriteColleges = arrayUnion(...localFavorites.colleges);
        }
        if (localFavorites.exams.length > 0) {
            batch.favoriteExams = arrayUnion(...localFavorites.exams);
        }

        try {
            await setDoc(userRef, batch, { merge: true });
            localStorage.removeItem("cei_favorites");
            return true;
        } catch (error) {
            console.error("Error syncing favorites:", error);
        }
    }
    return false;
}

// Export lazy getter for other modules
export { getFirestoreDb as db };
