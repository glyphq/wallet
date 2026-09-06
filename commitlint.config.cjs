module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "body-empty": [2, "always"],
    "header-case": [2, "always", "lower-case"],
    "scope-case": [2, "always", "lower-case"],
    "scope-empty": [2, "never"],
    "subject-case": [2, "always", "lower-case"],
  },
};
