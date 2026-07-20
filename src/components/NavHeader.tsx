export function NavHeader() {
  return (
    <header className="nav-header">
      <button type="button" className="nav-back" aria-label="Back" tabIndex={-1}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M12.5 4 6.5 10l6 6"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <h1 className="nav-title">Themes</h1>
    </header>
  )
}
