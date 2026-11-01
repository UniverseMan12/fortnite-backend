static inline void LauncherBotLobbyUI(bool configure)
{
    ImGui::Separator();
    ImGui::TextUnformatted("BOT LOBBY - TEST VERSION");
    if (InfinityShowdown::Enabled.load()) {
        ImGui::TextWrapped("Bots are disabled in Infinity Showdown."); return;
    }
    if (configure) {
        int count = BotLobby::Requested.load();
        if (ImGui::SliderInt("Maximum bots (0 = off)", &count, 0, 99)) BotLobby::Requested.store(count);
        ImGui::TextWrapped("Classic / Thanos only. 99 fills a 100-player match; friends take bot slots. Wait for the warmup population before starting the bus. Bots use separate teams, jump from the bus and fight each other. No building or looting yet.");
    } else {
        ImGui::Text("Bots alive: %d", BotLobby::Alive.load());
        ImGui::Text("Observed moving: %d | fired: %d", BotLobby::Moving.load(), BotLobby::Shooting.load());
        ImGui::TextWrapped("%s", BotLobby::ReadStatus().c_str());
    }
}
