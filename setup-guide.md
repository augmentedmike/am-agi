# Auto Scene Switching with Advanced Scene Switcher
## Switch Between "Browser" and "Supplemental" Based on Active Window

This guide walks you through configuring OBS to automatically switch scenes depending on which window you're looking at — no manual hotkeys needed.

---

## Prerequisites

- OBS Studio installed
- Two scenes already created in OBS named exactly:
  - **Browser** — your browser capture layout
  - **Supplemental** — your VS Code / supplemental window layout

---

## Step 1: Install Advanced Scene Switcher

1. Open OBS Studio
2. Go to **Tools → obs-plugins** or use the OBS Plugin Manager
3. Download the latest release from:
   **https://github.com/WarmUpTill/SceneSwitcher/releases**
4. Install per your OS:
   - **macOS**: Copy the `.plugin` bundle to `~/Library/Application Support/obs-studio/plugins/`
   - **Windows**: Run the installer `.exe` — it auto-detects your OBS path
5. **Restart OBS**
6. Verify install: `Tools` menu should now show **Advanced Scene Switcher**

---

## Step 2: Open the Plugin

In OBS: `Tools → Advanced Scene Switcher`

The plugin window opens. You'll see tabs across the top: **General**, **Macros**, and others.

---

## Step 3: Configure General Settings

1. Click the **General** tab
2. In the **Status** section:
   - Set the check interval to **300ms** (fast enough to feel instant, low CPU)
   - Make sure the plugin status shows **Running** (green indicator)
3. Optionally, in the **Transitions** section, set a transition for automated switches (e.g., Cut or a short Fade of 150ms) so it doesn't use your default slow transition

---

## Step 4: Find Your Exact Process Names

Before creating macros, confirm the process names on your system:

1. Go to **Macros** tab → click **+** to create a temporary macro
2. Add a **Process** condition → enable the **Focus** toggle
3. At the bottom of the condition UI, you'll see: *"Currently focused process: [name]"*
4. Click on your browser — watch the name update in real time
5. Note these names exactly (they're case-sensitive):

### macOS Process Names
| App | Process Name |
|---|---|
| Google Chrome | `Google Chrome` |
| Firefox | `firefox` |
| Safari | `Safari` |
| Arc | `Arc` |
| VS Code | `Code` |
| Cursor | `Cursor` |
| Terminal | `Terminal` |
| iTerm2 | `iTerm2` |

### Windows Process Names
| App | Process Name |
|---|---|
| Google Chrome | `chrome.exe` |
| Firefox | `firefox.exe` |
| Safari | *(not available on Windows)* |
| VS Code | `Code.exe` |
| Cursor | `Cursor.exe` |
| Windows Terminal | `WindowsTerminal.exe` |

> **Tip:** If you're unsure, use Activity Monitor (macOS) or Task Manager (Windows) to find the exact process name.

---

## Step 5: Create the "Browser Focus" Macro

1. In the **Macros** tab, click **+** to add a new macro
2. **Name it:** `Browser Focus`
3. In the **Conditions** section, click **+** → choose **Process**

### Option A — Regex (recommended, single condition)
4. In the process name field, **enable regex** (checkbox or toggle near the field)
5. Enter the regex pattern:

   **macOS:**
   ```
   Google Chrome|firefox|Safari|Arc
   ```
   **Windows:**
   ```
   chrome\.exe|firefox\.exe
   ```
6. Enable the **Focus** toggle so it only fires when the browser is the active foreground window

### Option B — Multiple conditions (no regex)
4. Add one Process condition per browser, each with **Focus** enabled
5. Between each condition, set the logic operator to **OR**

### Add Anti-Flicker Delay
7. Click the **clock icon** (⏱) next to the condition
8. Select **"For at least"** and set `0.5 seconds`
   - This prevents switching during a brief alt-tab or notification popup

### Add the Action
9. In the **Actions** section, click **+** → choose **Switch Scene**
10. Select scene: **Browser**

### Enable Condition Change Trigger
11. Click the **gear icon** (⚙) on the macro header
12. Enable **"Condition Change Trigger"**
    - This makes the scene switch fire only when focus *changes* to a browser, not on every polling tick

---

## Step 6: Create the "Supplemental Focus" Macro

1. Click **+** to add another macro
2. **Name it:** `Supplemental Focus`
3. In the **Conditions** section, click **+** → choose **Process**
4. Enter process name: `Code` (macOS) or `Code.exe` (Windows)
5. Enable the **Focus** toggle
6. Click the **clock icon** → **"For at least"** → `0.5 seconds`

### Add More Apps (optional)
To also switch to Supplemental for other coding/supplemental tools, add more Process conditions with OR logic:
- `Cursor` / `Cursor.exe`
- `Xcode`
- `iTerm2` / `WindowsTerminal.exe`
- `Terminal`

### Add the Action
7. In **Actions**: **+** → **Switch Scene** → **Supplemental**

### Enable Condition Change Trigger
8. Gear icon → enable **"Condition Change Trigger"**

---

## Step 7: Add a Fallback (Else Actions)

When you switch to a window that's neither a browser nor VS Code (e.g., Finder, Slack, notes), you want a defined behavior. Two approaches:

### Option A — Else Action on the Browser macro (simplest)
1. On the `Browser Focus` macro, find the **Else Actions** section (below Actions)
2. Click **+** → **Switch Scene** → **Supplemental**
3. Now the logic reads: *"If browser has focus → Browser scene. Otherwise → Supplemental scene."*

### Option B — Third fallback macro
1. Create a new macro: `Fallback`
2. Add a **Process** condition for each app that's NOT a browser and NOT VS Code that you use regularly
3. Or leave it as-is and just accept that "unknown windows" default to the last active scene

---

## Step 8: Order the Macros

Macros execute top-to-bottom. Make sure they're ordered:

1. `Browser Focus` ← top
2. `Supplemental Focus`
3. `Fallback` (if created)

Drag macros in the list to reorder.

---

## Step 9: Test It

1. Confirm the plugin shows **Running** in the General tab
2. Click your browser — OBS should switch to the **Browser** scene within ~0.5–1.0s
3. Click VS Code — OBS should switch to the **Supplemental** scene
4. Alt-tab rapidly — switching should not flicker (thanks to the 0.5s delay)
5. If a switch doesn't fire, go back to the macro, check that:
   - The process name matches exactly (check the real-time display)
   - The **Focus** toggle is on
   - The macro status shows conditions evaluating (there may be a debug indicator)

---

## Quick Reference

| Setting | Where | Value |
|---|---|---|
| Plugin running | General → Status | Enabled |
| Check interval | General → Status | 300ms |
| Condition type | Macro → Conditions | Process |
| Focus only | Process condition toggle | ✅ On |
| Anti-flicker delay | Clock icon → Duration | For at least 0.5s |
| Condition change trigger | Gear icon | ✅ On |
| Action | Macro → Actions | Switch Scene |
| Browser regex (macOS) | Process name field | `Google Chrome\|firefox\|Safari\|Arc` |
| Supplemental process (macOS) | Process name field | `Code` |

---

## Troubleshooting

**Scene doesn't switch:**
- Is the plugin Running? (General tab)
- Does the process name match exactly? (use real-time display in condition UI)
- Is the Focus toggle enabled?

**Scene switches too slowly:**
- Reduce the check interval (General tab) to 200ms
- Reduce the "For at least" duration to 0.2s

**Scene flickers rapidly:**
- Increase the "For at least" duration to 1.0s
- Ensure "Condition Change Trigger" is enabled

**Wrong scene when using non-browser/non-code apps:**
- Add an Else Action to the Browser macro to switch to Supplemental as default
- Or create a third fallback macro
