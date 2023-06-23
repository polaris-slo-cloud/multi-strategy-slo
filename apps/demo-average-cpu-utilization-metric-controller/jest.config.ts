/* eslint-disable */
export default {
  displayName: 'demo-average-cpu-utilization-metric-controller',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory:
    '../../coverage/apps/demo-average-cpu-utilization-metric-controller',
};
