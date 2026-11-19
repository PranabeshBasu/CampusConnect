/**
 * Shared page container. Every routed page renders inside this so the width,
 * side padding and top spacing are identical everywhere (and never clip under
 * the sticky navbar).
 */
export default function AppShell({ children, className = '', ...rest }) {
  return (
    <main className={`mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 ${className}`.trim()} {...rest}>
      {children}
    </main>
  );
}