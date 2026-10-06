import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { formatCard, makeCard, parseModelActivity, parseRequest, SAFETY_REMINDER } from './domain.ts';
import type { ActivityCard, Duration, Surroundings } from './domain.ts';

export default function App() {
  const [duration, setDuration] = useState<Duration>(5);
  const [surroundings, setSurroundings] = useState<Surroundings>('courtyard');
  const [card, setCard] = useState<ActivityCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const inFlight = useRef(false);

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const response = await fetch('/api/activity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ duration, surroundings }),
        signal: AbortSignal.timeout(125000),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Could not generate an activity. Try again.');
        return;
      }
      if (body.source !== 'local-ai') throw new Error('Invalid card source');
      setCard(makeCard(parseRequest({ duration: body.duration, surroundings: body.surroundings }),
        parseModelActivity({ title: body.title, steps: body.steps })));
    } catch {
      setError('Could not reach the local server or read its response. Check that it is running, then try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function save() {
    if (!card) return;
    const url = URL.createObjectURL(new Blob([formatCard(card)], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pocketpause.txt';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaved(true);
  }

  return <main>
    <header className="masthead"><a href="/" className="brand" aria-label="PocketPause home">↟ PocketPause</a><span className="local">Local AI · no account</span></header>
    <section className="intro" aria-labelledby="intro-title">
      <p className="eyebrow">A small invitation outside</p>
      <h1 id="intro-title">Make room for<br /><em>the world nearby.</em></h1>
      <p className="lede">Choose a little time away. Get one simple activity, save it, then put your screen away.</p>
    </section>
    <div className="workspace">
      <section className="chooser" aria-labelledby="chooser-title">
        <p className="eyebrow">01 / Before you step out</p>
        <h2 id="chooser-title">Your pause, your place.</h2>
        <form onSubmit={generate}>
          <label htmlFor="duration">Time away</label>
          <select id="duration" value={duration} onChange={event => setDuration(Number(event.target.value) as Duration)} disabled={busy}>
            <option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option>
          </select>
          <label htmlFor="surroundings">Surroundings</label>
          <select id="surroundings" value={surroundings} onChange={event => setSurroundings(event.target.value as Surroundings)} disabled={busy}>
            <option value="street">Street</option><option value="terrace">Terrace</option><option value="courtyard">Courtyard</option><option value="campus">Campus</option>
          </select>
          <button className="primary" disabled={busy} type="submit">{busy ? 'Generating…' : 'Generate activity'}{!busy && <span aria-hidden="true"> ↗</span>}</button>
        </form>
        <p className="hint">Runs on your laptop. The local model may take up to two minutes. You can try again if it fails.</p>
      </section>
      <section className="result" aria-label="Your activity" aria-busy={busy}>
        <p className="eyebrow">02 / Take this with you</p>
        {card ? <article>
          <p className="context">{card.duration} minutes · {card.surroundings}</p>
          <h2>{card.title}</h2>
          <ol>{card.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
          <p className="safety">{SAFETY_REMINDER}</p>
          <button className="secondary" onClick={save}>Save activity <span aria-hidden="true">↓</span></button>
          <p className="hint">Generated with a local open-weight model. Read it first and use your judgment.</p>
        </article> : <div className="empty">
          <span className="sun" aria-hidden="true">☼</span>
          <h2>No checklist. Just a pause.</h2>
          <p>Your activity will appear here. No photos, recordings or tracking needed.</p>
        </div>}
        <p role="status" className="status">{busy ? 'Working with your local model…' : saved ? 'Saved. Read your activity, then put the screen away.' : ''}</p>
        {error && <p role="alert" className="error">{error}</p>}
      </section>
    </div>
    <footer>One card, not another feed.<span>No location access · no uploads</span></footer>
  </main>;
}
