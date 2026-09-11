import { useId, type SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      {...props}
    />
  );
}

export function QuodexMark({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4.4 8.2a7.6 7.6 0 1 1 0 7.6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M8.6 12a3.4 3.4 0 1 1 1 2.4"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function QuodexAppIcon({ size = 32 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill={`url(#${id})`} />
      <defs>
        <linearGradient id={id} x1="4" y1="2" x2="30" y2="30">
          <stop stopColor="#1677FF" />
          <stop offset="1" stopColor="#3B6AE8" />
        </linearGradient>
      </defs>
      <path
        d="M7.2 11.4a9.2 9.2 0 1 1 0 9.2"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M12.2 16a3.8 3.8 0 1 1 1.15 2.7"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WindowsLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="8.2" height="8.2" rx="0.6" fill="currentColor" />
      <rect x="12.8" y="3" width="8.2" height="8.2" rx="0.6" fill="currentColor" />
      <rect x="3" y="12.8" width="8.2" height="8.2" rx="0.6" fill="currentColor" />
      <rect x="12.8" y="12.8" width="8.2" height="8.2" rx="0.6" fill="currentColor" />
    </svg>
  );
}

export function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16.4 20.2 20.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function TaskViewIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect x="3.5" y="5.5" width="10" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10.5" y="10.5" width="10" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

export function ExplorerIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 10.5 8.4 7h6.2l1.7 2.2H28v14.2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10.5Z" fill="#F7D44A" />
      <path d="M4 13.2h24v12.2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V13.2Z" fill="#E6B93A" />
      <path d="M4 13.2h24v2.2H4z" fill="#F3C94A" />
    </svg>
  );
}

export function SettingsGlyph({ size = 28 }: { size?: number }) {
  const id = useId();
  const teeth = Array.from({ length: 8 }, (_, i) => {
    const a = ((-90 + i * 45) * Math.PI) / 180;
    return { cx: 16 + Math.cos(a) * 10.35, cy: 16 + Math.sin(a) * 10.35 };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-ring`} cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#F7F7F7" />
          <stop offset="70%" stopColor="#E4E4E4" />
          <stop offset="100%" stopColor="#D4D4D4" />
        </radialGradient>
      </defs>
      <g fill="#8B9299">
        <circle cx="16" cy="16" r="10.15" />
        {teeth.map((tooth) => (
          <circle key={`${tooth.cx}-${tooth.cy}`} cx={tooth.cx} cy={tooth.cy} r="5.2" />
        ))}
      </g>
      <circle cx="16" cy="16" r="7.35" fill={`url(#${id}-ring)`} />
      <circle cx="16" cy="16" r="4.55" fill="#0A5AA8" />
    </svg>
  );
}

export function RecycleIcon({ size = 32 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bin`} x1="8" y1="8" x2="24" y2="28">
          <stop offset="0%" stopColor="#F7FBFF" />
          <stop offset="55%" stopColor="#E8EEF4" />
          <stop offset="100%" stopColor="#D5DDE6" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="8" y1="7" x2="24" y2="12">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#DCE3EB" />
        </linearGradient>
      </defs>
      <path d="M9.6 11.2h12.8l-1.35 15.05a1.8 1.8 0 0 1-1.79 1.55h-6.52a1.8 1.8 0 0 1-1.79-1.55L9.6 11.2Z" fill={`url(#${id}-bin)`} />
      <path d="M10.15 11.2h11.7l-.35 2.2H10.5z" fill="#C9D3DE" opacity="0.55" />
      <path d="M8.7 9.55h14.6c.45 0 .72.42.6.84l-.55 1.85H9.65l-.55-1.85a.62.62 0 0 1 .6-.84Z" fill={`url(#${id}-rim)`} />
      <path d="M11.4 9.55h9.2l-.25-1.15a.7.7 0 0 0-.68-.55h-7.34a.7.7 0 0 0-.68.55L11.4 9.55Z" fill="#EEF3F8" />
      <g fill="#1A7AE8" transform="translate(16 19.15) scale(0.92)">
        <g transform="rotate(0)">
          <path d="M0-5.4c2.1 0 3.95 1.12 5 2.8l1.15-1.55.2 3.55-3.45-.55 1.12-1.5A4.35 4.35 0 0 0 0-4.05 4.35 4.35 0 0 0-3.9-1.55l-1.12-1.18A5.55 5.55 0 0 1 0-5.4Z" />
        </g>
        <g transform="rotate(120)">
          <path d="M0-5.4c2.1 0 3.95 1.12 5 2.8l1.15-1.55.2 3.55-3.45-.55 1.12-1.5A4.35 4.35 0 0 0 0-4.05 4.35 4.35 0 0 0-3.9-1.55l-1.12-1.18A5.55 5.55 0 0 1 0-5.4Z" />
        </g>
        <g transform="rotate(240)">
          <path d="M0-5.4c2.1 0 3.95 1.12 5 2.8l1.15-1.55.2 3.55-3.45-.55 1.12-1.5A4.35 4.35 0 0 0 0-4.05 4.35 4.35 0 0 0-3.9-1.55l-1.12-1.18A5.55 5.55 0 0 1 0-5.4Z" />
        </g>
      </g>
    </svg>
  );
}

export function InstallIcon({ size = 32 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="4" y1="2" x2="28" y2="30">
          <stop stopColor="#1677FF" />
          <stop offset="1" stopColor="#3B6AE8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill={`url(#${id})`} />
      <path d="M16 8v10.2" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M11.4 14.6 16 19.2l4.6-4.6" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.2 23.2h13.6" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

export function GithubIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0D1117" />
      <path
        fill="#F0F6FC"
        d="M16 7.4c-4.7 0-8.5 3.8-8.5 8.5 0 3.76 2.44 6.95 5.82 8.08.42.08.58-.18.58-.41 0-.2-.01-.74-.01-1.45-2.37.52-2.87-1.14-2.87-1.14-.38-.98-.94-1.25-.94-1.25-.78-.53.06-.52.06-.52.86.06 1.31.88 1.31.88.76 1.3 2 .93 2.48.71.08-.55.3-.93.54-1.14-1.89-.21-3.87-.94-3.87-4.2 0-.93.33-1.69.88-2.29-.09-.21-.38-1.08.08-2.25 0 0 .71-.23 2.34.87a8.1 8.1 0 0 1 4.26 0c1.62-1.1 2.33-.87 2.33-.87.47 1.17.18 2.04.09 2.25.55.6.88 1.36.88 2.29 0 3.27-1.99 3.99-3.89 4.2.31.26.58.78.58 1.58 0 1.14-.01 2.06-.01 2.34 0 .23.15.5.58.41A8.52 8.52 0 0 0 24.5 15.9c0-4.7-3.8-8.5-8.5-8.5Z"
      />
    </svg>
  );
}

export function WifiIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M5 10.8c1.9-1.9 4.4-2.9 7-2.9s5.1 1 7 2.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7.4 13.2c1.3-1.2 2.9-1.9 4.6-1.9s3.3.7 4.6 1.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="16.4" r="1.35" fill="currentColor" />
    </Svg>
  );
}

export function VolumeIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M5 10.2V13.8H8.2L12 17.2V6.8L8.2 10.2H5Z" fill="currentColor" />
      <path d="M14.4 9.2a3.4 3.4 0 0 1 0 5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16.6 7.2a6.2 6.2 0 0 1 0 9.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function BatteryIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect x="3.2" y="8.2" width="15.2" height="7.6" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
      <rect x="5" y="10" width="10.4" height="4" rx="0.6" fill="currentColor" />
      <rect x="19" y="10.4" width="1.8" height="3.2" rx="0.5" fill="currentColor" />
    </Svg>
  );
}

export function ChevronIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M8 6.5 13 12 8 17.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function CaptionMin() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="1" y="4.5" width="8" height="1" fill="currentColor" />
    </svg>
  );
}

export function CaptionMax() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="1.4" y="1.4" width="7.2" height="7.2" rx="1" stroke="currentColor" strokeWidth="1.1" fill="none" />
    </svg>
  );
}

export function CaptionRestore() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="2.4" y="0.9" width="6.2" height="6.2" rx="0.8" stroke="currentColor" strokeWidth="1" fill="none" />
      <rect x="0.9" y="2.6" width="6.2" height="6.2" rx="0.8" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0" />
    </svg>
  );
}

export function CaptionClose() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M1.6 1.6 8.4 8.4M8.4 1.6 1.6 8.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
