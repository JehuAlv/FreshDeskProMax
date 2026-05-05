FRESHDESK DASHBOARD - SERVER
============================

FIRST TIME SETUP:
1. Right-click "setup.bat" > Run as administrator
2. Wait for Python check, Ollama install, and model download (~3.3GB)
3. Done! The dashboard URL will be shown

DAILY USE:
- Services start automatically when you log in
- To start manually: double-click "start.bat"
- To stop: double-click "stop.bat"

ACCESS:
- From this PC: http://localhost:8080
- From other PCs: http://<this-pc-ip>:8080

REQUIREMENTS:
- Windows 10/11
- Python 3.8+ (setup.bat will tell you if missing)
- Internet connection (first time only, for Ollama + model download)

FEATURES:
- Freshdesk ticket dashboard with smart reply suggestions
- AI-powered reply generation (local Ollama)
- Auto-restart if services crash (watchdog)
- LAN accessible for all team members
