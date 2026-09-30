// Initials avatar for v1; photo uploads come later (see docs/PLAN.md).
const COLORS = ['#1f7a4d', '#2b6cb0', '#b7791f', '#9b2c2c', '#6b46c1', '#2c7a7b'];

function colorFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase();
}

export function Avatar({ name, photoUrl, size = 40 }: { name: string; photoUrl: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (photoUrl) return <img className="avatar" src={photoUrl} alt="" style={style} />;
  return (
    <span className="avatar" style={{ ...style, background: colorFor(name) }} aria-hidden>
      {initials(name)}
    </span>
  );
}
