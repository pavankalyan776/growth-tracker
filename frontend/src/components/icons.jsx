// Small hand-drawn icon set (24x24, stroke). One component so every icon shares sizing and stroke.
const PATHS = {
  gate: "M5 21V10a7 7 0 0 1 14 0v11M9 21v-8a3 3 0 0 1 6 0v8M3 21h18",
  calendar: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 13h2M12 13h2M8 17h2",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  bag: "M6 8h12l1 12H5L6 8zM9 8V7a3 3 0 0 1 6 0v1",
  trophy: "M8 4h8v6a4 4 0 0 1-8 0V4zM8 6H4v1a3 3 0 0 0 3 3M16 6h4v1a3 3 0 0 1-3 3M12 14v4M8 21h8M10 18h4",
  list: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  shield: "M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3zM9 12l2 2 4-4",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  flame: "M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z",
  coin: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M9.5 9.5C9.5 8.4 10.6 8 12 8s2.5.6 2.5 1.7S13.4 11.4 12 11.8s-2.5.8-2.5 2 1.1 1.7 2.5 1.7 2.5-.4 2.5-1.5",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
  logout: "M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M19 12H9",
  check: "M5 12.5l4.5 4.5L19 7.5",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  chevronLeft: "M15 5l-7 7 7 7",
  chevronRight: "M9 5l7 7-7 7",
  chevronDown: "M5 9l7 7 7-7",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff: "M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.7M6.6 7.6C3.9 9.4 2 12 2 12s4 7 10 7c1.5 0 2.9-.4 4.1-1M10 10a3 3 0 0 0 4 4",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
  menu: "M4 7h16M4 12h16M4 17h16",
  alert: "M12 9v4M12 17h.01M10.3 4.2L2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3l-7.5-13.3a2 2 0 0 0-3.4 0z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 4a4 4 0 0 1 0 7M22 21a7 7 0 0 0-5-6.7",
  log: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  edit: "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  swords: "M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2",
  skull: "M12 3a8 8 0 0 0-5 14v3h10v-3a8 8 0 0 0-5-14zM9 12h.01M15 12h.01M10 20v-3M14 20v-3",
};

export default function Icon({ name, className = "", title, ...rest }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg className={`icon ${className}`} viewBox="0 0 24 24" aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined} {...rest}>
      {title ? <title>{title}</title> : null}
      <path d={d} />
    </svg>
  );
}
