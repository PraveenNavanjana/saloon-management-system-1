// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD8avogkqZAkhJjpa39QNtjDh9tgYUR4mY",
  authDomain: "saloon-managemnt.firebaseapp.com",
  projectId: "saloon-managemnt",
  storageBucket: "saloon-managemnt.firebasestorage.app",
  messagingSenderId: "543061434894",
  appId: "1:543061434894:web:e0dd3319fd01fc0633525f"
};

export default firebaseConfig;

// Initialize Firebase
const app = initializeApp(firebaseConfig);