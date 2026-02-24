import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs'

import redirects from './redirects.js'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined || process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Externalize pdfjs-dist to avoid bundled worker path issues in server contexts
  // This allows pdfjs-dist to load from node_modules at runtime, where worker paths work correctly
  serverExternalPackages: [
    'pdfjs-dist',
    '@napi-rs/canvas',
    'require-in-the-middle',
    'import-in-the-middle',
  ],
  images: {
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', ''),
        }
      }),
      // Allow localhost with subdomains (e.g., en.localhost, he.localhost)
      {
        protocol: 'http',
        hostname: '*.localhost',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      // Allow Vercel Blob storage for media uploads
      {
        protocol: 'https',
        hostname: '*.blob.vercel-storage.com',
      },
      // Allow YouTube thumbnails for External media
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
    ],
  },
  outputFileTracingExcludes: {
    '*': ['**/node_modules/@swc/core*/**/*'],
  },
  // Include prompt files in serverless bundles (they're loaded via readFileSync)
  outputFileTracingIncludes: {
    '/api/agent/chat': ['./src/infra/llm/prompts/**/*'],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    // Add loader for markdown files
    webpackConfig.module.rules.push({
      test: /\.md$/,
      type: 'asset/source',
    })

    return webpackConfig
  },
  reactStrictMode: true,
  redirects,
}

const configWithPayload = withPayload(nextConfig, { devBundleServerPackages: false })

export default withSentryConfig(configWithPayload, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    reactComponentAnnotation: {
      enabled: true,
    },
    automaticVercelMonitors: true,
  },
})
