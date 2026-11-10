'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>旅程暂时停了一下</h1>
      <p>页面未能加载，请稍后重试。</p>
      <button className="primary" onClick={reset}>
        重新加载
      </button>
    </main>
  );
}
