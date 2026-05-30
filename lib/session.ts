import { cache } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export const getSession = cache(() => getServerSession(authOptions))
