static inline void LauncherBotLobbyUI(bool configure)
{
    ImGui::Separator();
    ImGui::TextUnformatted("BOT LOBBY - TEST VERSION");
    if (InfinityShowdown::Enabled.load()) {
        ImGui::TextWrapped("Bots are disabled in Infinity Showdown."); return;
    }
    if (configure) {
        int count = BotLobby::Requested.load();
        if (ImGui::SliderInt("Combat bots (0 = off)", &count, 0, 10)) BotLobby::Requested.store(count);
        ImGui::TextWrapped("Classic / Thanos only. Bots appear near players after landing on the main island. Basic movement and rifle combat; no building or looting.");
    } else {
        ImGui::Text("Bots alive: %d", BotLobby::Alive.load());
        ImGui::TextWrapped("%s", BotLobby::ReadStatus().c_str());
    }
}
