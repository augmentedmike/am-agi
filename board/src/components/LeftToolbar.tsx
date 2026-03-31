'use client';

interface LeftToolbarProps {
  showSearch: boolean;
  setShowSearch: (v: boolean | ((prev: boolean) => boolean)) => void;
  showMilestonePlanner: boolean;
  openMilestonePlanner: () => void;
  closeMilestonePlanner: () => void;
  showChat: boolean;
  chatUnread: boolean;
  chatAttention?: boolean;
  openChat: () => void;
  closeChat: () => void;
  hasGit: boolean;
  showGit: boolean;
  openGit: () => void;
  closeGit: () => void;
  hasEmail: boolean;
  showEmail: boolean;
  openEmail: () => void;
  closeEmail: () => void;
  showFolder: boolean;
  openFolder: () => void;
  closeFolder: () => void;
  openSettings: () => void;
}

function ToolbarButton({
  active,
  indicator,
  attention,
  title,
  onClick,
  children,
}: {
  active: boolean;
  indicator?: boolean;
  attention?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`relative flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-500 ${
        active
          ? 'bg-zinc-700 text-zinc-100 border-white/20'
          : attention
            ? 'bg-pink-500/10 text-pink-300 border-pink-500/40 shadow-[0_0_8px_rgba(236,72,153,0.25)]'
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
  showChat,
  chatUnread,
  chatAttention,
  openChat,
  closeChat,
  hasGit,
  showGit,
  openGit,
  closeGit,
  hasEmail,
  showEmail,
  openEmail,
  closeEmail,
  showFolder,
  openFolder,
  closeFolder,
  openSettings,
}: LeftToolbarProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-1.5 py-2 bg-zinc-900 border-r border-white/5 shrink-0">
      {/* Search */}
      <ToolbarButton
        active={showSearch}
        title="Search cards"
        onClick={() => setShowSearch(v => !v)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
      </ToolbarButton>

      {/* Chat */}
      <ToolbarButton
        active={showChat}
        indicator={chatUnread && !showChat}
        title="Chat"
        onClick={() => showChat ? closeChat() : openChat()}
        attention={chatAttention && !showChat}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      </ToolbarButton>

      {/* Email — contextual */}
      {hasEmail && (
        <ToolbarButton
          active={showEmail}
          title="Email"
          onClick={() => showEmail ? closeEmail() : openEmail()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </ToolbarButton>
      )}

      {/* Roadmap / Milestone */}
      <ToolbarButton
        active={showMilestonePlanner}
        title="Roadmap"
        onClick={() => showMilestonePlanner ? closeMilestonePlanner() : openMilestonePlanner()}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
        </svg>
      </ToolbarButton>

      {/* Files / filesystem */}
      <ToolbarButton
        active={showFolder}
        title="Files"
        onClick={() => showFolder ? closeFolder() : openFolder()}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
      </ToolbarButton>

      {/* Git — contextual */}
      {hasGit && (
        <ToolbarButton
          active={showGit}
          title="Git"
          onClick={() => showGit ? closeGit() : openGit()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
          </svg>
        </ToolbarButton>
      )}

      {/* Settings */}
      <ToolbarButton
        active={false}
        title="Settings"
        onClick={openSettings}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </ToolbarButton>
    </div>
  );
}
