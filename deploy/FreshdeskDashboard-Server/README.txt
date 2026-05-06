FRESHDESK DASHBOARD - SERVER
============================

FIRST TIME SETUP:
1. Right-click "setup.bat" > Run as administrator
2. Wait for Python, Ollama, dependencies, and model download (~4.7GB)
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
- Internet connection (first time only, for Ollama + model download)

FEATURES:
- Freshdesk ticket dashboard with smart reply suggestions
- AI-powered reply generation (local Ollama - qwen2.5:7b)
- Auto-recovery if Ollama crashes (CUDA/GPU errors)
- LAN accessible for all team members
