/* Twelve symbol avatars. No faces and no genders: a colour disc with a simple mark. */
export const AVATARS = ["spark", "leaf", "flame", "wave", "mountain", "moon", "sun", "star", "bolt", "heart", "crown", "paw"];

const GLYPHS = {
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z",
  leaf: "M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19c3-4 6-7 9-9",
  flame: "M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z",
  wave: "M3 9c3-3 5 3 9 0s6 3 9 0M3 15c3-3 5 3 9 0s6 3 9 0",
  mountain: "M3 19l6-11 4 7 3-4 5 8H3z",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
  heart: "M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z",
  crown: "M4 18h16M4 18L3 8l5 4 4-7 4 7 5-4-1 10",
  paw: "M12 12.5c-2.2 0-3 2-4.5 3.2C6.3 16.8 6 17.6 6 18.5 6 19.9 7.1 21 8.5 21c1.3 0 2.3-.8 3.5-.8s2.2.8 3.5.8c1.4 0 2.5-1.1 2.5-2.5 0-.9-.3-1.7-1.5-2.8-1.5-1.2-2.3-3.2-4.5-3.2zM6 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM10 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM14 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
};

export default function Avatar({ name = "?", avatar = "spark", size = 36, className = "" }) {
  const d = GLYPHS[avatar] || GLYPHS.spark;
  return (
    <span className={`avatar ${className}`} style={{ width: size, height: size }} role="img" aria-label={`${name}'s avatar`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: size * 0.56, height: size * 0.56 }}><path d={d} /></svg>
    </span>
  );
}
