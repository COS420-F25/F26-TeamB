module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "CommonJS",
          jsx: "react-jsx",
          target: "ES2022",
        },
      },
    ],
  },
};