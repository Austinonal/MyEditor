const P: Record<string, string> = {
  plus: 'M12 5v14M5 12h14', back: 'M15 18l-6-6 6-6', play: 'M6 4l14 8-14 8z', pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  check: 'M20 6L9 17l-5-5', x: 'M18 6L6 18M6 6l12 12', trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6', undo: 'M3 7v6h6M3 13a9 9 0 1 0 3-7',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z', film: 'M3 3h18v18H3zM7 3v18M17 3v18M3 8h4M17 8h4M3 16h4M17 16h4',
  wand: 'M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5',
  scissors: 'M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  image: 'M3 3h18v18H3zM9 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM21 15l-5-5L5 21', alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  magnet: 'M6 15a6 6 0 0 0 12 0V3h-4v12a2 2 0 0 1-4 0V3H6zM6 8h4M14 8h4', ripple: 'M3 12h4M17 12h4M12 3v4M12 17v4M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  zin: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M11 8v6M8 11h6', zout: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M8 11h6',
}
export const Icon = ({ n }: { n: keyof typeof P | string }) => <svg aria-hidden="true" viewBox="0 0 24 24"><path d={P[n]} /></svg>
