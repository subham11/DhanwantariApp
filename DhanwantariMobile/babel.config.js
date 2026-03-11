module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          '@features': './src/features',
          '@store': './src/store',
          '@components': './src/components',
          '@navigation': './src/navigation',
          '@theme': './src/theme',
          '@hooks': './src/hooks',
          '@utils': './src/utils',
          '@services': './src/services',
          '@assets': './src/assets',
          '@ai': './src/ai',
          '@retrieval': './src/retrieval',
          '@cloud': './src/cloud',
          '@config': './src/config',
        },
      },
    ],
    'react-native-reanimated/plugin',
  ],
};
