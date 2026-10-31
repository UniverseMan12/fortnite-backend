import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function patchReboot(root) {
  const dir = path.join(root, 'Project Reboot 3.0');
  const update = (file, transform) => {
    const target = path.join(dir, file);
    const old = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
    if (old.includes('// Launcher manual startup')) return;
    fs.writeFileSync(target, '// Launcher manual startup\n' + transform(old));
  };
  const replace = (source, before, after) => {
    if (source.split(before).length !== 2) throw new Error('Pinned Reboot source does not match: ' + before.slice(0, 60));
    return source.replace(before, after);
  };
  update('gui.h', source => {
    source = replace(source, 'extern inline int SecondsUntilTravel = 5;',
      'extern inline std::atomic<bool> LauncherStartRequested(false);\n' +
      'static inline void LauncherSignal(const char* name) {\n' +
      '    char directory[32768];\n' +
      '    DWORD length = GetEnvironmentVariableA("FORTNITE_LAUNCHER_SIGNALS", directory, sizeof(directory));\n' +
      '    if (length > 0 && length < sizeof(directory)) std::ofstream(std::string(directory) + "/" + name) << "ready";\n' +
      '}');
    source = replace(source,
      '\t\tImGui::SliderInt("Seconds until load into map", &SecondsUntilTravel, 1, 100);',
      '\t\tImGui::TextUnformatted("Choose a playlist, then click Start server. No countdown.");');
    source = replace(source,
      '\tif (!Globals::bCreative)\n\t\tImGui::InputText("Playlist", &PlaylistName);',
      '\tif (!LauncherStartRequested.load()) {\n' +
      '\t\tif (ImGui::Button("Solo")) PlaylistName = "/Game/Athena/Playlists/Playlist_DefaultSolo.Playlist_DefaultSolo";\n' +
      '\t\tImGui::SameLine();\n' +
      '\t\tif (ImGui::Button("Thanos (experimental)")) PlaylistName = "/Game/Athena/Playlists/Carmine/Playlist_Carmine.Playlist_Carmine";\n' +
      '\t\tImGui::InputText("Playlist", &PlaylistName);\n' +
      '\t\tstatic bool missingPlaylist = false;\n' +
      '\t\tif (ImGui::Button("Start server")) {\n' +
      '\t\t\tmissingPlaylist = FindObject<UObject>(PlaylistName) == nullptr;\n' +
      '\t\t\tif (!missingPlaylist) { LauncherSignal("server-started.flag"); LauncherStartRequested.store(true); }\n' +
      '\t\t}\n' +
      '\t\tif (missingPlaylist) ImGui::TextUnformatted("Playlist is not loaded in this build. Select another playlist.");\n' +
      '\t} else { ImGui::TextUnformatted("Starting server..."); }');
    return replace(source, '\t::ShowWindow(hwnd, SW_SHOWDEFAULT);',
      '\t::ShowWindow(hwnd, SW_SHOWDEFAULT);\n\tLauncherSignal("server-settings.flag");');
  });
  update('dllmain.cpp', source => replace(source,
    '    while (SecondsUntilTravel > 0)\n    {\n        SecondsUntilTravel -= 1;\n\n        Sleep(1000);\n    }',
    '    while (!LauncherStartRequested.load()) Sleep(100);'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Pass the pinned Reboot source directory.');
  patchReboot(path.resolve(process.argv[2]));
}
