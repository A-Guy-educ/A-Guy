export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation only changes
        'style', // Changes that don't affect code meaning (white-space, formatting, etc)
        'refactor', // Code change that neither fixes a bug nor adds a feature
        'perf', // Performance improvements
        'test', // Adding missing tests or correcting existing tests
        'build', // Changes that affect the build system or external dependencies
        'ci', // Changes to CI configuration files and scripts
        'chore', // Other changes that don't modify src or test files
        'revert', // Reverts a previous commit
        'security', // Security-related changes
      ],
    ],
    'body-min-length': [2, 'always', 20], // Require at least 20 characters in commit body
    'body-empty': [2, 'never'], // Body must not be empty
    'subject-case': [2, 'always', 'sentence-case'], // Use sentence case for subject
    'header-max-length': [2, 'always', 100], // Max 100 characters for header
    'subject-empty': [2, 'never'], // Subject cannot be empty
    'subject-full-stop': [2, 'never', '.'], // No period at end of subject
    'body-max-line-length': [0], // Disable - automated agents generate long body lines
  },
}
