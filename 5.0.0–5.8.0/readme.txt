* Drop astrolabe.dll and config.json to:
same directory where the game's executable file is located

- Compatible with all versions 5.0–5.8
- Also, compatible with all βeta versions 4.8.50-5.8.50
- Bypass certain security checks
- Redirect HTTP requests to a local URL (configurable via `config.json`)
- The patch is integrated with the proxy, so no external proxy is needed
- Auto-clean HOYO_PASS_ENABLE registry entries
- redirect_hooks: set to *false* if the game force-closes (some versions may require this); an external proxy will then be required.
