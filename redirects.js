const redirects = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header',
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  const codyRedirect = {
    source: '/cody/:path*',
    destination: 'https://cody-aguy.vercel.app/cody/:path*',
    permanent: false,
  }

  const redirects = [internetExplorerRedirect, codyRedirect]

  return redirects
}

export default redirects
