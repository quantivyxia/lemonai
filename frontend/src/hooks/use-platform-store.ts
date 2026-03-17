import { useContext } from 'react'

import { PlatformStoreContext } from '@/app/state/platform-store'

export const usePlatformStore = () => {
  const context = useContext(PlatformStoreContext)
  if (!context) {
    throw new Error('usePlatformStore must be used within PlatformStoreProvider')
  }
  return context
}
