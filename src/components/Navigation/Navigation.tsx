import React from 'react'
import clsx from 'clsx'
import { NavLink } from 'react-router'
import Button from 'components/Button/Button'
import { getRouteAccessDecision } from 'components/App/Routes/routeAccess'
import { useAppSelector } from 'store/hooks'
import styles from './Navigation.css'

type NavigationIcon = React.ComponentProps<typeof Button>['icon']

interface NavigationItem {
  label: string
  to: string
  icon: NavigationIcon
  activeIcon?: NavigationIcon
}

const coreItems: NavigationItem[] = [
  { label: 'Library', to: '/library', icon: 'NAV_LIBRARY' },
  { label: 'Queue', to: '/queue', icon: 'NAV_SUBSCRIPTIONS' },
]

const accountItem: NavigationItem = {
  label: 'Account',
  to: '/account',
  icon: 'NAV_ACCOUNT',
  activeIcon: 'NAV_ACCOUNT_ACTIVE',
}

function useCanOpenVisuals (): boolean {
  const { isAdmin, roomId, ownRoomId, userId } = useAppSelector(state => state.user)
  const currentRoomPrefs = useAppSelector((state) => {
    if (typeof state.user.roomId !== 'number') return undefined
    return state.rooms.entities[state.user.roomId]?.prefs
  })

  if (userId === null) return false

  const isRoomOwner = typeof roomId === 'number'
    && typeof ownRoomId === 'number'
    && roomId === ownRoomId

  return getRouteAccessDecision({
    path: '/orchestrator',
    isAdmin,
    isRoomOwner,
    prefs: currentRoomPrefs,
  }).allowed
}

function NavigationLink ({ item }: { item: NavigationItem }) {
  return (
    <NavLink
      to={item.to}
      replace
      aria-label={item.label}
      title={item.label}
      className={({ isActive }) => clsx(styles.navLink, isActive && styles.active)}
    >
      {({ isActive }) => (
        <Button
          icon={isActive && item.activeIcon ? item.activeIcon : item.icon}
          as='span'
          className={styles.navButton}
          animateClassName={styles.btnAnimate}
          cancelAnimation={!isActive}
        >
          <span className={styles.label}>{item.label}</span>
        </Button>
      )}
    </NavLink>
  )
}

const Navigation = React.forwardRef<HTMLDivElement>((_, ref) => {
  const canOpenVisuals = useCanOpenVisuals()
  const items = canOpenVisuals
    ? [...coreItems, { label: 'Visuals', to: '/orchestrator', icon: 'NAV_VISUALS' } satisfies NavigationItem, accountItem]
    : [...coreItems, accountItem]

  return (
    <div className={clsx(styles.container, 'bg-blur')} ref={ref}>
      {items.map(item => (
        <NavigationLink key={item.to} item={item} />
      ))}
    </div>
  )
})

Navigation.displayName = 'Navigation'

export default Navigation
