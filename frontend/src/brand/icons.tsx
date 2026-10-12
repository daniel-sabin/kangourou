import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function icon(paths: React.ReactNode) {
  return function Icon({ size = 14, ...rest }: IconProps) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
        {paths}
      </svg>
    )
  }
}

export const IconPlus = icon(<path d="M8 3.5v9M3.5 8h9" />)
export const IconClose = icon(<path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />)
export const IconRefresh = icon(<><path d="M13 8a5 5 0 1 1-1.6-3.7" /><path d="M13 2.8v2.6h-2.6" /></>)
export const IconPlay = icon(<path d="M5 3.5v9l7.5-4.5z" fill="currentColor" />)
export const IconPlayAll = icon(<><path d="M3 4v8l5-4z" fill="currentColor" /><path d="M8.5 4v8l5-4z" fill="currentColor" /></>)
export const IconStop = icon(<rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" />)
export const IconEdit = icon(<path d="M10.5 3l2.5 2.5L6 12.5H3.5V10z" />)
export const IconSearch = icon(<><circle cx="7" cy="7" r="4" /><path d="M10 10l3 3" /></>)
export const IconTable = icon(<><rect x="2.5" y="3" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M6.5 6.5V13" /></>)
export const IconEye = icon(<><path d="M1.8 8S4 3.8 8 3.8 14.2 8 14.2 8 12 12.2 8 12.2 1.8 8 1.8 8z" /><circle cx="8" cy="8" r="1.8" /></>)
export const IconTerminal = icon(<><rect x="2" y="3" width="12" height="10" rx="2" /><path d="M5 6.5L7 8l-2 1.5M8.5 10h2.5" /></>)
export const IconPlug = icon(<><path d="M6 2.5v3M10 2.5v3" /><path d="M4.5 5.5h7v2a3.5 3.5 0 0 1-7 0z" /><path d="M8 11v2.5" /></>)
export const IconChevronLeft = icon(<path d="M10 3.5L5.5 8l4.5 4.5" />)
export const IconChevronRight = icon(<path d="M6 3.5L10.5 8 6 12.5" />)
export const IconCopy = icon(<><rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.6" /><path d="M10.5 3H4.6A1.6 1.6 0 0 0 3 4.6v5.9" /></>)
export const IconLink = icon(<path d="M6.5 9.5l3-3M7 4.6l1-1a2.6 2.6 0 0 1 3.7 3.7l-1 1M9 11.4l-1 1a2.6 2.6 0 0 1-3.7-3.7l1-1" />)
