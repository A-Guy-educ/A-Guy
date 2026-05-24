Fixed Prettier formatting issue in kody.config.json that was failing the CI "Fast Gate" check.

Changes: Prettier collapsed single-element arrays to one line (e.g., `["aguyaharonyair"]` instead of multi-line) and added the missing trailing newline at end of file.

No other files or code were modified.
