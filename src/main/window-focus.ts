import { execSync } from 'child_process';

export class WindowFocus {
  /**
   * Bring the terminal window running a Claude Code session to the front.
   * 
   * Strategy:
   * 1. Get the TTY of the process.
   * 2. Use AppleScript to search Terminal and iTerm2 for that specific TTY tab.
   * 3. If found, activate it specifically and unminimize.
   * 4. Fallback to extracting the parent macOS GUI app and bringing its window to front.
   */
  static async focusSession(pid: number, entrypoint?: string): Promise<void> {
    try {
      const tty = this.getTty(pid);
      
      // Step 1: Try precise TTY targeting (Terminal / iTerm2)
      if (tty) {
        const preciseSuccess = this.activateByTty(tty);
        if (preciseSuccess) return;
      }

      // Step 2: Fallback to generic PPID activation
      const ppid = this.getParentPid(pid);
      if (ppid) {
        if (this.activateByPid(ppid)) return;
      }

      // Step 3: Entrypoint fallback
      if (entrypoint === 'claude-desktop') {
        this.activateApp('Claude');
        return;
      }

      // Step 4: Last resort original PID
      this.activateByPid(pid);
    } catch (err) {
      console.error('WindowFocus error:', err);
    }
  }

  private static getTty(pid: number): string | null {
    try {
      // Returns e.g. "ttys001"
      const result = execSync(`ps -o tty= -p ${pid}`, {
        encoding: 'utf-8',
        timeout: 2000,
      }).trim();
      return result && result !== '??' ? result : null;
    } catch {
      return null;
    }
  }

  private static getParentPid(pid: number): number | null {
    try {
      const result = execSync(`ps -o ppid= -p ${pid}`, {
        encoding: 'utf-8',
        timeout: 2000,
      }).trim();
      const ppid = parseInt(result, 10);
      return isNaN(ppid) ? null : ppid;
    } catch {
      return null;
    }
  }

  private static activateByTty(tty: string): boolean {
    const script = `
      -- Try Terminal
      try
        tell application "Terminal"
          repeat with win in windows
            repeat with tb in tabs of win
              if tty of tb contains "${tty}" then
                try
                  set minimized of win to false
                end try
                set selected of tb to true
                set index of win to 1
                
                -- Native OS Security Override
                -- macOS automatically blocks AppleScript from raising a background overlapping window 
                -- if the application is already actively focused to prevent hijacked keystrokes.
                -- We securely drop focus to Finder, wait 50ms for OS acknowledgement, and reactivate natively.
                tell application "Finder" to activate
                delay 0.05
                activate
                return "SUCCESS"
              end if
            end repeat
          end repeat
        end tell
      on error errStr
         -- Ignore Terminal errors
      end try

      -- Try iTerm2
      try
        tell application "iTerm"
          repeat with win in windows
            repeat with tb in tabs of win
              repeat with sesh in sessions of tb
                if tty of sesh contains "${tty}" then
                  tell win to select
                  tell tb to select
                  tell sesh to select
                  set index of win to 1
                  
                  tell application "Finder" to activate
                  delay 0.05
                  activate
                  return "SUCCESS"
                end if
              end repeat
            end repeat
          end repeat
        end tell
      on error errStr
         -- Ignore iTerm errors
      end try

      return "FAIL"
    `;

    try {
      const result = execSync(`osascript -e '${script}'`, {
        encoding: 'utf-8',
        timeout: 4000,
        stdio: ['pipe', 'pipe', 'ignore'] 
      }).toString().trim();
      
      if (result === 'SUCCESS') {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private static activateByPid(pid: number): boolean {
    try {
      // In mock mode or if PID not found, fallback to generic app activation
      // Do not use System Events because it requires accessibility permissions and crashes
      execSync(`osascript -e 'tell application "iTerm"
          activate
          tell current window to set index to 1
        end tell'`, { stdio: 'pipe', timeout: 1000 });
      return true;
    } catch {
      try {
        execSync(`osascript -e 'tell application "Terminal"
            activate
            set index of window 1 to 1
          end tell'`, { stdio: 'pipe', timeout: 1000 });
        return true;
      } catch {
        return false;
      }
    }
  }

  private static activateApp(appName: string): void {
    try {
      execSync(`osascript -e 'tell application "${appName}" to activate'`, {
        encoding: 'utf-8',
        timeout: 3000,
        stdio: 'ignore'
      });
    } catch {
      console.error(`Failed to activate app: ${appName}`);
    }
  }
}
