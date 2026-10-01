import { useState } from 'react';
import { Link } from 'react-router';
import { inAppBrowser, isAndroid, isIos, isStandalone, useInstallPrompt } from '../lib/install.ts';

// The link to share: https://dinkup.onrender.com/install. It works out which
// phone and browser the visitor has and shows the one way to install that
// works there. The QR code (public/install-qr.svg) encodes the same link.
const INSTALL_URL = 'https://dinkup.onrender.com/install';

export function InstallPage() {
  const { canPrompt, installed, promptInstall } = useInstallPrompt();
  const [justInstalled, setJustInstalled] = useState(false);
  const inApp = inAppBrowser();
  const ios = isIos();
  const android = isAndroid();

  let steps: React.ReactNode;
  if (isStandalone() || installed || justInstalled) {
    steps = (
      <>
        <h2>You're all set</h2>
        <p>Dinkup is on your home screen. Open it from there, like any other app.</p>
        <Link to="/" className="button">
          Go to Dinkup
        </Link>
      </>
    );
  } else if (inApp) {
    // Chrome on Android can be opened straight from an intent link.
    const chrome = `intent://${INSTALL_URL.replace(/^https:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    steps = (
      <>
        <h2>First, open this page in {ios ? 'Safari' : 'Chrome'}</h2>
        <p>
          You opened this link inside {inApp}, which can't install apps.{' '}
          {ios ? (
            <>
              Tap the <b>•••</b> or <b>Share</b> button, choose <b>Open in Safari</b> (or <b>Open in browser</b>), then follow the steps there. Or copy the link and paste it into Safari.
            </>
          ) : (
            'Open it in Chrome, then follow the steps there. Or copy the link and paste it into your browser.'
          )}
        </p>
        {android ? (
          <a href={chrome} className="button">
            Open in Chrome
          </a>
        ) : null}
        <CopyLink label="Copy link" />
      </>
    );
  } else if (canPrompt) {
    steps = (
      <>
        <h2>Install in one tap</h2>
        <button
          className="button"
          onClick={async () => {
            if ((await promptInstall()) === 'accepted') setJustInstalled(true);
          }}
        >
          Install Dinkup
        </button>
      </>
    );
  } else if (ios) {
    steps = (
      <>
        <h2>Add it to your home screen</h2>
        <ol className="install-steps">
          <li>
            Tap the <b>Share</b> button <ShareIcon />, at the bottom of Safari (in Chrome, it's in the address bar).
          </li>
          <li>
            Scroll down and tap <b>Add to Home Screen</b>.
          </li>
          <li>
            Tap <b>Add</b>.
          </li>
        </ol>
      </>
    );
  } else if (android) {
    steps = (
      <>
        <h2>Add it to your home screen</h2>
        <ol className="install-steps">
          <li>
            Tap your browser's menu (<b>⋮</b>).
          </li>
          <li>
            Tap <b>Install app</b> or <b>Add to Home screen</b>.
          </li>
        </ol>
      </>
    );
  } else {
    steps = (
      <>
        <h2>Best on your phone</h2>
        <p>Scan the code below with your phone's camera, then follow the steps that show up.</p>
      </>
    );
  }

  return (
    <div className="stack install-page">
      <header className="install-hero">
        <img src="/icons/icon-192.png" alt="" width={72} height={72} />
        <div>
          <h1>Get Dinkup</h1>
          <p className="muted">Find a pickleball game in Cebu. It installs straight from the browser, so there's no app store and it takes seconds.</p>
        </div>
      </header>

      <section className="card stack">{steps}</section>

      <section className="card stack install-share">
        <h2>Share with friends</h2>
        <p className="muted small">Send them this link, or let them scan the code.</p>
        <img src="/install-qr.svg" alt={`QR code for ${INSTALL_URL}`} width={200} height={200} className="install-qr" />
        <p className="install-url">{INSTALL_URL.replace(/^https:\/\//, '')}</p>
        <ShareButton />
      </section>
    </div>
  );
}

function ShareButton() {
  if (typeof navigator.share !== 'function') return <CopyLink label="Copy link" />;
  return (
    <button
      className="button button-ghost"
      onClick={() => navigator.share({ title: 'Dinkup', text: 'Find a pickleball game in Cebu', url: INSTALL_URL }).catch(() => {})}
    >
      Share link
    </button>
  );
}

function CopyLink({ label }: { label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="button button-ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(INSTALL_URL);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt('Copy this link', INSTALL_URL);
        }
      }}
    >
      {copied ? 'Link copied' : label}
    </button>
  );
}

function ShareIcon() {
  // The iOS share glyph: a box with an arrow out of the top.
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" width="18" height="18" aria-label="(square with an up arrow)" role="img">
      <path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 10H5v11h14V10h-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
