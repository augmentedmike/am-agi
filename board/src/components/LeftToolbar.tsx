'use client';

interface LeftToolbarProps {
  showSearch: boolean;
  setShowSearch: (v: boolean | ((prev: boolean) => boolean)) => void;
  showMilestonePlanner: boolean;
  openMilestonePlanner: () => void;
  closeMilestonePlanner: () => void;
  showTeam: boolean;
  openTeam: () => void;
  closeTeam: () => void;
  showContacts: boolean;
  openContacts: () => void;
  closeContacts: () => void;
  showChat: boolean;
  chatUnread: boolean;
  openChat: () => void;
  closeChat: () => void;
}

function ToolbarButton({
  active,
  indicator,
  title,
  onClick,
  children,
}: {
  active: boolean;
  indicator?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`relative flex items-center justify-center w-11 h-11 rounded-xl border transition-colors ${
        active
          ? 'bg-zinc-700 text-zinc-100 border-white/20'
          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 border-white/10 hover:border-white/20'
      }`}
    >
      {children}
      {indicator && (
        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-pink-500 animate-pulse" />
      )}
    </button>
  );
}

export function LeftToolbar({
  showSearch,
  setShowSearch,
  showMilestonePlanner,
  openMilestonePlanner,
  closeMilestonePlanner,
  showTeam,
  openTeam,
  closeTeam,
  showContacts,
  openContacts,
  closeContacts,
  showChat,
  chatUnread,
  openChat,
  closeChat,
}: LeftToolbarProps) {
  return (
    <div className="hidden lg:flex flex-col items-center gap-2 px-2 py-3 bg-zinc-900 border-r border-white/5 shrink-0">
      {/* Search */}
      <ToolbarButton
        active={showSearch}
        title="Search cards"
        onClick={() => setShowSearch(v => !v)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
      </ToolbarButton>

      {/* Milestone / Flag */}
      <ToolbarButton
        active={showMilestonePlanner}
        title="Milestone planner"
        onClick={() => showMilestonePlanner ? closeMilestonePlanner() : openMilestonePlanner()}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
        </svg>
      </ToolbarButton>

      {/* Team / People */}
      <ToolbarButton
        active={showTeam}
        title="Team"
        onClick={() => showTeam ? closeTeam() : openTeam()}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      </ToolbarButton>

      {/* Contacts / Building */}
      <ToolbarButton
        active={showContacts}
        title="Contacts"
        onClick={() => showContacts ? closeContacts() : openContacts()}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
        </svg>
      </ToolbarButton>

      {/* Chat */}
      <ToolbarButton
        active={showChat}
        indicator={chatUnread && !showChat}
        title="Chat"
        onClick={() => showChat ? closeChat() : openChat()}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      </ToolbarButton>
    </div>
  );
}
