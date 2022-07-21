module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.eslint.json"],
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  env: { es2020: true, node: true },
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        vars: "all",
        args: "all",
        argsIgnorePattern: "^_",
        ignoreRestSiblings: true,
        caughtErrors: "all",
      },
    ],
    "@typescript-eslint/require-await": "off",
    "no-console": "warn",
  },
  ignorePatterns: ["dist"],
};
