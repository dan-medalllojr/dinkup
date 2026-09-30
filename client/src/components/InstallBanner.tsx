import { useState } from 'react';
import { isIosSafari, isStandalone, useInstallPrompt } from '../lib/install.ts';
import { readStorage, writeStorage } from '../lib/storage.ts';

const DISMISS_KEY = 'dinkup.installDismissedAt';
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

function snoozed() {
  const at = Number(readStorage(DISMISS_KEY));
  return Number.isFinite(at) && Date.now() - at < SNOOZE_MS;
}

export function InstallBanner() {
  const { canPrompt, installed, promptInstall } = useInstallPrompt();
  const [hidden, setHidden] = useState(() => snoozed() || isStandalone());
  const ios = isIosSafari();

  if (hidden || installed || (!canPrompt && !ios)) return null;

  function dismiss() {
    writeStorage(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  }

  return (
    <section className="card install-banner" aria-label="Install Dinkup">
      <img src="/icons/icon-192.png" alt="" width={44} height={44} />
      <div className="install-text">
        <strong>Put Dinkup on your home screen</strong>
        {canPrompt ? (
          <span className="muted small">Opens like an app, no app store needed.</span>
        ) : (
          <span className="muted small">
            Tap <b>Share</b> <span aria-hidden>⎋</span>, then <b>Add to Home Screen</b>.
          </span>
        )}
      </div>
      <div className="install-actions">
        {canPrompt ? (
          <button
            className="button button-small"
            onClick={async () => {
              const outcome = await promptInstall();
              if (outcome !== 'accepted') dismiss();
            }}
          >
            Install
          </button>
        ) : null}
        <button className="link-button small" onClick={dismiss}>
          Not now
        </button>
      </div>
    </section>
  );
}
