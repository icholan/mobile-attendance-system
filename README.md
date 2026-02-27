# Face Recognition Mobile App

A cross-platform **React Native (Expo)** mobile application with a **Node.js backend** for face registration and marking attendance via face recognition.

## Features

- **Face Registration**: Capture a photo and register a face structure on the server.
- **Mark Attendance**: Scan a face using the mobile camera to match against registered profiles and mark attendance.
- **Visual & Audio Feedback**: Face guide overlay on the camera screen and a success beep upon successful attendance.
- **Cross-Platform**: Works on iOS and Android devices via Expo.

## Project Structure

This repository is divided into two main components:

- `server/`: The backend Express.js server providing API endpoints, face recognition using `face-api.js`, and local JSON data storage.
- `mobile/`: The Expo-based React Native mobile app containing the UI, camera integeration, and API client.

## Technologies Used

- **Frontend**: React Native, Expo, React Navigation, Expo Camera, Expo AV
- **Backend**: Node.js, Express, `face-api.js`, `@napi-rs/canvas`

## Prerequisites

- Node.js installed on your machine.
- `npm` or `yard` installed.
- **Expo Go** app installed on your physical mobile device (or iOS/Android Emulators setup on your machine).

## Setup & Installation

### 1. Backend Server Setup

Navigate to the `server` directory and install the dependencies:

```bash
cd server
npm install
```

The server depends on pre-trained face recognition models. Ensure the models are downloaded by running:
```bash
npm run download-models
```

Start the backend server:
```bash
npm start
```
The server will run on `http://localhost:3000` (or `http://0.0.0.0:3000`).

### 2. Mobile App Setup

Navigate to the `mobile` directory and install the dependencies:

```bash
cd mobile
npm install
```

#### Important: Update the API URL

To run on a physical device, the mobile app needs connection to your backend server via your machine's local IP address. 

1. Find your machine's local IP (e.g., `192.168.x.x`). You can use `ifconfig | grep "inet " | grep -v 127.0.0.1` on macOS/Linux or `ipconfig` on Windows.
2. Edit `mobile/src/config.js` to return your IP address:

```javascript
// mobile/src/config.js
export const getBaseUrl = () => {
  return 'http://192.168.x.x:3000'; // Replace with your actual IP address
};
```

### 3. Run the Mobile App

Start the Expo development server:

```bash
npx expo start
```

- Scan the generated QR code with **Expo Go** (Android) or your default **Camera app** (iOS) on your physical device.
- Press `i` to open in the iOS simulator.
- Press `a` to open in the Android emulator.
