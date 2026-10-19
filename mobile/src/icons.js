// The editor's own line icons (64 × 64 SVG paths: [stroked, filled]), copied from editor/navart.js.
import React from 'react';
import Svg, { Path } from 'react-native-svg';

const ART = {
  home: ["M10 30L32 10l22 20M16 26v26h32V26M27 52V38h10v14"],
  folder: ["M6 16h18l6 6h28v30H6z"],
  book: ["M8 12h18a6 6 0 0 1 6 6v38a6 6 0 0 0-6-6H8zM56 12H38a6 6 0 0 0-6 6v38a6 6 0 0 1 6-6h18z"],
  gear: ["M23 32a9 9 0 1 0 18 0a9 9 0 1 0 -18 0zM48 32L56 32M43.31 43.31L48.97 48.97M32 48L32 56M20.68 43.31L15.02 48.97M16 32L8 32M20.68 20.68L15.02 15.02M31.99 16L31.99 8M43.31 20.68L48.97 15.02M15 32a17 17 0 1 0 34 0a17 17 0 1 0 -34 0z"],
  plus: ["M32 12v40M12 32h40"],
  play: ["M22 12l28 20-28 20z","M22 12l28 20-28 20z"],
  search: ["M42 42l12 12M13 28a15 15 0 1 0 30 0a15 15 0 1 0 -30 0z"],
  trash: ["M12 18h40M26 18v-6h12v6M16 18l3 36h26l3-36M28 28v18M36 28v18"],
  copy: ["M22 22h30v32H22zM12 42V10h30"],
  edit: ["M40 12l12 12-28 28H12V40zM34 18l12 12"],
  share: ["M32 40V10M20 22l12-12 12 12M14 34v20h36V34"],
  download: ["M32 10v32M20 30l12 12 12-12M12 54h40"],
  upload: ["M32 42V10M20 22l12-12 12 12M12 54h40"],
  back: ["M38 12L18 32l20 20"],
  more: ["","M9 32a5 5 0 1 0 10 0a5 5 0 1 0 -10 0zM27 32a5 5 0 1 0 10 0a5 5 0 1 0 -10 0zM45 32a5 5 0 1 0 10 0a5 5 0 1 0 -10 0z"],
  close: ["M16 16l32 32M48 16L16 48"],
  next: ["M26 12l20 20-20 20"],
  sparkles: ["M30 8l4 14 14 4-14 4-4 14-4-14-14-4 14-4zM50 40l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"],
  gamepad: ["M16 20h32a10 10 0 0 1 10 10l2 14a6 6 0 0 1-11 4l-5-6H20l-5 6a6 6 0 0 1-11-4l2-14a10 10 0 0 1 10-10zM18 31h10M23 26v10","M39 28a3 3 0 1 0 6 0a3 3 0 1 0 -6 0zM45 34a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z"],
  grid: ["M10 10h18v18H10zM36 10h18v18H36zM10 36h18v18H10zM36 36h18v18H36z"],
  check: ["M12 34l14 14 26-30"],
  info: ["M32 28v18M32 18v1M8 32a24 24 0 1 0 48 0a24 24 0 1 0 -48 0z"],
  moon: ["M44 40A20 20 0 0 1 24 14a20 20 0 1 0 26 26z"],
  sun: ["M32 6v6M32 52v6M6 32h6M52 32h6M13 13l4 4M47 47l4 4M13 51l4-4M47 17l4-4M21 32a11 11 0 1 0 22 0a11 11 0 1 0 -22 0z"],
  refresh: ["M50 20a20 20 0 1 0 4 16M50 8v12H38"],
  link: ["M28 36l8-8M24 28l-6 6a8 8 0 0 0 12 12l6-6M40 36l6-6a8 8 0 0 0-12-12l-6 6"],
  help: ["M25 25a7 7 0 1 1 9 7c-2 1-2 3-2 5M32 45v1M8 32a24 24 0 1 0 48 0a24 24 0 1 0 -48 0z"],
  layers: ["M32 8l24 12-24 12L8 20zM8 32l24 12 24-12M8 44l24 12 24-12"],
  code: ["M22 18L8 32l14 14M42 18l14 14-14 14M36 12l-8 40"],
  gem: ["M18 12h28l12 14-26 30L6 26zM6 26h52"],
  rocket: ["M32 6c10 8 14 20 12 34H20C18 26 22 14 32 6zM20 40l-8 10h10M44 40l8 10H42M28 50h8v6h-8z","M28 26a4 4 0 1 0 8 0a4 4 0 1 0 -8 0z"],
  alert: ["M32 8l26 46H6zM32 26v12M32 46v1"],
};

export function Icon({ name, color = '#fff', size = 22 }) {
  const a = ART[name] || ART.help;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {a[0] ? <Path d={a[0]} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {a[1] ? <Path d={a[1]} fill={color} /> : null}
    </Svg>
  );
}
