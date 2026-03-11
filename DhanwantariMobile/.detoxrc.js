/** @type {import('detox').DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath:
        '/Volumes/SatyBkup/.xcode/DerivedData/DhanwantariMobile-akmdfaybdtwviegfkwzshklyqogw/Build/Products/Debug-iphonesimulator/DhanwantariMobile.app',
      build:
        'xcodebuild -workspace ios/DhanwantariMobile.xcworkspace -scheme DhanwantariMobile -configuration Debug -sdk iphonesimulator -derivedDataPath /Volumes/SatyBkup/.xcode/DerivedData/DhanwantariMobile-akmdfaybdtwviegfkwzshklyqogw build',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 16 Pro',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
  },
};
