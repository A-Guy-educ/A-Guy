# Security Guidelines

## API Key Protection

### 🔒 Current Protections

This project has **multiple layers of protection** to prevent API keys from being leaked:

1. **`.gitignore`**: `.env` file is ignored by git
2. **`.gitattributes`**: Extra filter for `.env` files
3. **`.env.example`**: Template file with placeholder values (safe to commit)
4. **Pre-commit hook**: Automatically checks for:
   - Attempts to commit `.env` file
   - API keys in staged files (detects `AIzaSy...` pattern)

### 🛡️ What This Means

- Your `.env` file with real API keys will **NEVER** be committed to git
- If you accidentally try to commit it, the pre-commit hook will **block it**
- If you accidentally paste an API key in code, the hook will **warn you**

### ⚙️ Setup Instructions

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Add your real API keys to `.env`:

   ```bash
   GEMINI_API_KEY=your-actual-key-here
   ```

3. **NEVER** commit `.env` - only commit `.env.example`

### 🚨 If Your API Key Gets Leaked

If your API key accidentally gets pushed to GitHub:

1. **Immediately revoke the key** in [Google AI Studio](https://aistudio.google.com/app/apikey)
2. **Generate a new key**
3. **Update your `.env` file** with the new key
4. **Remove the key from git history**:
   ```bash
   # Use git-filter-repo or BFG Repo-Cleaner
   # Or if it's recent, do an interactive rebase
   git rebase -i HEAD~5  # Adjust number as needed
   ```

### ✅ Pre-commit Hook Testing

The pre-commit hook will automatically run when you commit. To test it manually:

```bash
# This will run the secret check
.husky/check-secrets
```

**Example - Blocked commit**:

```bash
$ git add .env
$ git commit -m "test"
❌ ERROR: Attempting to commit .env file!
The .env file should NEVER be committed to git.
Please unstage it with: git reset HEAD .env
```

### 🔐 Additional Security Best Practices

1. **Use environment-specific keys**: Different keys for dev/staging/prod
2. **Rotate keys regularly**: Change API keys every few months
3. **Monitor usage**: Check Google AI Studio for unexpected usage spikes
4. **Enable billing alerts**: Set spending limits in Google Cloud Console
5. **Use secret management**: For production, use services like:
   - Vercel Environment Variables
   - AWS Secrets Manager
   - HashiCorp Vault

### 📝 For Deployment

When deploying to production (Vercel, etc.):

1. **DO NOT** commit `.env` to git
2. **DO** set environment variables in your hosting platform:
   - Vercel: Settings → Environment Variables
   - Netlify: Site settings → Build & deploy → Environment
   - Railway: Variables tab
3. **DO** use different API keys for production vs development

### 🎯 Current Status

- ✅ `.env` is in `.gitignore`
- ✅ `.env.example` has placeholder values
- ✅ Pre-commit hook checks for secrets
- ✅ `.gitattributes` provides extra protection
- ✅ API key is configured in `.env` (not committed)

**Your API keys are safe!** 🎉
