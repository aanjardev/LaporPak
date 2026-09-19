/** Decorative SVG: no image request, animation, or client JavaScript. */
export function AuthBackground() {
  return (
    <div className="auth-background" aria-hidden="true">
      <svg className="auth-background-pattern" viewBox="0 0 1440 600" preserveAspectRatio="xMidYMid slice" focusable="false">
        <g fill="currentColor">
          <path d="M-180 0H30L330 300 30 600H-180L120 300Z" />
          <path d="M870-180 1170 120 1470-180V30L1170 330 870 30Z" />
          <path d="M500 600 800 300 1100 600H920L800 480 680 600Z" opacity=".45" />
        </g>
      </svg>
      <svg className="auth-background-waves" viewBox="0 0 1440 160" preserveAspectRatio="none" focusable="false">
        <path d="M0 62C250 150 390-5 720 66S1160 5 1440 36V160H0Z" fill="currentColor" opacity=".16" />
        <path d="M0 110C230-12 435 32 720 99S1190 17 1440 70V160H0Z" fill="currentColor" opacity=".26" />
        <path d="M0 126C240 100 400 82 720 121S1190 164 1440 107V160H0Z" className="fill-background" />
      </svg>
    </div>
  );
}
