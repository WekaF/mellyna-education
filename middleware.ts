import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const role = req.nextauth.token?.role

    if (pathname.startsWith('/admin') && role !== 'SUPER_ADMIN')
      return NextResponse.redirect(new URL('/login', req.url))

    if (pathname.startsWith('/tutor') && role !== 'TUTOR' && role !== 'SUPER_ADMIN')
      return NextResponse.redirect(new URL('/login', req.url))

    if (pathname.startsWith('/parent') && role !== 'PARENT' && role !== 'SUPER_ADMIN')
      return NextResponse.redirect(new URL('/login', req.url))

    return NextResponse.next()
  },
  { callbacks: { authorized: ({ token }) => !!token } }
)

export const config = {
  matcher: ['/admin/:path*', '/tutor/:path*', '/parent/:path*'],
}
