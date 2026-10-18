// Google Fonts: a short list to pick from (their full list has no CORS), or any family name typed in.

export const GOOGLE_FONTS: [string, string[]][] = [
  ['ไทย', ['Chakra Petch', 'Bai Jamjuree', 'Krub', 'IBM Plex Sans Thai', 'Taviraj', 'K2D', 'Pridi', 'Anuphan', 'Fahkwang', 'Niramit', 'Charm', 'Chonburi', 'Trirong', 'Pattaya', 'Mali', 'Athiti', 'Kodchasan', 'Noto Serif Thai', 'Maitree', 'KoHo', 'Charmonman', 'Thasadith', 'Srisakdi', 'Playpen Sans Thai']],
  ['อังกฤษ', ['Bebas Neue', 'Montserrat', 'Poppins', 'Oswald', 'Anton', 'Playfair Display', 'Lobster', 'Pacifico', 'Bangers', 'Permanent Marker', 'Archivo Black', 'Righteous', 'Caveat', 'Dancing Script', 'Roboto']],
];

// The font files in a css2 response, Thai and Latin only (a browser gets one file per script). Only Google's own
// font host is accepted, since the URLs come from the network.
export function googleFaces(css: string) {
  return [...css.matchAll(/(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g)]
    .filter(([, subset]) => !subset || subset === 'thai' || subset === 'latin')
    .map(([, , body]) => ({ url: /url\((https:\/\/fonts\.gstatic\.com\/[^)\s]+)\)/.exec(body)?.[1], range: /unicode-range:\s*([^;]+);/.exec(body)?.[1] }))
    .filter((f): f is { url: string; range: string | undefined } => !!f.url);
}
