import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs'

import redirects from './redirects.js'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined || process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Externalize server-only packages to skip webpack bundling — loaded from node_modules at runtime.
  // This reduces build time and memory by removing ~55 MB from the compilation graph.
  serverExternalPackages: [
    // Original externals
    'pdfjs-dist',
    '@napi-rs/canvas',
    'require-in-the-middle',
    'import-in-the-middle',

    // Genkit + OpenTelemetry/gRPC chain (transitive deps, ~36 MB)
    'genkit',
    'genkitx-openai',
    '@genkit-ai/ai',
    '@genkit-ai/core',
    '@opentelemetry/api',
    '@opentelemetry/core',
    '@opentelemetry/instrumentation',
    '@opentelemetry/otlp-transformer',
    '@opentelemetry/otlp-exporter-base',
    '@opentelemetry/sdk-metrics',
    '@opentelemetry/sdk-trace-base',
    '@opentelemetry/semantic-conventions',
    '@opentelemetry/resources',
    '@grpc/grpc-js',
    '@grpc/proto-loader',
    'protobufjs',
    'thriftrw',

    // Heavy server-only packages
    // graphql — large (~200KB) transitive dep from Payload, load from node_modules at runtime
    'graphql',
    'prism-react-renderer',
    'openai',
    'undici',
    'pdf-lib',
    '@redis/client',
    'redis',
    'handlebars',
    '@modelcontextprotocol/sdk',
    '@google/generative-ai',
    'yaml',
    'ajv',
    'sharp',
    'tesseract.js',
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
      // Allow GitHub avatars for Cody dashboard
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  experimental: {
    // Tree-shake barrel exports to avoid parsing entire packages on each import
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'date-fns',
      '@payloadcms/ui',
      'react-hook-form',
    ],
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
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
  async rewrites() {
    const blobBaseUrl = (process.env.BLOB_PUBLIC_BASE_URL || '').replace(/\/$/, '')
    if (!blobBaseUrl) return []

    return [
      // Rewrite PDF media requests to Blob CDN at the edge (same-origin preserved for PDF.js)
      {
        source: '/api/media/file/:filename(.*\\.pdf$)',
        destination: `${blobBaseUrl}/:filename`,
      },
      {
        source: '/api/exercise-assets/file/:filename(.*\\.pdf$)',
        destination: `${blobBaseUrl}/:filename`,
      },
    ]
  },
  async headers() {
    return [
      // General routes - CSP optimized for Next.js
      // Excludes /api/pdfjs-viewer which needs to be embeddable in same-origin iframes
      {
        source: '/((?!api/pdfjs-viewer).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://www.googletagmanager.com https://cdn.mxpnl.com; style-src 'self' 'unsafe-inline'; img-src 'self' *.blob.vercel-storage.com img.youtube.com avatars.githubusercontent.com github.com *.githubusercontent.com data: blob:; font-src 'self' data: https://r2cdn.perplexity.ai; connect-src 'self' https://*.vercel.app https://vercel.live wss://*.vercel.app https://blob.vercel-storage.com https://*.blob.vercel-storage.com https://api-js.mixpanel.com https://*.mxpnl.com https://www.google-analytics.com; frame-src 'self' www.youtube.com vercel.live; frame-ancestors 'self' https://kody-dashboard-aguy.vercel.app; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
      // Admin routes - permissive CSP (Payload admin requires unsafe-eval)
      {
        source: '/admin/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://cdn.mxpnl.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' *.blob.vercel-storage.com img.youtube.com avatars.githubusercontent.com github.com *.githubusercontent.com data: blob:; font-src 'self' data:; connect-src 'self' *.sentry.io https://blob.vercel-storage.com https://*.blob.vercel-storage.com https://api-js.mixpanel.com https://*.mxpnl.com; frame-src 'self' www.youtube.com vercel.live; frame-ancestors 'self' https://kody-dashboard-aguy.vercel.app; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ]
  },
}

const configWithPayload = withPayload(nextConfig, { devBundleServerPackages: true })

export default withSentryConfig(configWithPayload, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: false,
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    // Disable react component annotation to avoid prerender errors with Client Components
    reactComponentAnnotation: {
      enabled: false,
    },
    automaticVercelMonitors: true,
  },
})
