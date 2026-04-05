export default {
  "expo": {
    "name": "Klassin",
    "slug": "klassin",
    "version": "1.2.1",
    "orientation": "portrait",
    "icon": "./assets/images/icon2.png",
    "scheme": "klassin",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.atul004.klassin",
      "infoPlist": {
        "NSAppTransportSecurity": {
          "NSAllowsArbitraryLoads": true
        }
      }
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/images/KLassin.png"
      },
      "permissions": [
        "android.permission.REQUEST_INSTALL_PACKAGES",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_EXTERNAL_STORAGE"
      ],
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false,
      "package": "com.atul004.klassin",
      "googleServicesFile": process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      "usesCleartextTraffic": true
    },
    "web": {
      "output": "static",
      "favicon": "./assets/images/splash-icon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff",
          "dark": {
            "backgroundColor": "#000000"
          }
        }
      ],
      "@react-native-community/datetimepicker",
      // Custom plugin to ensure singleTask launchMode for Android deep linking
      "./plugins/withSingleTaskAndroidLaunchMode.js"
    ],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    },
    "extra": {
      "router": {},
      "eas": {
        "projectId": "7cc11cd9-774d-4dda-988a-aba00c125c58"
      },
      "fcmConfig": process.env.FCM_JSON || "./fcm.json"
    }
  }
}