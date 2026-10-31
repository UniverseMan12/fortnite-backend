# Fortnite Backend

Deutscher Windows-Launcher für ein lokales Fortnite-Legacy-Setup. Du startest `START.cmd`, gibst die Fortnite-Version und den Spielordner an und wählst Lobby oder lokalen Spielserver. Das Backend basiert auf **LawinServer**; Spielserver und Konsolen-Komponente stammen aus dem **Project-Reboot-Umfeld**. Es handelt sich nicht um einen komplett neu geschriebenen Fortnite-Server.

## Aktueller Teststand

Mit **Fortnite 4.2, CL-4072250**, lokal überprüft:

- Installationsprüfung: `FortniteGame`, `Engine`, x64-Shipping-EXE und Pak-Dateien.
- Echter Spielstart, lokaler Login und sichtbare Season-4-Lobby.
- F8 öffnet die Konsole im Spiel.
- Automatisierte Tests für OAuth-Antwort, Athena-Profil, Service-Status, F8-Hotfix, Matchmaking-Ziel, XMPP und Fehler bei belegten Ports.

**Der separate Reboot-Spielserver ist eingebunden, aber ein tatsächlicher Rundenbeitritt wurde noch nicht end-to-end bestätigt.** Die automatische Ausführungsprüfung der Entwicklungsumgebung hat den Spielserver-Teststart blockiert. Ein erfolgreicher Backend-Test allein beweist keine spielbare Runde. Andere Fortnite-Versionen sind ebenfalls nicht getestet.

## Start

Voraussetzungen: Windows x64, [Node.js 22 oder neuer](https://nodejs.org/), beim ersten Setup [Git](https://git-scm.com/downloads/win) und eine eigene vollständige Fortnite-Installation. Dieses Repository enthält keine Fortnite-Spieldateien.

1. `START.cmd` doppelklicken.
2. Version eingeben, beispielsweise `4.2`.
3. Den **gemeinsamen übergeordneten Ordner** von `FortniteGame` und `Engine` eingeben. Nicht einen dieser beiden Unterordner auswählen.
4. Einen lokalen Spielernamen eingeben. Es werden keine echten Epic-Zugangsdaten benötigt.
5. Eine Option wählen:
   - `1`: Fortnite zur Lobby starten.
   - `2`: Spielserver und Fortnite starten.
   - `3`: Nur den Spielserver starten.
   - `4`: Nur das Backend weiterlaufen lassen.
   - `0`: Sitzung beenden.

```text
Dein gewählter Ordner/
├── Engine/
└── FortniteGame/
    ├── Binaries/Win64/FortniteClient-Win64-Shipping.exe
    └── Content/Paks/*.pak
```

Die Auswahl wird in `config.local.json` gespeichert. Enter übernimmt beim nächsten Start den angezeigten Wert. Der Setup-Schritt lädt festgelegte Drittanbieter-Komponenten und prüft die SHA-256-Werte der DLLs. Beim ersten Start muss deshalb eine Internetverbindung bestehen.

## Einer lokalen Runde beitreten

Mit Option `2` werden zwei Spielprozesse gestartet: ein Host und dein sichtbarer Client. Das benötigt entsprechend mehr RAM. Warte, bis der Reboot-Host **Joinable: true** meldet. Öffne im Client mit **F8** die Konsole, gib Folgendes ein und bestätige mit Enter:

```text
open 127.0.0.1:7777
```

F8 öffnet die Konsole; es startet nicht von allein eine Runde. Ohne laufenden Spielserver kann der Befehl keine Verbindung herstellen. Falls Medal ebenfalls auf F8 reagiert, kann zusätzlich eine Clip-Benachrichtigung erscheinen; die Konsole war im lokalen Test trotzdem sichtbar.

Eine private Runde verbindet dich nicht mit den offiziellen Epic-Spielern. Dieses Setup enthält weder öffentliches Matchmaking noch einen Bot-Füllmechanismus. Für gewöhnliche Matches braucht es weitere Spieler und einen entsprechend erweiterten Netzwerkaufbau.

## Befehle für Entwicklung

```powershell
npm run setup      # Abhängigkeiten installieren und lokale Anpassungen anwenden
npm start          # Interaktiver Start
npm run doctor     # Installationspfad und DLL-Prüfsummen prüfen
npm run backend    # Nur Backend; Beenden mit Strg+C
npm test           # Tests mit isolierter Kopie der Backend-Profile
```

HTTP-Backend: `http://127.0.0.1:3551`; XMPP/Matchmaker: `127.0.0.1:80`; Spielserver-Ziel: `127.0.0.1:7777` (UDP). HTTP und XMPP binden ausschließlich an Loopback. Dem Host wird `-MULTIHOME=127.0.0.1` mitgegeben; die tatsächliche UDP-Bindung ist Teil des noch offenen Spielserver-Tests. Es werden keine Firewallregeln, Hosts-Dateien oder systemweiten Zertifikate geändert.

Der Launcher lädt die lokalen Reboot-Komponenten in seine eigenen Spielprozesse. Windows-Jobobjekte sorgen dafür, dass beim Beenden des zugehörigen Helfers auch seine Spiel- und Begleitprozesse beendet werden. Die vorhandenen Spiel-EXE-Dateien werden nicht gepatcht oder ersetzt. Die alten Begleitprozesse werden angelegt und bleiben suspendiert.

## Diagnose

- **Falscher Ordner:** Eine Ebene nach oben gehen, bis `FortniteGame` und `Engine` nebeneinander liegen.
- **Port 80 oder 3551 belegt:** Eine andere Backend-Instanz bzw. den belegenden Dienst beenden. Der Launcher beendet keine fremden Dienste.
- **Login bleibt hängen:** `logs/backend.log` sowie den im Starter genannten Spiellog prüfen. Bei 4.2 liegt dieser normalerweise unter `%LOCALAPPDATA%\FortniteGame\Saved\Logs`. Der Launcher ordnet das Log anhand der individuellen Startargumente dem richtigen Prozess zu.
- **Konsole offen, aber kein Beitritt:** Prüfen, ob der separate Host `Joinable: true` meldet und Port 7777 verwendet. Die Lobby ist noch kein Spielserver.
- **Download nicht mehr verfügbar:** GitHub-Actions-Artefakte können ablaufen. `dependencies.lock.json` nennt den ursprünglichen Commit und die Prüfsumme. Ein neuer Build muss ausdrücklich geprüft und mit neuer Prüfsumme eingetragen werden. Der Launcher lädt nicht stillschweigend eine andere Version.
- **DLL fehlt oder Prüfsumme stimmt nicht:** Der Start wird abgebrochen. Es werden keine Antiviren-Ausnahmen oder Änderungen an Schutzfunktionen eingerichtet.

LawinServer V1 ist eine lokale Einzelbenutzer-Emulation mit gemeinsamem Profilbestand. Es ist keine sichere Mehrbenutzer-Plattform für öffentliche Bereitstellung. Vom Backend angezeigte V-Bucks, Gegenstände und Level sind lokale Testdaten.

## Dateien und Herkunft

- `src/`: Launcher, Validierung, Prozessverwaltung.
- `scripts/`: Setup, kleine LawinServer-Anpassungen, Windows-Spielstart.
- `tests/`: Pfadvalidierung und Backend-Integrationstests.
- `dependencies.lock.json`: Festgelegte Quellen und DLL-Prüfsummen.
- `THIRD_PARTY.md`: Quellen, Lizenzen und Rechercheergebnisse.

`vendor/`, `runtime/`, `logs/`, `data/`, persönliche Einstellungen und Spieldateien werden nicht ins GitHub-Repository hochgeladen. Profile und Einstellungen des Backend-Pakets liegen lokal in `vendor/LawinServer` beziehungsweise `%LOCALAPPDATA%\LawinServer`. Die Drittanbieter-Lizenzen bleiben im heruntergeladenen Quellcode erhalten.
