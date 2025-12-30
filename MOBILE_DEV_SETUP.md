# Настройка доступа к dev-серверу с мобильных устройств

Этот гайд поможет настроить доступ к Next.js dev-серверу с мобильных устройств в той же Wi-Fi сети.

## Предварительные требования

- Next.js dev-сервер должен быть запущен
- Мобильное устройство должно быть в той же Wi-Fi сети, что и компьютер
- PowerShell с правами администратора (для Windows)

## Шаг 1: Настройка Next.js

Dev-сервер уже настроен в `package.json` для прослушивания на всех интерфейсах:

```json
"dev": "next dev -p 3000 -H 0.0.0.0"
```

## Шаг 2: Найти IP-адрес хоста Windows

В PowerShell выполни:

```powershell
ipconfig | findstr /i "IPv4"
```

Найди IP-адрес в разделе "Адаптер беспроводной локальной сети Wi-Fi" или "Ethernet адаптер" (не WSL). Обычно это что-то вроде `192.168.x.x` или `10.0.x.x`.

## Шаг 3: Настроить проброс портов WSL2 → Windows

В PowerShell от имени администратора выполни:

```powershell
$wslIp = (wsl hostname -I).Trim()
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=$wslIp
```

Эта команда пробрасывает порт 3000 с Windows на WSL2.

## Шаг 4: Открыть порт в брандмауэре Windows

В PowerShell от имени администратора:

```powershell
New-NetFirewallRule -DisplayName "Next.js Dev Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

Или через GUI:
1. Открой "Брандмауэр Защитника Windows" (Win + R → `wf.msc`)
2. Создай правило для входящих подключений на порт 3000 (TCP)

## Шаг 5: Подключиться с мобильного устройства

На мобильном устройстве открой браузер и перейди по адресу:

```
http://[IP_АДРЕС_WINDOWS]:3000
```

Например: `http://192.168.1.100:3000`

## Проверка

Если всё настроено правильно:
- Dev-сервер должен быть доступен с мобильного устройства
- Изменения в коде будут автоматически обновляться на мобильном устройстве (hot reload)

## Устранение проблем

### Сайт не грузится

1. Убедись, что dev-сервер запущен: `npm run dev`
2. Проверь, что используешь IP хоста Windows, а не WSL2
3. Убедись, что мобильное устройство в той же Wi-Fi сети
4. Проверь, что порт открыт в брандмауэре

### Проброс портов не работает

Удали старое правило и создай заново:

```powershell
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0
$wslIp = (wsl hostname -I).Trim()
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=$wslIp
```

### Проверка проброса портов

Посмотреть все проброшенные порты:

```powershell
netsh interface portproxy show all
```

## Примечания

- IP-адрес WSL2 может меняться при перезапуске. Если проброс перестал работать, выполни Шаг 3 заново
- Для постоянного проброса портов можно создать скрипт, который будет запускаться при старте WSL2

