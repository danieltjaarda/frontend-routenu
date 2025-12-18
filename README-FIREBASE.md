# Firebase Setup Instructies

## Stap 1: Firebase Project Aanmaken

1. Ga naar [Firebase Console](https://console.firebase.google.com/)
2. Klik op "Add project" of selecteer een bestaand project
3. Volg de wizard om je project aan te maken

## Stap 2: Authentication Inschakelen

1. In Firebase Console, ga naar **Authentication**
2. Klik op **Get Started**
3. Ga naar **Sign-in method** tab
4. Klik op **Email/Password**
5. Schakel **Enable** in en klik **Save**

## Stap 3: Firestore Database Aanmaken

1. In Firebase Console, ga naar **Firestore Database**
2. Klik op **Create database**
3. Kies **Start in test mode** (voor development)
4. Selecteer een locatie (bijv. `europe-west1` voor Nederland)
5. Klik **Enable**

## Stap 4: Firebase Config Ophalen

1. In Firebase Console, ga naar **Project Settings** (⚙️ icoon)
2. Scroll naar beneden naar **Your apps**
3. Klik op het **Web** icoon (`</>`)
4. Registreer je app met een naam (bijv. "RouteNu")
5. Kopieer de Firebase config object

## Stap 5: Environment Variables Instellen

Maak een `.env` bestand in de root van je project:

```env
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_MAPBOX_PUBLIC_TOKEN=your-mapbox-token
```

## Stap 6: Firestore Security Rules (Productie)

Voor productie, update je Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /{collection}/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## Data Structuur

Firestore gebruikt de volgende structuur:

```
users/
  {userId}/
    routes/
      {routeId}/
        - route data
    vehicles/
      {vehicleId}/
        - vehicle data
    orders/
      {orderId}/
        - order data
```

Elke gebruiker heeft zijn eigen sub-collecties voor routes, vehicles en orders.

## Testen

1. Start de app: `npm start`
2. Ga naar `/register` om een account aan te maken
3. Log in met je nieuwe account
4. Alle data wordt nu opgeslagen in Firestore per gebruiker

