# Installer and release tooling

Everything needed to turn this repo into a single double-click `.exe` and publish it as a
GitHub release. Nothing here ships inside the app itself — these are build-time and
install-time components only.

## Build a release

```bat
installer\release.bat v1.4.0
```

That tags `HEAD`, builds the installer, pushes the commit and tag, and attaches the `.exe`
to a GitHub release. To only build without publishing:

```bat
installer\build-installer.bat
```

Output lands in `deploy\FreshdeskDashboard-<version>.exe`. `deploy\` is gitignored — the
`.exe` reaches users as a release asset, never as a committed file.

## Files

| File | Role |
|---|---|
| `release.bat` | Entry point: tag, build, push, publish. |
| `build-installer.bat` | Stages the payload, audits it for secrets, zips it, builds the `.exe`. |
| `build-sed.py` | Writes `installer.sed`, the IExpress directive file. |
| `bootstrap.cmd` | Runs *inside* the `.exe`: unpacks the payload and starts the install elevated. |
| `launcher.vbs` | Runs *inside* the `.exe`: starts `bootstrap.cmd` with no console flash. |
| `publish-release.py` | Creates the GitHub release and uploads the `.exe` via the REST API. |

## How the `.exe` is built

1. **Stage.** `build-installer.bat` copies the app into `%TEMP%\fd-build\content` from an
   **explicit whitelist**. Never change this to a wildcard sweep: `Sharepoint\.env` and
   `Sharepoint\token_cache.json` hold live credentials and this `.exe` is a public download.
2. **Audit.** The staged tree is searched for `.env` and `token_cache`. Any hit aborts the
   build. This is a safety net for the whitelist, not a replacement for it.
3. **Zip.** The staged content becomes `FreshdeskDashboard.zip`.
4. **Directive.** `build-sed.py` writes `installer.sed` listing three files to pack —
   `bootstrap.cmd`, `FreshdeskDashboard.zip`, `launcher.vbs` — and sets
   `AppLaunched=wscript launcher.vbs`, so that is what runs when a user double-clicks.
5. **Package.** `iexpress.exe` produces a self-extracting `.exe`.

The version comes from `git describe --tags --abbrev=0`, so **tag before building** or the
build ships the previous version number.

### IExpress gotcha

`iexpress.exe` does **not** strip quotes from its `.sed` argument, and it **always exits 0**
— even when handed a path that does not exist. A quoted path therefore fails with
"Error opening the IExpress Self Extraction Directive file" while `errorlevel` still reads
success. The builder `pushd`es into the stage, passes the bare filename, and decides success
by testing whether the output `.exe` exists. When a build fails the stage is kept so the
`.sed` can be inspected; re-run without `/Q` to see the error dialog.

Builds are also **not byte-reproducible** — IExpress stamps a timestamp into the CAB, so two
builds of the same commit differ in hash. Compare the extracted payload, not the `.exe` hash:
`FreshdeskDashboard-x.y.z.exe /C /T:<dir>` unpacks it without installing anything.

## What happens when a user double-clicks

```
FreshdeskDashboard-v1.3.0.exe
  └─ IExpress unpacks to a temp dir, runs: wscript launcher.vbs
       └─ launcher.vbs        runs bootstrap.cmd hidden (no console flash)
            └─ bootstrap.cmd  extracts FreshdeskDashboard.zip to %TEMP%\FDInstall
                              then runs install.cmd elevated via ShellExecute "runas"
                 └─ install.cmd  xcopy to C:\FreshdeskDashboard, logs to install.log,
                                 launches setup.hta
                      └─ setup.hta  installs Python, Ollama, pip deps, pulls the AI model,
                                    opens ports 8080 and 11434, configures auto-start,
                                    starts the server, opens the dashboard
```

`install.cmd` uses `xcopy /y /e`, which **merges** instead of wiping the destination, so
reinstalling over an existing install keeps local configuration — `Sharepoint\.env` and
`token_cache.json` are not in the payload and are therefore never overwritten.

## Publishing

`publish-release.py` uses the GitHub REST API rather than the `gh` CLI, which is not
installed on the build machine. It authenticates with the credential Git already has stored
for `github.com`, read over a pipe from `git credential fill`; the token is never printed,
logged, or written to disk. Re-running is idempotent — an existing asset with the same name
is deleted first.

Release notes are written in English.

## Not restored by the installer

The `.exe` rebuilds the application from scratch on a clean machine, but it deliberately
carries no credentials. After installing, recreate `C:\FreshdeskDashboard\Sharepoint\.env`
from `.env.example` and run

```
python C:\FreshdeskDashboard\Sharepoint\create_ticket_folder.py <ticket_id>
```

once in a terminal to complete the Microsoft device-code sign-in, which regenerates
`token_cache.json`. Keep the `.env` values in a password manager — they are the only part of
this project that cannot be recovered from GitHub.
