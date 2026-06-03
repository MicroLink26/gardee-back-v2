import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    '^.+\\.js$': 'ts-jest',
  },
  transformIgnorePatterns: ['/node_modules/(?!(nanoid)/)'],
  collectCoverageFrom: [
    'src/config/**/*.ts',
    'src/controllers/**/*.ts',
    'src/services/**/*.ts',
    'src/middlewares/**/*.ts',
    'src/utils/**/*.ts',
    '!src/**/__tests__/**',
  ],
};

export default config;
