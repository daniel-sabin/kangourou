import '@testing-library/jest-dom/vitest'

// jsdom has no layout engine; TanStack Virtual needs ResizeObserver to exist.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver)

// jsdom reports 0×0 for every element, so the virtualizer would render no rows; give elements a viewport-like size.
Object.defineProperties(HTMLElement.prototype, {
  offsetHeight: { configurable: true, get: () => 600 },
  offsetWidth: { configurable: true, get: () => 1000 },
})
