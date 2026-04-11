export default ({ config }) => ({
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
      usesCleartextTraffic: true
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
      "./plugins/withSingleTaskAndroidLaunchMode.js"
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
});