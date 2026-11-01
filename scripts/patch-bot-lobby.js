import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function patchBotLobby(root) {
  const dir=path.join(root,'Project Reboot 3.0'), source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../server');
  for(const name of ['BotLobby.h','BotLobbyRules.h','BotLobby.inl','BotLobbyUI.inl'])fs.copyFileSync(path.join(source,name),path.join(dir,name));
  const edit=(name,changes)=>{
    const file=path.join(dir,name); let text=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
    if(text.includes('// NOVA DROP bot lobby v1'))return;
    for(const [before,after] of changes){if(text.split(before).length!==2)throw new Error(`Bot lobby patch mismatch: ${name}: ${before}`);text=text.replace(before,after);}
    fs.writeFileSync(file,'// NOVA DROP bot lobby v1\n'+text);
  };
  edit('NetDriver.cpp',[
    ['#include "InfinityShowdown.inl"','#include "InfinityShowdown.inl"\n#include "BotLobby.inl"'],
    ['\tLocalTools::Tick(NetDriver);','\tLocalTools::Tick(NetDriver);\n\tBotLobby::Tick(NetDriver);']
  ]);
  edit('gui.h',[
    ['#include "LocalTools.h"','#include "LocalTools.h"\n#include "BotLobby.h"'],
    ['#include "LocalToolsUI.inl"','#include "BotLobbyUI.inl"\n#include "LocalToolsUI.inl"'],
    ['\tLauncherLocalToolsUI();','\tLauncherBotLobbyUI(false);\n\tLauncherLocalToolsUI();'],
    ['\t\tif (ImGui::Button("Start server"))','\t\tLauncherBotLobbyUI(true);\n\t\tif (ImGui::Button("Start server"))']
  ]);
}
