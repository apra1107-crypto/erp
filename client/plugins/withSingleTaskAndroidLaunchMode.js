const { withAndroidManifest } = require('@expo/config-plugins');

function withSingleTaskAndroidLaunchMode(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults.manifest.application[0].activity[0].$['android:launchMode'] = 'singleTask';
    return config;
  });
}

module.exports = withSingleTaskAndroidLaunchMode;