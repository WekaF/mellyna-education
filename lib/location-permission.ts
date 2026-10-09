export type LocationPermission = 'granted' | 'prompt' | 'denied' | 'unsupported'

// ponytail: tanpa Permissions API (Safari lama) status tidak bisa dibaca → anggap 'prompt', getCurrentPosition yang menentukan.
export async function getLocationPermission(nav: Navigator = navigator): Promise<LocationPermission> {
  if (!nav.geolocation) return 'unsupported'
  if (!nav.permissions?.query) return 'prompt'
  try {
    const status = await nav.permissions.query({ name: 'geolocation' })
    return status.state
  } catch {
    return 'prompt'
  }
}
