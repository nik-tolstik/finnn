# Mobile Access to the Dev Server

Use this guide to open the Next.js dev server on a phone or tablet connected to the same Wi-Fi network.

## Requirements

- The project runs in WSL2
- Your mobile device is on the same Wi-Fi network as your computer
- You can run PowerShell as Administrator

## 1. Start the dev server

Run this command in WSL:

```bash
pnpm dev --hostname 0.0.0.0
```

The app uses port `3000`.

## 2. Find the Windows IP address

Run this command in PowerShell:

```powershell
ipconfig | findstr /i "IPv4"
```

Use the IPv4 address from the Windows Wi-Fi or Ethernet adapter, not the WSL adapter.

Example: `192.168.1.100`

## 3. Forward port 3000 from Windows to WSL2

Run this in PowerShell as Administrator:

```powershell
$wslIp = (wsl hostname -I).Trim()
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=$wslIp
```

This forwards requests from Windows port `3000` to the app running inside WSL2.

## 4. Open port 3000 in Windows Firewall

Run this in PowerShell as Administrator:

```powershell
New-NetFirewallRule -DisplayName "Next.js Dev Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

## 5. Open the site on your phone

Open this URL in the mobile browser:

```text
http://<WINDOWS_IP>:3000
```

Example: `http://192.168.1.100:3000`

## Check

If everything is set up correctly:

- The site opens on your mobile device
- Changes in the code reload automatically

## Troubleshooting

### The site does not open

- Make sure the dev server is running with `pnpm dev --hostname 0.0.0.0`
- Make sure you use the Windows IP address, not the WSL IP
- Make sure both devices are on the same network
- Make sure the firewall rule exists

### Port forwarding stopped working

The WSL2 IP address can change after a restart. Recreate the rule:

```powershell
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0
$wslIp = (wsl hostname -I).Trim()
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=$wslIp
```

### Show current forwarding rules

```powershell
netsh interface portproxy show all
```
