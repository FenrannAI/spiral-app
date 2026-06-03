import React, { useState } from 'react';
import './WarningModal.css';

const STORAGE_KEY = 'hypnovis-terms-v1';

export function hasAcceptedTerms(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'accepted'; }
  catch { return false; }
}

function acceptTerms(): void {
  try { localStorage.setItem(STORAGE_KEY, 'accepted'); }
  catch { /* storage unavailable — let the user continue anyway */ }
}

export const WarningModal: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  if (dismissed || hasAcceptedTerms()) return null;

  const handleAgree = () => {
    acceptTerms();
    setDismissed(true);
  };

  return (
    <div className="warning-modal-backdrop">
      <div className="warning-modal" role="dialog" aria-modal="true" aria-labelledby="wm-title">
        <div className="warning-modal-icon">⚠️</div>
        <h1 id="wm-title">Before You Continue</h1>

        <div className="warning-modal-section">
          <strong>Photosensitivity Warning</strong>
          This application displays rapidly flashing lights, strobing effects, and
          high-contrast spiral animations. These can trigger seizures or adverse
          reactions in people with photosensitive epilepsy or similar conditions.
          If you or anyone in your household is affected, do not use this application.
        </div>

        <div className="warning-modal-section caution">
          <strong>Hypnotic &amp; Psychological Effects</strong>
          HypnoVis is designed for recreational entertainment. The visual and audio
          patterns may induce relaxed, trance-like, or dissociative states. Do not
          use while operating a vehicle or machinery. Discontinue use if you
          experience discomfort, dizziness, or distress.
        </div>

        <button
          className="warning-modal-terms-toggle"
          onClick={() => setTermsOpen(o => !o)}
          aria-expanded={termsOpen}
        >
          {termsOpen ? 'Hide' : 'View'} Full Terms of Use &amp; Disclaimer
        </button>

        {termsOpen && (
          <div className="warning-modal-terms">
            <h2>1. Entertainment Purpose Only</h2>
            <p>
              HypnoVis is a recreational entertainment application. It is not a
              medical device, therapeutic tool, or clinical intervention of any
              kind. Nothing produced by this application constitutes medical,
              psychological, or psychiatric advice or treatment. Do not use
              HypnoVis as a substitute for professional medical or mental-health
              care.
            </p>

            <h2>2. Photosensitivity &amp; Seizure Risk</h2>
            <p>
              Flashing lights, strobing effects, and high-contrast patterns
              displayed by this application may trigger photosensitive epileptic
              seizures or other adverse neurological reactions. A small percentage
              of the population may be susceptible even without a prior diagnosis.
              If you experience any unusual symptoms — including eye discomfort,
              altered vision, muscle twitching, disorientation, or loss of
              awareness — stop using the application immediately and consult a
              physician.
            </p>

            <h2>3. Hypnotic Suggestion &amp; Psychological Effects</h2>
            <p>
              The spiral visuals, subliminal text, and binaural audio included in
              this application are designed to promote relaxed or trance-adjacent
              states for entertainment purposes. Individual responses vary widely.
              Possible effects include deep relaxation, heightened suggestibility,
              vivid imagery, or emotional responses. Do not use if you have a
              history of psychosis, dissociative disorders, or conditions that may
              be aggravated by trance-like states. Parental supervision is
              recommended for minors.
            </p>

            <h2>4. Conditions of Safe Use</h2>
            <p>
              Do not use HypnoVis while driving, operating machinery, or in any
              situation where reduced alertness poses a danger to yourself or
              others. Use in a safe, comfortable environment. Take regular breaks.
              Keep ambient lighting on. Maintain a comfortable viewing distance
              from your screen.
            </p>

            <h2>5. Disclaimer of Liability</h2>
            <p>
              HypnoVis is provided "as is" for entertainment purposes without
              warranty of any kind. To the fullest extent permitted by applicable
              law, the creators and operators of HypnoVis shall not be liable for
              any direct, indirect, incidental, or consequential damages arising
              from your use of this application, including but not limited to
              seizures, psychological distress, injury, or any other adverse
              effects. You use this application entirely at your own risk.
            </p>

            <h2>6. Agreement</h2>
            <p>
              By clicking "I Understand &amp; Agree" below, you confirm that you
              are 18 years of age or older (or have obtained parental consent),
              that you have read and understood these terms, and that you agree to
              use HypnoVis solely for personal recreational entertainment at your
              own risk.
            </p>
          </div>
        )}

        <button className="warning-modal-agree" onClick={handleAgree}>
          I Understand &amp; Agree — Enter HypnoVis
        </button>
        <p className="warning-modal-sub">
          Continuing constitutes acceptance of the above terms and disclaimer.
        </p>
      </div>
    </div>
  );
};
