import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyCMsya2FFfRRRCZNgp6KyqULhfKhh8YB_A",
  authDomain: "money-tracking-93138.firebaseapp.com",
  projectId: "money-tracking-93138",
  storageBucket: "money-tracking-93138.firebasestorage.app",
  messagingSenderId: "496332180242",
  appId: "1:496332180242:web:9b7b5e16724808f4d141cb",
  measurementId: "G-5N6KPBRS8K"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
