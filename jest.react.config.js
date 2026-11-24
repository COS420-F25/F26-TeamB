const baseConfig = require("./jest.config");
module.exports = {...baseConfig, testEnvironment: "jsdom",
    globals: {"ts-jest": { tsconfig: { jsx: "react-jsx", target: "ES2022",}}}
};