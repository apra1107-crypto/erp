export default ({ config }) => {
  const isDev = process.env.IS_DEV_BUILD === 'true';
  
  return {
    expo: {
      name: "Klassin",
      slug: "klassin",
      version: "1.2.1",
      orientation: "portrait",
      icon: "./assets/images/icon2.png",
      scheme: "klassin",
      userInterfaceStyle: "automatic",
      newArchEnabled: true,
      ios: {
        supportsTablet: true,
        bundleIdentifier: "com.atul004.klassin",
        infoPlist: {
          NSAppTransportSecurity: {
            NSAllowsArbitraryLoads: true
          }
        }
      },
      android: {
        adaptiveIcon: {
          backgroundColor: "#E6F4FE",
          foregroundImage: "./assets/images/KLassin.png"
        },
        permissions: [
          "android.permission.REQUEST_INSTALL_PACKAGES",
          "android.permission.WRITE_EXTERNAL_STORAGE",
          "android.permission.READ_EXTERNAL_STORAGE"
        ],
        edgeToEdgeEnabled: true,
        predictiveBackGestureEnabled: false,
        package: "com.atul004.klassin",
        googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
        usesCleartextTraffic: true,
        jsEngine: "hermes"
      },
      web: {
        output: "static",
        favicon: "./assets/images/splash-icon.png"
      },
      plugins: [
        "expo-router",
        [
          "expo-splash-screen",
          {
            image: "./assets/images/splash-icon.png",
            imageWidth: 200,
            resizeMode: "contain",
            backgroundColor: "#ffffff",
            dark: {
              backgroundColor: "#000000"
            }
          }
        ],
        "@react-native-community/datetimepicker",
        "./plugins/withSingleTaskAndroidLaunchMode.js",
        [
          "expo-build-properties",
          {
            android: {
              enableProguardInReleaseBuilds: true,
              enableShrinkResourcesInReleaseBuilds: true,
              // FORCE ONLY ONE ARCHITECTURE (Saves ~70MB)
              abiFilters: ["arm64-v8a"],
              extraProguardRules: "-keep class com.facebook.react.bridge.** { *; }"
            }
          }
        ]
      ],
      experiments: {
        typedRoutes: true,
        reactCompiler: true
      },
      extra: {
        router: {},
        eas: {
          projectId: "83267f08-5f41-4c51-9e3d-b9516ccd28f4"
        },
        fcmConfig: "./fcm.json"
      }
    }
  };
};