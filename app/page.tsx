const signals = [
  "Blood pressure over time",
  "Sleep or nap that day",
  "Alcohol that day",
  "Good/productive or not",
];

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">BPHealth</p>
        <h1>Simple, private blood pressure tracking for one person.</h1>
        <p className="lede">
          This scaffold is ready for the app router, Supabase, and Vercel so we can
          iterate quickly without adding unnecessary structure.
        </p>
      </section>

      <section className="panel">
        <h2>Core signals</h2>
        <ul>
          {signals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

