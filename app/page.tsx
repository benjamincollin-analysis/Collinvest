export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <nav className="flex justify-between items-center px-8 py-6 border-b border-zinc-800">
        <h1 className="text-2xl font-bold">PropVest</h1>
        <div className="flex gap-4">
          <button className="px-4 py-2 text-zinc-400">Sign in</button>
          <button className="px-4 py-2 bg-white text-black rounded-lg font-medium">Get started</button>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-8 py-24 text-center">
        <h2 className="text-6xl font-bold mb-6">Real estate, connected.</h2>
        <p className="text-xl text-zinc-400 mb-10">Connect projects to investors. Track your portfolio.</p>
        <button className="px-8 py-4 bg-white text-black rounded-lg font-medium text-lg">Start for free</button>
      </main>
    </div>
  )
}