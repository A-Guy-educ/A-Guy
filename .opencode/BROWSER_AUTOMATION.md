# Browser Automation Guide

## Starting the Browser

### Chrome Extension Relay (Recommended for logged-in sessions)

```bash
# Start the relay
openclaw browser start --profile chrome

# Then in Chrome: click the OpenClaw extension icon on a tab to attach it
```

### OpenClaw Isolated Browser

```bash
openclaw browser start --profile openclaw
```

### Other Browsers

```bash
openclaw browser start --profile firefox
openclaw browser start --profile safari
```

## Gateway Timeout Handling

The gateway may time out after ~1 minute of inactivity.

**Retry Protocol:**

1. First timeout → Run `openclaw gateway restart`
2. Retry the browser command
3. If still timeout → Run `openclaw gateway restart` again
4. Retry once more
5. If still failing → Report error to user

**Quick restart command:**

```bash
openclaw gateway restart
```

## Common Browser Actions

| Action          | Command                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| Navigate to URL | `browser action="navigate", targetUrl="http://..."`                        |
| Take snapshot   | `browser action="snapshot"`                                                |
| Click element   | `browser action="act", request={"kind": "click", ref: "e123"}`             |
| Type text       | `browser action="act", request={"kind": "type", ref: "e123", text: "..."}` |
| Get page status | `browser action="status", profile: "chrome"`                               |

## Finding Element References

Use `snapshot` to get the UI tree. Elements have refs like `e123` that can be used for clicks and typing.

## Troubleshooting

- **"Gateway closed"** → Restart gateway
- **"Chrome extension relay not running"** → Run `openclaw browser start --profile chrome`
- **"No tab connected"** → Click the OpenClaw extension icon in Chrome
- **PATH issues** → Run commands in user's terminal directly (driver may not have openclaw in PATH)
