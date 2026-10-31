# Quellen und Drittanbieter-Komponenten

Recherche und lokale Einrichtung: 31. Oktober 2026.

| Komponente | Quelle | Festgelegter Stand / Lizenz |
| --- | --- | --- |
| Login, Profile, CloudStorage, XMPP, Matchmaker | [Lawin0129/LawinServer](https://github.com/Lawin0129/LawinServer) | Commit `36385a150d786561acdd056651b3b15a11280bf3`, GPL-3.0 laut Upstream |
| Referenz für Startreihenfolge und DLLs | [Auties00/Reboot-Launcher](https://github.com/Auties00/Reboot-Launcher) | Commit `c6f82298b167ef2076bb59dc621f13dc5bd8d390`; Lizenzbedingungen der jeweiligen Upstream-Komponente beachten |
| Spielserver | [Milxnor/Project-Reboot-3.0](https://github.com/Milxnor/Project-Reboot-3.0) | Build-Commit `10c659028ad9d6816f78226483f11a884bf81f57`, BSD-3-Clause laut Upstream |

Die DLLs werden nicht in diesem Repository weiterverteilt. Ihre Downloadorte und Prüfsummen stehen in `dependencies.lock.json`. Prüfsummen belegen die Identität der festgelegten Dateien, nicht deren allgemeine Sicherheit oder Kompatibilität mit jedem Build.

## Technische Grundlage

- [LawinServer-README](https://github.com/Lawin0129/LawinServer/blob/36385a150d786561acdd056651b3b15a11280bf3/README.md): Das Backend stellt die Webdienste bereit und benötigt eine separate Umleitung der Clientanfragen.
- [Reboot-Startlogik](https://github.com/Auties00/Reboot-Launcher/blob/c6f82298b167ef2076bb59dc621f13dc5bd8d390/gui/lib/src/button/game_start_button.dart): Auth-Komponente beim Start; Konsole oder Spielserver nach abgeschlossenem Login.
- [Reboot-Komponentenquellen](https://github.com/Auties00/Reboot-Launcher/blob/c6f82298b167ef2076bb59dc621f13dc5bd8d390/common/lib/src/game/game_downloader.dart): Sinum, Console, Memory und Reboot-Artefakt.
- [DefaultInput.ini](https://github.com/Lawin0129/LawinServer/blob/36385a150d786561acdd056651b3b15a11280bf3/CloudStorage/DefaultInput.ini): F8 ist als Konsolentaste eingetragen.
- [Project-Reboot-README](https://github.com/Milxnor/Project-Reboot-3.0): Separate Spielserver-Komponente; ihre Existenz ersetzt keinen Test mit dem konkreten Fortnite-Build.

Lokale Änderungen an LawinServer sind vollständig in `scripts/patch-backend.js` sichtbar: Loopback-Bindung, Health-Endpunkt, Protokollierung von Methode/Pfad ohne Auth-Header und eindeutiger Fehlerstatus bei fehlgeschlagenem Start. Diese Änderungen überschreiben keine Benutzerprofile. Die Projektdateien hier ergänzen den Upstream-Server; dessen Urheberschaft bleibt bei den genannten Autoren.
