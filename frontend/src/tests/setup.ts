import '@testing-library/jest-dom';

// Polyfill ResizeObserver for Recharts in jsdom
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserver;
