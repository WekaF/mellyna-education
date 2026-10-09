import { getLocationPermission } from '@/lib/location-permission'

const geo = {} as Geolocation

function navWith(permissions?: unknown, geolocation: unknown = geo) {
  return { geolocation, permissions } as unknown as Navigator
}

describe('getLocationPermission', () => {
  it('returns unsupported when browser has no geolocation', async () => {
    expect(await getLocationPermission(navWith(undefined, null))).toBe('unsupported')
  })

  it('returns prompt when Permissions API is missing (old Safari)', async () => {
    expect(await getLocationPermission(navWith(undefined))).toBe('prompt')
  })

  it.each(['granted', 'prompt', 'denied'] as const)('returns %s from Permissions API', async (state) => {
    const nav = navWith({ query: jest.fn().mockResolvedValue({ state }) })
    expect(await getLocationPermission(nav)).toBe(state)
  })

  it('queries geolocation permission by name', async () => {
    const query = jest.fn().mockResolvedValue({ state: 'granted' })
    await getLocationPermission(navWith({ query }))
    expect(query).toHaveBeenCalledWith({ name: 'geolocation' })
  })

  it('returns prompt when query throws', async () => {
    const nav = navWith({ query: jest.fn().mockRejectedValue(new TypeError('unsupported name')) })
    expect(await getLocationPermission(nav)).toBe('prompt')
  })
})
