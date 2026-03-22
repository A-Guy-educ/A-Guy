#!/bin/bash
# Storybook Setup Script
# Run this script to install and configure Storybook for the A-Guy design system

set -e

echo "📦 Installing Storybook..."

# Install Storybook core packages
pnpm add -D @storybook/react @storybook/react-vite @storybook/addon-essentials @storybook/addon-interactions @storybook/addon-themes @storybook/nextjs storybook

# Initialize Storybook (creates .storybook/ directory if missing)
# Note: This may prompt for configuration options
# pnpm exec storybook@latest init

echo ""
echo "✅ Storybook installed!"
echo ""
echo "Next steps:"
echo "  1. Review .storybook/main.ts configuration"
echo "  2. Review .storybook/preview.ts configuration"
echo "  3. Add stories for your components (see button.stories.tsx as example)"
echo "  4. Run 'pnpm storybook' to start the Storybook dev server"
echo ""
echo "See .storybook/ directory for configuration files."