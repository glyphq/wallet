module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "body-empty": [0],
    "header-case": [0],
    "scope-case": [2, "always", "lower-case"],
    "scope-empty": [0],
    "subject-case": [0],
    "body-max-line-length": [0],
  },
};
